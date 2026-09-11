import { defineBackground } from 'wxt/utils/define-background';
import { storage } from 'wxt/utils/storage';
import { ClientFactory } from '@/entities/client/lib/ClientFactory';
import { ContextMenuService } from '../features/torrent-control/model/services/ContextMenuService';
import { AppSettings } from '@/shared/lib/types';
import { StateHydrator } from '../features/torrent-control/services/StateHydrator';
import { TorrentController, type ControllerStateEvent } from '../features/torrent-control/services/TorrentController';
import { SESSION_KEY_KEY, VAULT_DATA_KEY, VAULT_SALT_KEY } from '@/shared/api/security/VaultService';
import { KeyManager } from '@/shared/api/security/KeyManager';
import { ServerResolver } from '@/shared/api/server/ServerResolver';
import { checkHostPermission } from '@/shared/lib/permissions';
import { HeaderRewriter } from '@/shared/api/network/HeaderRewriter';
import { ACTIVE_SESSION_PORT, type RuntimeRequest } from '@/shared/api/messaging/protocol';

const FAST_POLL_INTERVAL_MS = 2000;
const HEARTBEAT_ALARM = 'packet_beat';

export default defineBackground(() => {
    // [Security] Scrub the plaintext vault key that older Firefox builds mirrored
    // into storage.local. This runs on every wake rather than only on startup:
    // onStartup does not fire on extension update, which is exactly how existing
    // installs reach this build, and a stale key left on disk is the whole defect.
    KeyManager.purgeLegacyFallbackKey().catch((err) => {
        console.warn('[Background] Legacy session key purge failed:', err);
    });

    const factory = new ClientFactory();
    const contextMenuService = new ContextMenuService();

    const controller = new TorrentController({
        resolve: () => ServerResolver.resolve(),
        createClient: (config) => factory.create(config),
        hasHostPermission: (url) => checkHostPermission(url),
        prepareTransport: (config) => HeaderRewriter.prepare(config),
        getSettings: () => storage.getItem<AppSettings>('local:options'),
        persist: (snapshot) => StateHydrator.persist(snapshot),
        log: (message, ...rest) => {
            if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) console.debug(message, ...rest);
        },
    });

    // Restore the last snapshot from the previous background instance. The
    // controller only uses it once the active server is known to match.
    StateHydrator.hydrate().then((persisted) => controller.hydrate(persisted));

    // Rebuild context menus on browser startup — Firefox MV3 does not persist
    // them across restarts.
    chrome.runtime.onStartup.addListener(async () => {
        await KeyManager.purgeLegacyFallbackKey();
        contextMenuService.ensureMenus();
    });

    contextMenuService.initialize({
        addTorrent: (request) => controller.addTorrent(request),
    });

    // ------------------------------------------------------------------
    // Badge
    // ------------------------------------------------------------------

    const applyBadge = async (event: ControllerStateEvent) => {
        try {
            const settings = await storage.getItem<AppSettings>('local:options');
            const badgeInfo = settings?.globals?.badgeInfo ?? 'count';
            const { connection, stats } = event;

            if (badgeInfo === 'none') {
                await chrome.action.setBadgeText({ text: '' });
                return;
            }

            switch (connection.status) {
                case 'connected':
                case 'stale':
                    if (badgeInfo === 'count') {
                        await chrome.action.setBadgeText({ text: stats.activeCount > 0 ? String(stats.activeCount) : '' });
                        await chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' });
                    } else {
                        const speed = stats.downloadSpeed;
                        let text = '';
                        if (speed >= 1024 * 1024) text = `${(speed / (1024 * 1024)).toFixed(1)}M`;
                        else if (speed >= 1024) text = `${(speed / 1024).toFixed(0)}K`;
                        else if (speed > 0) text = `${speed}B`;
                        await chrome.action.setBadgeText({ text });
                        await chrome.action.setBadgeBackgroundColor({ color: '#10B981' });
                    }
                    return;
                case 'locked':
                    await chrome.action.setBadgeText({ text: 'Lock' });
                    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
                    return;
                case 'unavailable':
                case 'auth_failed':
                case 'permission_missing':
                case 'invalid_config':
                case 'vault_corrupted':
                    await chrome.action.setBadgeText({ text: '!' });
                    await chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
                    return;
                default:
                    await chrome.action.setBadgeText({ text: '' });
            }
        } catch (e) {
            console.error('[Background] Failed to update badge:', e);
        }
    };
    controller.onStateChange((event) => { void applyBadge(event); });

    // ------------------------------------------------------------------
    // Polling cadence
    // ------------------------------------------------------------------

    let fastPolling: ReturnType<typeof setInterval> | null = null;

    const updateCadence = () => {
        const wantFast = controller.subscriberCount() > 0;
        if (wantFast && !fastPolling) {
            void controller.refresh();
            fastPolling = setInterval(() => { void controller.refresh(); }, FAST_POLL_INTERVAL_MS);
        } else if (!wantFast && fastPolling) {
            clearInterval(fastPolling);
            fastPolling = null;
        }
    };

    // Sender validation: only this extension's own contexts (popup/options) may
    // reach the privileged handlers below. chrome.runtime.id works for both
    // Chrome and Firefox MV3 (Firefox reports the add-on ID in both places).
    const isTrustedSender = (sender?: chrome.runtime.MessageSender): boolean =>
        sender?.id === chrome.runtime.id;

    chrome.runtime.onConnect.addListener((port) => {
        if (!isTrustedSender(port.sender)) {
            console.warn('[Background] Rejected port connection from untrusted sender:', port.sender?.id);
            port.disconnect();
            return;
        }
        if (port.name !== ACTIVE_SESSION_PORT) return;

        controller.attachPort(port);
        port.onDisconnect.addListener(() => updateCadence());
        updateCadence();
    });

    // Background heartbeat: keeps the toolbar badge current while no UI is
    // open. Skipped entirely when the badge is disabled so an idle browser
    // does not contact the server for nothing.
    chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener(async (alarm) => {
        if (alarm.name !== HEARTBEAT_ALARM) return;
        if (controller.subscriberCount() > 0) return; // fast polling already running
        const settings = await storage.getItem<AppSettings>('local:options');
        if ((settings?.globals?.badgeInfo ?? 'count') === 'none') return;
        void controller.refresh();
    });

    // ------------------------------------------------------------------
    // Invalidation sources
    // ------------------------------------------------------------------

    const invalidate = (reason: string) => {
        controller.invalidate(reason);
        void controller.refresh();
    };

    try {
        storage.watch(SESSION_KEY_KEY, () => invalidate('session-key'));
        storage.watch(VAULT_DATA_KEY, () => invalidate('vault-data'));
        storage.watch(VAULT_SALT_KEY, () => invalidate('vault-salt'));
        storage.watch<AppSettings>('local:options', () => invalidate('options'));
    } catch (e) {
        console.error('[Background] Failed to register storage watchers', e);
    }

    if (chrome.permissions?.onRemoved) {
        chrome.permissions.onRemoved.addListener(() => {
            controller.notePermissionRemoved();
            invalidate('permission-removed');
        });
    }
    if (chrome.permissions?.onAdded) {
        chrome.permissions.onAdded.addListener(() => invalidate('permission-added'));
    }

    // ------------------------------------------------------------------
    // Request handler
    // ------------------------------------------------------------------

    chrome.runtime.onMessage.addListener((message: RuntimeRequest, sender, sendResponse) => {
        if (!isTrustedSender(sender)) {
            console.warn('[Background] Rejected message from untrusted sender:', sender?.id);
            return false;
        }
        controller
            .handleRequest(message)
            .then(sendResponse)
            .catch((error: unknown) => {
                console.error('[Background] Request failed:', error);
                sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
            });
        return true;
    });

    // Initial state for the badge (and to warm the client) on wake.
    void controller.refresh();
});
