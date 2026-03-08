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
import { VaultService, VAULT_DATA_KEY } from '@/shared/api/security/VaultService';
import { SESSION_KEY_KEY } from '@/shared/api/security/VaultService';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { ServerResolver, ResolutionState } from '@/shared/api/server/ServerResolver';

// HeaderRewriter import removed (DNR Dependency Elimination)

export default defineBackground(() => {
    console.log('Torrent Control: Background Service Worker Initialized (Phase 2 w/ Persistence & Vault)');

    // 1. Initialize Persistence (Cross-Browser)
    LifecycleAdapter.initKeepAlive();

    // [FF MV3 Fix] Clear session fallback on browser startup to maintain "session" semantics
    // Also rebuild context menus — Firefox MV3 does not persist them across restarts.
    chrome.runtime.onStartup.addListener(async () => {
        if (navigator.userAgent.includes('Firefox')) {
            await storage.removeItem('local:session_encryptionKey');
            console.log('[Background] Firefox session fallback cleared on startup.');
        }
        // Rebuild context menus on every cold start (required for Firefox MV3, harmless on Chrome)
        contextMenuService.ensureMenus();
        console.log('[Background] onStartup: context menus rebuild triggered.');
    });

    // DNR dependency removed

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

    // Helper to get client with structured result (Soft-fail)
    const getClientResult = async (serverIndex?: number): Promise<{ client: ITorrentClient | null, state: ResolutionState }> => {
        const { state, servers, activeServer } = await ServerResolver.resolve();

        if (state !== ResolutionState.OK && serverIndex === undefined) {
            return { client: null, state };
        }

        if (serverIndex !== undefined) {
            const target = servers[serverIndex];
            if (!target) return { client: null, state: ResolutionState.INVALID_CONFIG };
            try {
                return { client: await factory.create(target), state: ResolutionState.OK };
            } catch (e) {
                return { client: null, state: ResolutionState.INVALID_CONFIG };
            }
        }

        if (!activeServer) {
            return { client: null, state: ResolutionState.NO_ACTIVE_SERVER };
        }

        // If activeClient already exists, we should still ensure it's not null before proceeding.
        // However, we MUST NOT blindly return it if the activeServer has changed.
        // For simplicity and correctness, we rely on the storage watchers below to clear activeClient.
        if (activeClient) {
            return { client: activeClient, state: ResolutionState.OK };
        }

        try {
            activeClient = await factory.create(activeServer);
            console.log('Background: Client created successfully');
            return { client: activeClient, state: ResolutionState.OK };
        } catch (e) {
            console.error('Background: Factory failed to create client', e);
            return { client: null, state: ResolutionState.INVALID_CONFIG };
        }
    };

    // Initialize Services
    contextMenuService.initialize(getClientResult);

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
            // Resolve current state
            const { state, activeServer } = await ServerResolver.resolve();

            if (state !== ResolutionState.OK) {
                if (state === ResolutionState.LOCKED) {
                    updateBadge();
                }
                activeClient = null;
                return;
            }

            // Ensure connection
            if (!activeClient && activeServer) {
                try {
                    activeClient = await factory.create(activeServer);
                } catch (e) {
                    console.error('Background: Failed to initialize active client:', e);
                    return;
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

    // Watch for Unlock & Vault changes
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

        storage.watch(VAULT_DATA_KEY, (newValue) => {
            if (newValue) {
                console.log('[Background] Vault data changed, clearing active client cache.');
                activeClient = null;
            }
        });
    } catch (e) { console.error('Watch error', e) }


    // Reset loop on settings change
    storage.watch<AppSettings>('local:options', (_newValue) => {
        activeClient = null;
        if (activePorts > 0) startFastPolling();
    });

    // Message Handler
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const handleMessage = async () => {
            try {
                // Attempt to resolve target client
                const getTargetClient = async (): Promise<{ client: ITorrentClient | null, error?: string }> => {
                    if (message.config) {
                        try {
                            return { client: await factory.create(message.config) };
                        } catch (e) {
                            return { client: null, error: e instanceof Error ? e.message : 'Invalid config' };
                        }
                    }

                    const { state, servers, activeServer } = await ServerResolver.resolve();

                    if (state !== ResolutionState.OK) {
                        if (state === ResolutionState.LOCKED || state === ResolutionState.UNINITIALIZED) {
                            if (message.type === 'ADD_TORRENT_URL') {
                                chrome.notifications.create({
                                    type: 'basic',
                                    iconUrl: 'icon/default-64.png',
                                    title: 'Vault Locked',
                                    message: 'Please unlock CTRL to add this torrent.',
                                    priority: 2
                                });
                            }
                            return { client: null, error: 'Vault is locked' };
                        }
                        return { client: null, error: `Resolution failed: ${state}` };
                    }

                    if (typeof message.serverIndex === 'number') {
                        const target = servers[message.serverIndex];
                        if (!target) return { client: null, error: `Server at index ${message.serverIndex} not found.` };
                        return { client: await factory.create(target) };
                    }

                    // Default client
                    try {
                        const { client, state } = await getClientResult();
                        return { client, error: client ? undefined : `Resolution failed: ${state}` };
                    } catch (e) {
                        return { client: null, error: e instanceof Error ? e.message : 'Client creation failed' };
                    }
                };

                // NEW: Viewport Control (Keep as is since it doesn't need client)
                if (message.type === 'UPDATE_VIEWPORT') {
                    if (message.data && typeof message.data.start === 'number') {
                        const end = message.data.end || (message.data.start + 50);
                        viewportManager.setViewport(message.data.start, end);
                    }
                    return { success: true };
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

                const { client, error } = await getTargetClient();
                if (error || !client) {
                    return { error };
                }

                switch (message.type) {
                    case 'GET_TORRENTS':
                        return await client.getTorrents();

                    case 'ADD_TORRENT_URL': {
                        const currentSettings = await storage.getItem<AppSettings>('local:options');
                        const globalAddPaused = currentSettings?.globals.addPaused ?? false;
                        const options = {
                            ...message.options,
                            paused: message.options?.paused ?? globalAddPaused
                        };

                        const result = await client.addTorrentUrl(message.url, options);
                        performCheck(); // Force refresh
                        return result;
                    }

                    case 'PAUSE_TORRENT': {
                        const pResult = await client.pauseTorrent(message.id);
                        performCheck();
                        return pResult;
                    }

                    case 'RESUME_TORRENT': {
                        const rResult = await client.resumeTorrent(message.id);
                        performCheck();
                        return rResult;
                    }

                    case 'REMOVE_TORRENT': {
                        const dResult = await client.removeTorrent(message.id, message.deleteData);
                        performCheck();
                        return dResult;
                    }

                    case 'FORCE_REFRESH':
                        await performCheck();
                        break;

                    case 'TEST_CONNECTION':
                    case 'TEST_CONNECTION_SERVER': {
                        if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) {
                            console.log('[Background] TEST_CONNECTION received. Type:', message.config?.type);
                        }
                        const result = await client.testConnection();
                        const r = result as any;
                        console.info(JSON.stringify({
                            event: 'TEST_CONNECTION_RESULT',
                            messageType: message.type,
                            hostnameTested: message.config?.hostname || 'unknown_persisted',
                            configSource: message.config ? 'message.config' : 'ServerResolver',
                            adapterType: client.constructor.name,
                            resultShape: result === true ? 'true' : result === false ? 'false' : (r && typeof r === 'object' && r.error ? '{error}' : 'unknown'),
                            errorMessage: r && typeof r === 'object' && r.error ? r.error : null
                        }));
                        return result;
                    }

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
            } finally {
                // DNR dependency removed
            }
        };

        handleMessage().then(sendResponse);
        return true;
    });



});
