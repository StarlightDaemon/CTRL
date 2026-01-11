import 'reflect-metadata';
import { defineBackground } from 'wxt/sandbox';
import { storage } from 'wxt/storage';
import { ClientFactory } from '@/entities/client/lib/ClientFactory'; // New Dynamic Factory
import { ContextMenuService } from '../features/torrent-control/model/services/ContextMenuService';
import { ITorrentClient } from '@/entities/client/model/ITorrentClient'; // New Interface
import { ServerConfig, AppSettings } from '@/shared/lib/types';
import { LifecycleAdapter } from '../features/torrent-control/services/LifecycleAdapter';
import { StateHydrator } from '../features/torrent-control/services/StateHydrator';
import { ViewportManager } from '../features/torrent-control/services/ViewportManager';
import { Torrent } from '../entities/torrent/model/Torrent';
import { VaultService } from '@/shared/api/security/VaultService';
import { SESSION_KEY_KEY } from '@/shared/api/security/VaultService';
import { OffscreenManager } from '../features/torrent-control/model/services/OffscreenManager';
import { HeaderRewriter } from '@/shared/api/network/HeaderRewriter';

export default defineBackground(() => {
    console.log('Torrent Control: Background Service Worker Initialized (Phase 2 w/ Persistence & Vault)');

    // 1. Initialize Persistence (Cross-Browser)
    LifecycleAdapter.initKeepAlive();

    const factory = new ClientFactory();
    const contextMenuService = new ContextMenuService();
    const viewportManager = new ViewportManager();
    let activeClient: ITorrentClient | null = null;

    // 2. Initialize Hydration (Restore state immediately on wake)
    StateHydrator.hydrate<Torrent[]>().then(data => {
        if (data && data.length > 0) {
            console.log(`[Hydration] Restored ${data.length} torrents from session storage.`);
            viewportManager.updateTorrents(data);
        }
    });

    // Helper to get current client
    const getClient = async (serverIndex?: number): Promise<ITorrentClient> => {
        // Retrieve decrypted servers from Vault
        let servers: ServerConfig[] = [];
        let isLocked = false;
        try {
            servers = await VaultService.getServers();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            if (message === 'Vault is locked') {
                isLocked = true;
            } else {
                console.error('Vault access error:', e);
            }
        }

        if (isLocked || !servers.length) {
            // Check legacy if vault is empty? 
            // Phase 1 migration assumes we moved data.
            // If locked and we need credentials, prompt user.
            // But we can't prompt easily from here except generic notification if user initiated action.
            if (isLocked) {
                // If this request came from a user action (like context menu), we should throw specific error.
                // But for polling, we just return null or throw.
                throw new Error('Vault is locked');
            }
            throw new Error('No configuration found');
        }

        // We have decrypted servers
        const settings = await storage.getItem<AppSettings>('local:options');
        if (!settings) throw new Error('No configuration found');

        if (serverIndex !== undefined) {
            if (!servers[serverIndex]) throw new Error('Invalid server index');
            return await factory.create(servers[serverIndex]);
        }

        if (activeClient) {
            return activeClient;
        }

        const currentServer = servers[settings.globals.currentServer || 0];
        if (!currentServer) throw new Error('No configuration found');

        try {
            // Configure rules for ALL servers to support concurrent access/switching
            await HeaderRewriter.configure(servers);

            activeClient = await factory.create(currentServer);
            console.log('Background: Client created successfully');
        } catch (e) {
            console.error('Background: Factory failed to create client', e);
            throw e;
        }
        return activeClient!;
    };

    // Initialize Services
    contextMenuService.initialize(getClient);

    // Badge Update Logic
    const updateBadge = async (torrents?: Torrent[]) => {
        try {
            const settings = await storage.getItem<AppSettings>('local:options');
            if (!settings || settings.globals.badgeInfo === 'none') {
                chrome.action.setBadgeText({ text: '' });
                return;
            }

            // If no data passed, we might skip to avoid double fetch in this architecture, 
            // or fetch if called outside the loop.
            if (!torrents && activeClient) {
                try {
                    torrents = await activeClient.getTorrents();
                } catch { return; }
            }

            if (torrents) {
                if (settings.globals.badgeInfo === 'count') {
                    const activeCount = torrents.filter(t => (t.status as string) === 'downloading' || (t.status as string) === 'seeding').length;
                    chrome.action.setBadgeText({ text: activeCount > 0 ? activeCount.toString() : '' });
                    chrome.action.setBadgeBackgroundColor({ color: '#3B82F6' }); // Blue
                } else if (settings.globals.badgeInfo === 'speed') {
                    const totalSpeed = torrents.reduce((acc, t) => acc + t.downloadSpeed, 0);
                    if (totalSpeed > 0) {
                        let speedText = '';
                        if (totalSpeed < 1024) speedText = `${totalSpeed}B`;
                        else if (totalSpeed < 1024 * 1024) speedText = `${(totalSpeed / 1024).toFixed(0)}K`;
                        else speedText = `${(totalSpeed / (1024 * 1024)).toFixed(1)}M`;
                        chrome.action.setBadgeText({ text: speedText });
                        chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // Green
                    } else {
                        chrome.action.setBadgeText({ text: '' });
                    }
                }
            }
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            if (message === 'No configuration found' || message === 'Vault is locked') {
                chrome.action.setBadgeText({ text: 'Lock' }); // Indicator
                chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
                return;
            }
            console.error('Failed to update badge:', e);
            chrome.action.setBadgeText({ text: '!' });
            chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
        }
    };

    // 3. Lifecycle & Polling Logic (Lite Architecture)
    // ------------------------------------------------
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    let activePorts = 0;

    const performCheck = async () => {
        try {
            // Ensure connection
            if (!activeClient) {
                try {
                    await getClient();
                } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : String(e);
                    if (message === 'Vault is locked') {
                        updateBadge();
                        return;
                    }
                }
            }

            if (activeClient) {
                const torrents = await activeClient.getTorrents();
                viewportManager.updateTorrents(torrents);
                updateBadge(torrents);

                if (torrents) {
                    const totalDl = torrents.reduce((acc, t) => acc + t.downloadSpeed, 0);
                    const totalUl = torrents.reduce((acc, t) => acc + t.uploadSpeed, 0);
                    const active = torrents.filter(t => (t.status as string) === 'downloading' || (t.status as string) === 'seeding').length;

                    chrome.runtime.sendMessage({
                        type: 'STATS_UPDATE',
                        data: { downloadSpeed: totalDl, uploadSpeed: totalUl, activeCount: active }
                    }).catch(() => { });
                }
            }
        } catch (e) {
            console.error('Check error:', e);
        }
    };

    // Fast Polling (Foreground)
    const startFastPolling = () => {
        if (pollingInterval) return; // Already running
        console.log('Background: Starting Fast Polling (Active Session)');

        // Immediate check
        performCheck();

        pollingInterval = setInterval(performCheck, 2000);
    };

    const stopFastPolling = () => {
        if (pollingInterval) {
            console.log('Background: Stopping Fast Polling (Idle)');
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };

    // Port Listener (The "Switch")
    chrome.runtime.onConnect.addListener((port) => {
        if (port.name === 'ctrl-active-session') {
            activePorts++;
            startFastPolling();

            port.onDisconnect.addListener(() => {
                activePorts--;
                if (activePorts <= 0) {
                    activePorts = 0;
                    stopFastPolling();
                }
            });
        }
    });

    // Alarm Listener (Background "Heartbeat")
    chrome.alarms.create('packet_beat', { periodInMinutes: 1 });
    chrome.alarms.onAlarm.addListener((alarm) => {
        if (alarm.name === 'packet_beat') {
            // Only run if NOT fast polling (avoid double fetch)
            if (activePorts === 0) {
                console.log('Background: Alarm Beat');
                performCheck();
            }
        }
    });

    // Initial check on load (in case of event wake)
    if (activePorts > 0) startFastPolling();

    // ------------------------------------------------

    // Watch for Unlock
    try {
        storage.watch(SESSION_KEY_KEY, (newValue) => {
            if (newValue) {
                activeClient = null;
                // If UI is open, this will trigger fast poll next tick
                if (activePorts > 0) startFastPolling();
                else performCheck();
            } else {
                activeClient = null;
                updateBadge();
            }
        });
    } catch (e) { console.error('Watch error', e) }


    // Reset loop on settings change
    storage.watch<AppSettings>('local:options', (newValue) => {
        activeClient = null;
        if (activePorts > 0) startFastPolling();
    });

    // Message Handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handleMessage = async () => {
            try {
                const getTargetClient = async (): Promise<ITorrentClient> => {
                    if (message.config) {
                        await HeaderRewriter.configureTemporary(message.config.hostname);
                        return await factory.create(message.config);
                    }
                    if (typeof message.serverIndex === 'number') {
                        return await getClient(message.serverIndex);
                    }
                    return await getClient();
                };

                // NEW: Viewport Control
                if (message.type === 'UPDATE_VIEWPORT') {
                    if (message.data && typeof message.data.start === 'number') {
                        const end = message.data.end || (message.data.start + 50);
                        viewportManager.setViewport(message.data.start, end);
                    }
                    return { success: true };
                }

                if (message.type === 'PING_GLOBAL') {
                    const targets: Record<string, string> = {
                        'google': 'https://www.google.com/generate_204',
                        'cloudflare': 'https://1.1.1.1',
                        'baidu': 'https://www.baidu.com',
                        'yandex': 'https://yandex.ru'
                    };
                    const url = targets[message.target] || targets['google'];
                    const start = Date.now();
                    try {
                        await fetch(url, { method: 'HEAD', cache: 'no-store', mode: 'no-cors' });
                        return Date.now() - start;
                    } catch { return -1; }
                }

                if (message.type === 'KEEP_ALIVE_PING') {
                    return { status: 'alive' };
                }

                if (message.type === 'SELF_TEST') {
                    return {
                        status: 'ok',
                        version: chrome.runtime.getManifest().version,
                        uptime: performance.now(),
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language
                    };
                }

                // Attempt to get client
                let client;
                try {
                    client = await getTargetClient();
                } catch (e: unknown) {
                    const errMsg = e instanceof Error ? e.message : String(e);
                    if (errMsg === 'Vault is locked') {
                        if (message.type === 'ADD_TORRENT_URL') {
                            chrome.notifications.create({
                                type: 'basic',
                                iconUrl: 'icon/default-64.png',
                                title: 'Vault Locked',
                                message: 'Please unlock CTRL to add this torrent.',
                                priority: 2
                            });
                        }
                        return { error: 'Vault is locked' };
                    }
                    throw e;
                }

                switch (message.type) {
                    case 'GET_TORRENTS':
                        return await client.getTorrents();

                    case 'ADD_TORRENT_URL':
                        const currentSettings = await storage.getItem<AppSettings>('local:options');
                        const globalAddPaused = currentSettings?.globals.addPaused ?? false;
                        const options = {
                            ...message.options,
                            paused: message.options?.paused ?? globalAddPaused
                        };

                        const result = await client.addTorrentUrl(message.url, options);
                        performCheck(); // Force refresh
                        return result;

                    case 'PAUSE_TORRENT':
                        const pResult = await client.pauseTorrent(message.id);
                        performCheck();
                        return pResult;

                    case 'RESUME_TORRENT':
                        const rResult = await client.resumeTorrent(message.id);
                        performCheck();
                        return rResult;

                    case 'REMOVE_TORRENT':
                        const dResult = await client.removeTorrent(message.id, message.deleteData);
                        performCheck();
                        return dResult;

                    case 'FORCE_REFRESH':
                        await performCheck();
                        break;

                    case 'TEST_CONNECTION':
                    case 'TEST_CONNECTION_SERVER':
                        return await client.testConnection();

                    case 'PING':
                    case 'PING_SERVER':
                        return await client.ping();

                    default:
                        throw new Error(`Unknown message type: ${message.type}`);
                }
            } catch (e: unknown) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                console.error('Background Error:', e);
                return { error: errorMessage };
            }
        };

        handleMessage().then(sendResponse);
        return true;
    });

    // Download Handler
    chrome.downloads.onCreated.addListener(async (downloadItem) => {
        const settings = await storage.getItem<AppSettings>('local:options');
        if (!settings?.globals.catchTorrents) return;
        const isTorrent = downloadItem.filename.endsWith('.torrent') || downloadItem.mime === 'application/x-bittorrent';
        if (!isTorrent) return;
        chrome.downloads.cancel(downloadItem.id);

        try {
            const client = await getClient();
            await client.addTorrentUrl(downloadItem.url);
            performCheck();
            if (settings.globals.enableNotifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon/default-64.png',
                    title: 'Torrent Control',
                    message: `Intercepted and added: ${downloadItem.filename}`
                });
            }
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            let msg = `Failed to add torrent: ${errorMessage}`;
            if (errorMessage === 'Vault is locked') msg = 'Vault is locked. Please unlock extension.';
            if (settings.globals.enableNotifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icon/default-64.png',
                    title: 'Torrent Control',
                    message: msg
                });
            }
        }
    });

});
