import { storage } from 'wxt/utils/storage';
import { AppSettings, ContextMenuMode, ServerConfig } from '@/shared/lib/types';
import { normalizeContextMenuMode } from '@/features/torrent-control/model/settingsSchema';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { SESSION_KEY_KEY, VAULT_DATA_KEY, VAULT_SALT_KEY } from '@/shared/api/security/VaultService';
import { ServerResolver, ResolutionState, ResolvedServers } from '@/shared/api/server/ServerResolver';
import type { AddTorrentRequest, CommandResult } from '@/shared/api/messaging/protocol';

/** Debounce window (ms) — absorbs rapid-fire storage events into one rebuild. */
const REBUILD_DEBOUNCE_MS = navigator.userAgent.includes('Firefox') ? 300 : 200;

/** Last-known-good cache TTL (ms) — prevents transient NO_SERVERS from clearing menus. */
const LAST_GOOD_TTL_MS = 3000;

const SERVER_ITEM_PREFIX = 'add-torrent-server-';
const LABEL_ITEM_PREFIX = 'add-torrent-label-';
const PATH_ITEM_PREFIX = 'add-torrent-path-';

type VaultState = 'uninitialized' | 'locked' | 'unlocked';

/**
 * Commands the menu can issue. Adds go through the background controller so
 * the global add-paused default and server identity rules apply exactly as
 * they do for the popup.
 */
export interface ContextMenuCommands {
    addTorrent: (request: AddTorrentRequest) => Promise<CommandResult>;
}

export class ContextMenuService {
    private commands: ContextMenuCommands;

    // Coalescing state
    private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    private isRebuilding = false;
    private pendingRebuild = false;

    // Last-known-good stabilization
    private lastGoodResult: ResolvedServers | null = null;
    private lastGoodTimestamp = 0;
    private lastVaultState: VaultState = 'uninitialized';

    constructor() {
        this.commands = {
            addTorrent: async () => ({ ok: false, error: 'CTRL is still starting up.', errorType: 'NOT_READY' }),
        };
    }

    initialize(commands: ContextMenuCommands) {
        this.commands = commands;
        this.scheduleRebuild('initialize', true);
        this.setupListeners();

        // Watch for settings changes to rebuild menus
        storage.watch<AppSettings>('local:options', () => {
            this.scheduleRebuild('options');
        });

        // Watch for Vault Data changes (e.g. servers updated)
        storage.watch(VAULT_DATA_KEY, () => {
            this.scheduleRebuild('vault_data');
        });

        // Watch for Session Key (Unlock/Lock)
        storage.watch(SESSION_KEY_KEY, () => {
            this.scheduleRebuild('session_key');
        });

        // Watch for Vault Initialization
        storage.watch(VAULT_SALT_KEY, () => {
            this.scheduleRebuild('vault_salt');
        });

        // Ensure fresh setup on install/update
        chrome.runtime.onInstalled.addListener(() => {
            this.scheduleRebuild('onInstalled', true);
        });
    }

    /**
     * Public entry point for external callers (e.g. onStartup in background.ts).
     * Forces an immediate rebuild (no debounce).
     */
    ensureMenus() {
        this.scheduleRebuild('ensureMenus', true);
    }

    /**
     * Coalesces multiple rapid triggers into a single rebuild.
     * If `immediate` is true, fires right away (for startup / onInstalled).
     */
    private scheduleRebuild(source: string, immediate = false) {
        if (immediate) {
            // Cancel any pending debounced timer
            if (this.rebuildTimer !== null) {
                clearTimeout(this.rebuildTimer);
                this.rebuildTimer = null;
            }
            this.doRebuild(source);
            return;
        }

        // Debounced — if timer already set, the pending trigger is absorbed
        if (this.rebuildTimer !== null) {
            return;
        }

        this.rebuildTimer = setTimeout(() => {
            this.rebuildTimer = null;
            this.doRebuild(source);
        }, REBUILD_DEBOUNCE_MS);
    }

    /**
     * Wrapper around chrome.contextMenus.create that checks runtime.lastError.
     * Soft-fails: logs the error but does not throw.
     */
    private safeCreate(props: chrome.contextMenus.CreateProperties) {
        chrome.contextMenus.create(props, () => {
            if (chrome.runtime.lastError) {
                console.warn('[ContextMenu] create() error for', props.id, ':', chrome.runtime.lastError.message);
            }
        });
    }

    /**
     * Enhanced stabilization: tracks vault state and applies last-known-good for transient failures.
     */
    private stabilizeResolution(current: ResolvedServers): ResolvedServers {
        const now = Date.now();

        // Cache good states and track vault as unlocked
        if (current.state === ResolutionState.OK) {
            this.lastGoodResult = current;
            this.lastGoodTimestamp = now;
            this.lastVaultState = 'unlocked';
            return current;
        }

        // Security states always override cache and update vault tracking
        if (current.state === ResolutionState.LOCKED || current.state === ResolutionState.UNINITIALIZED) {
            this.lastVaultState = current.state === ResolutionState.LOCKED ? 'locked' : 'uninitialized';
            // Reset cache on genuine vault state change to prevent showing stale OK menus
            this.lastGoodResult = null;
            return current;
        }

        // Transient failure states: use cache if within TTL and vault is still unlocked
        if ((current.state === ResolutionState.NO_SERVERS || current.state === ResolutionState.INVALID_CONFIG) &&
            this.lastGoodResult !== null &&
            (now - this.lastGoodTimestamp) < LAST_GOOD_TTL_MS &&
            this.lastVaultState === 'unlocked') {
            return this.lastGoodResult;
        }

        return current;
    }

    /**
     * Pure function: determines which menu items should exist for a given resolution state.
     * Returns empty array only for Hidden mode.
     */
    private determineMenuItems(
        resolution: ResolvedServers,
        mode: ContextMenuMode,
        globals: AppSettings['globals']
    ): chrome.contextMenus.CreateProperties[] {
        const items: chrome.contextMenus.CreateProperties[] = [];

        // Hidden mode: return empty array
        if (mode === 0) {
            return items;
        }

        // Non-OK states: single fallback item
        if (resolution.state !== ResolutionState.OK) {
            if (resolution.state === ResolutionState.LOCKED || resolution.state === ResolutionState.UNINITIALIZED) {
                items.push({
                    id: 'unlock-vault',
                    title: resolution.state === ResolutionState.LOCKED
                        ? 'Unlock CTRL to add torrents'
                        : 'Set up CTRL to add torrents',
                    contexts: ['link', 'selection', 'page'],
                });
            } else {
                // NO_SERVERS, INVALID_CONFIG, NO_ACTIVE_SERVER
                items.push({
                    id: 'open-ctrl',
                    title: 'Open CTRL to configure servers',
                    contexts: ['link', 'selection', 'page'],
                });
            }
            return items;
        }

        // OK state: build full menu
        const servers = resolution.servers;
        const showAdd = mode === 1 || mode === 2;
        const showPaused = mode === 1;

        // 1. Add to CTRL (default server, global add-paused default applies)
        if (showAdd) {
            items.push({
                id: 'add-torrent',
                title: 'Add to CTRL',
                contexts: ['link', 'selection'],
            });
        }

        // 2. Add Paused (explicit override)
        if (showPaused) {
            items.push({
                id: 'add-torrent-paused',
                title: 'Add to CTRL (paused)',
                contexts: ['link'],
            });
        }

        // 3. Server Selection (if multiple servers). Items are keyed by the
        //    server's stable id, never by its position in the list.
        if (servers.length > 1) {
            const withIds = servers.filter((s): s is ServerConfig & { id: string } => typeof s.id === 'string');

            withIds.forEach((server) => {
                if (server.showInContextMenu) {
                    items.push({
                        id: `${SERVER_ITEM_PREFIX}${server.id}`,
                        title: `Add to ${server.name}`,
                        contexts: ['link'],
                    });
                }
            });

            const submenuServers = withIds.filter((server) => !server.showInContextMenu);

            if (submenuServers.length > 0) {
                items.push({
                    id: 'server-selection',
                    title: 'Add to server...',
                    contexts: ['link'],
                });

                submenuServers.forEach((server) => {
                    items.push({
                        id: `${SERVER_ITEM_PREFIX}${server.id}`,
                        parentId: 'server-selection',
                        title: server.name,
                        contexts: ['link'],
                    });
                });
            }
        }

        // 4. Add with Label (Full Menu only)
        if (mode === 1 && globals.labels && globals.labels.length > 0) {
            items.push({
                id: 'label-selection',
                title: 'Add with label...',
                contexts: ['link'],
            });

            globals.labels.forEach((label: string, index: number) => {
                items.push({
                    id: `${LABEL_ITEM_PREFIX}${index}`,
                    parentId: 'label-selection',
                    title: label,
                    contexts: ['link'],
                });
            });
        }

        // 5. Add to Path (Full Menu only)
        const currentServer = resolution.activeServer;
        if (mode === 1 && currentServer && currentServer.directories && currentServer.directories.length > 0) {
            items.push({
                id: 'path-selection',
                title: 'Add to folder...',
                contexts: ['link'],
            });

            currentServer.directories.forEach((path: string, index: number) => {
                items.push({
                    id: `${PATH_ITEM_PREFIX}${index}`,
                    parentId: 'path-selection',
                    title: path,
                    contexts: ['link'],
                });
            });
        }

        return items;
    }

    /**
     * Core rebuild — called once per coalesced trigger burst.
     * Uses atomic menu replacement: determine full item set first, then replace.
     */
    private async doRebuild(source: string) {
        if (this.isRebuilding) {
            this.pendingRebuild = true;
            return;
        }

        this.isRebuilding = true;
        this.pendingRebuild = false;

        try {
            const settings = await storage.getItem<AppSettings>('local:options') || DEFAULT_OPTIONS;
            const globals = settings?.globals || DEFAULT_OPTIONS.globals;

            // Stored values may be strings (old radio groups) or the removed
            // "custom" mode; normalise to the retained 0/1/2 set.
            const mode = normalizeContextMenuMode(globals.contextMenu);

            // ── Step 1: Resolver snapshot (single call per rebuild) ──
            const rawResolution = await ServerResolver.resolve();

            // ── Step 2: Apply stabilization ──
            const resolution = this.stabilizeResolution(rawResolution);

            // ── Step 3: Determine full menu set (pure function, no side effects) ──
            const menuItems = this.determineMenuItems(resolution, mode, globals);

            // ── Step 4: ATOMIC replacement ──
            await chrome.contextMenus.removeAll();

            for (const item of menuItems) {
                this.safeCreate(item);
            }
        } catch (e) {
            console.error(`[ContextMenu] Error in doRebuild (source=${source}):`, e);
        } finally {
            this.isRebuilding = false;
            if (this.pendingRebuild) {
                this.doRebuild('pending');
            }
        }
    }

    private setupListeners() {
        chrome.contextMenus.onClicked.addListener(async (info) => {
            if (info.menuItemId === 'unlock-vault' || info.menuItemId === 'open-ctrl') {
                chrome.runtime.openOptionsPage();
                return;
            }

            const url = (info.linkUrl || info.selectionText || '').trim();
            if (!url) return;

            const menuItemId = String(info.menuItemId);

            try {
                if (menuItemId === 'add-torrent') {
                    await this.submit({ type: 'ADD_TORRENT_URL', url }, 'Torrent added');
                    return;
                }
                if (menuItemId === 'add-torrent-paused') {
                    await this.submit({ type: 'ADD_TORRENT_URL', url, options: { paused: true } }, 'Torrent added (paused)');
                    return;
                }
                if (menuItemId.startsWith(SERVER_ITEM_PREFIX)) {
                    const serverId = menuItemId.slice(SERVER_ITEM_PREFIX.length);
                    await this.submit({ type: 'ADD_TORRENT_URL', url, serverId }, 'Torrent added');
                    return;
                }
                if (menuItemId.startsWith(LABEL_ITEM_PREFIX)) {
                    // Re-read canonical settings at click time to avoid a stale label list.
                    const settings = await storage.getItem<AppSettings>('local:options') || DEFAULT_OPTIONS;
                    const labelIndex = parseInt(menuItemId.slice(LABEL_ITEM_PREFIX.length), 10);
                    const label = settings.globals.labels?.[labelIndex];
                    if (!label) {
                        this.notify(false, 'That label no longer exists. Open CTRL settings and try again.');
                        return;
                    }
                    await this.submit({ type: 'ADD_TORRENT_URL', url, options: { label } }, `Torrent added with label: ${label}`);
                    return;
                }
                if (menuItemId.startsWith(PATH_ITEM_PREFIX)) {
                    const pathIndex = parseInt(menuItemId.slice(PATH_ITEM_PREFIX.length), 10);
                    const { activeServer } = await ServerResolver.resolve();
                    const path = activeServer?.directories?.[pathIndex];
                    if (!path || !activeServer?.id) {
                        this.notify(false, 'That folder no longer exists. Open CTRL settings and try again.');
                        return;
                    }
                    await this.submit({ type: 'ADD_TORRENT_URL', url, serverId: activeServer.id, options: { path } }, `Torrent added to folder: ${path}`);
                }
            } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : 'Unknown error';
                console.error('[ContextMenu] add failed:', e);
                this.notify(false, `Failed to add torrent: ${errMsg}`);
            }
        });
    }

    private async submit(request: AddTorrentRequest, successMessage: string): Promise<void> {
        const result = await this.commands.addTorrent(request);
        if (result.ok) {
            this.notify(true, successMessage);
        } else {
            this.notify(false, result.error ?? 'Failed to add torrent.');
        }
    }

    private async notify(success: boolean, message: string) {
        const settings = await storage.getItem<AppSettings>('local:options');
        if (settings?.globals?.enableNotifications === false) {
            return;
        }

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon/default-64.png',
            title: success ? 'CTRL' : 'CTRL — error',
            message: message,
        });
    }
}
