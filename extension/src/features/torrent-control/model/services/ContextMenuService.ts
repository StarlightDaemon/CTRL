import { singleton } from 'tsyringe';
import { storage } from 'wxt/storage';
import { ITorrentClient } from '@/entities/client/model/ITorrentClient';
import { AppSettings, ServerConfig } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { VaultService, SESSION_KEY_KEY, VAULT_DATA_KEY, VAULT_SALT_KEY } from '@/shared/api/security/VaultService';
import { ServerResolver, ResolutionState, ResolvedServers } from '@/shared/api/server/ServerResolver';

const FALLBACK_SESSION_KEY = 'local:session_encryptionKey';

/** Debounce window (ms) — absorbs rapid-fire storage events into one rebuild. */
const REBUILD_DEBOUNCE_MS = navigator.userAgent.includes('Firefox') ? 300 : 200;

/** Last-known-good cache TTL (ms) — prevents transient NO_SERVERS from clearing menus. */
const LAST_GOOD_TTL_MS = 3000;

type VaultState = 'uninitialized' | 'locked' | 'unlocked';

@singleton()
export class ContextMenuService {
    private clientProvider: (serverIndex?: number) => Promise<{ client: ITorrentClient | null, state: ResolutionState }>;

    // Coalescing state
    private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    private isRebuilding = false;
    private pendingRebuild = false;

    // Last-known-good stabilization
    private lastGoodResult: ResolvedServers | null = null;
    private lastGoodTimestamp = 0;
    private lastVaultState: VaultState = 'uninitialized';

    constructor() {
        this.clientProvider = async () => ({ client: null, state: ResolutionState.UNINITIALIZED });
    }

    initialize(clientProvider: (serverIndex?: number) => Promise<{ client: ITorrentClient | null, state: ResolutionState }>) {
        this.clientProvider = clientProvider;
        console.log('[ContextMenu] Initializing ContextMenuService');
        this.scheduleRebuild('initialize', true);
        this.setupListeners();

        // Watch for settings changes to rebuild menus
        storage.watch<AppSettings>('local:options', () => {
            console.log('[ContextMenu] options changed, scheduling rebuild');
            this.scheduleRebuild('options');
        });

        // Watch for Vault Data changes (e.g. servers updated)
        storage.watch(VAULT_DATA_KEY, () => {
            console.log('[ContextMenu] Vault data changed, scheduling rebuild');
            this.scheduleRebuild('vault_data');
        });

        // Watch for Session Key (Unlock/Lock)
        storage.watch(SESSION_KEY_KEY, () => {
            console.log('[ContextMenu] Session key changed, scheduling rebuild');
            this.scheduleRebuild('session_key');
        });

        // [FF Fix] Watch for fallback session key in Firefox
        if (navigator.userAgent.includes('Firefox')) {
            storage.watch(FALLBACK_SESSION_KEY, () => {
                console.log('[ContextMenu] FF Fallback session key changed, scheduling rebuild');
                this.scheduleRebuild('ff_fallback_key');
            });
        }

        // [Fix] Watch for Vault Initialization
        storage.watch(VAULT_SALT_KEY, () => {
            console.log('[ContextMenu] Vault initialization state changed, scheduling rebuild');
            this.scheduleRebuild('vault_salt');
        });

        // Ensure fresh setup on install/update
        chrome.runtime.onInstalled.addListener(() => {
            console.log('[ContextMenu] onInstalled triggered, scheduling rebuild');
            this.scheduleRebuild('onInstalled', true);
        });
    }

    /**
     * Public entry point for external callers (e.g. onStartup in background.ts).
     * Forces an immediate rebuild (no debounce).
     */
    ensureMenus() {
        console.log('[ContextMenu] ensureMenus() called');
        this.scheduleRebuild('ensureMenus', true);
    }

    /**
     * Coalesces multiple rapid triggers into a single rebuild.
     * If `immediate` is true, fires right away (for startup / onInstalled).
     */
    private scheduleRebuild(source: string, immediate = false) {
        console.debug(`[ContextMenu] scheduleRebuild source=${source} immediate=${immediate}`);

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
            console.debug(`[ContextMenu] Absorbing trigger '${source}' into pending debounce`);
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
            console.debug(`[ContextMenu] Using last-known-good (transient ${current.state} within TTL, vault=${this.lastVaultState})`);
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
        mode: number,
        custom: any,
        globals: any
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
                        : 'Setup CTRL to add torrents',
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
        const showAdd = mode === 1 || mode === 2 || (mode === 3 && custom?.addToClient);
        const showPaused = mode === 1 || (mode === 3 && custom?.pauseResume);

        // 1. Add to Torrent Control (Default)
        if (showAdd) {
            items.push({
                id: 'add-torrent',
                title: 'Add to Torrent Control',
                contexts: ['link', 'selection'],
            });

            // 1.5 Scan Page
            items.push({
                id: 'scan-page',
                title: 'Scan Page for Magnets (CTRL)',
                contexts: ['page', 'frame'],
            });
        }

        // 2. Add Paused (if supported)
        if (showPaused) {
            items.push({
                id: 'add-torrent-paused',
                title: 'Add Paused',
                contexts: ['link'],
            });
        }

        // 3. Server Selection (if multiple servers)
        if (servers.length > 1) {
            // 3a. Top Level Servers
            servers.forEach((server: ServerConfig, index: number) => {
                if (server.showInContextMenu) {
                    items.push({
                        id: `add-torrent-server-${index}`,
                        title: `Add to ${server.name}`,
                        contexts: ['link'],
                    });
                }
            });

            // 3b. Submenu Servers (those NOT shown in top level)
            const submenuServers = servers
                .map((server: ServerConfig, index: number) => ({ ...server, originalIndex: index }))
                .filter((server: ServerConfig & { showInContextMenu?: boolean }) => !server.showInContextMenu);

            if (submenuServers.length > 0) {
                items.push({
                    id: 'server-selection',
                    title: 'Add to Server...',
                    contexts: ['link'],
                });

                submenuServers.forEach((server: ServerConfig & { originalIndex: number }) => {
                    items.push({
                        id: `add-torrent-server-${server.originalIndex}`,
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
                title: 'Add with Label...',
                contexts: ['link'],
            });

            globals.labels.forEach((label: string, index: number) => {
                items.push({
                    id: `add-torrent-label-${index}`,
                    parentId: 'label-selection',
                    title: label,
                    contexts: ['link'],
                });
            });
        }

        // 5. Add to Path (Full Menu only)
        const currentServer = servers[globals.currentServer || 0];
        if (mode === 1 && currentServer && currentServer.directories && currentServer.directories.length > 0) {
            items.push({
                id: 'path-selection',
                title: 'Add to Path...',
                contexts: ['link'],
            });

            currentServer.directories.forEach((path: string, index: number) => {
                items.push({
                    id: `add-torrent-path-${index}`,
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
            console.debug(`[ContextMenu] Rebuild already running, marking pending (source=${source})`);
            this.pendingRebuild = true;
            return;
        }

        this.isRebuilding = true;
        this.pendingRebuild = false;

        try {
            console.log(`[ContextMenu] doRebuild() started (source=${source})`);
            const settings = await storage.getItem<AppSettings>('local:options') || DEFAULT_OPTIONS;
            const globals = settings?.globals || DEFAULT_OPTIONS.globals;

            // Carbon radio group can persist string values. Normalize mode so MV3 gating stays stable.
            const parsedMode = Number(globals.contextMenu);
            const mode = Number.isInteger(parsedMode) ? parsedMode : DEFAULT_OPTIONS.globals.contextMenu;
            const custom = globals.contextMenuCustomOptions || DEFAULT_OPTIONS.globals.contextMenuCustomOptions;

            // ── Step 1: Resolver snapshot (single call per rebuild) ──
            const rawResolution = await ServerResolver.resolve();
            console.debug(`[ContextMenu] Resolver snapshot: state=${rawResolution.state} servers=${rawResolution.servers.length}`);

            // ── Step 2: Apply stabilization ──
            const resolution = this.stabilizeResolution(rawResolution);
            console.debug(`[ContextMenu] Effective state=${resolution.state} servers=${resolution.servers.length} mode=${mode}`);

            // ── Step 3: Determine full menu set (pure function, no side effects) ──
            const menuItems = this.determineMenuItems(resolution, mode, custom, globals);
            console.debug(`[ContextMenu] Determined ${menuItems.length} items for state=${resolution.state}`);

            // ── Step 4: ATOMIC replacement ──
            await chrome.contextMenus.removeAll();

            if (menuItems.length > 0) {
                console.debug('[ContextMenu] removeAll completed, creating menu items');
                for (const item of menuItems) {
                    this.safeCreate(item);
                }
                console.debug(`[ContextMenu] Menu rebuild complete — ${menuItems.length} items created`);
            } else {
                console.debug('[ContextMenu] Mode is Hidden — cleared all menus');
            }
        } catch (e) {
            console.error('[ContextMenu] Error in doRebuild:', e);
        } finally {
            this.isRebuilding = false;
            if (this.pendingRebuild) {
                console.debug('[ContextMenu] Processing pending rebuild');
                this.doRebuild('pending');
            }
        }
    }

    private setupListeners() {
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
            if (info.menuItemId === 'unlock-vault' || info.menuItemId === 'open-ctrl') {
                chrome.runtime.openOptionsPage();
                return;
            }

            // [FF MV3 Fix] Re-fetch canonical settings at click time to avoid transient hydration race.
            const settings = await storage.getItem<AppSettings>('local:options') || DEFAULT_OPTIONS;
            const url = info.linkUrl || info.selectionText;

            try {
                if (info.menuItemId === 'scan-page') {
                    if (tab && tab.id) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => {
                                const magnets = Array.from(document.querySelectorAll('a[href^="magnet:"]'))
                                    .map(a => a.getAttribute('href'))
                                    .filter(href => href !== null) as string[];
                                return magnets;
                            }
                        }, async (results) => {
                            const magnets = results?.[0]?.result;
                            if (magnets && magnets.length > 0) {
                                this.notify(true, `Found ${magnets.length} magnets. Adding...`);
                                const { client, state } = await this.clientProvider();
                                if (!client) {
                                    this.notify(false, `Failed to resolve client: ${state}`);
                                    return;
                                }
                                try {
                                    for (const magnet of magnets) {
                                        await client.addTorrentUrl(magnet);
                                    }
                                    this.notify(true, `Added ${magnets.length} torrents.`);
                                } catch (e: unknown) {
                                    const errMsg = e instanceof Error ? e.message : 'Failed to add torrents';
                                    this.notify(false, errMsg);
                                }
                            } else {
                                this.notify(false, 'No magnet links found on this page.');
                            }
                        });
                    }
                    return;
                }

                if (!url) return;

                if (info.menuItemId === 'add-torrent' || info.menuItemId === 'add-torrent-paused') {
                    const { client, state } = await this.clientProvider();
                    if (!client) {
                        this.notify(false, `Failed: ${state}`);
                        return;
                    }
                    const addOptions = info.menuItemId === 'add-torrent-paused' ? { paused: true } : {};
                    await client.addTorrentUrl(url, addOptions);
                    this.notify(true, info.menuItemId === 'add-torrent-paused' ? 'Torrent added (paused)' : 'Torrent added successfully');
                }
                else if (typeof info.menuItemId === 'string') {
                    if (info.menuItemId.startsWith('add-torrent-server-')) {
                        const serverIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        const { client, state } = await this.clientProvider(serverIndex);
                        if (!client) {
                            this.notify(false, `Failed: ${state}`);
                            return;
                        }
                        await client.addTorrentUrl(url);
                        this.notify(true, `Torrent added to server`);
                    }
                    else if (info.menuItemId.startsWith('add-torrent-label-')) {
                        const labelIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        const label = settings.globals.labels[labelIndex];

                        if (label) {
                            const { client, state } = await this.clientProvider();
                            if (!client) {
                                this.notify(false, `Failed: ${state}`);
                                return;
                            }
                            await client.addTorrentUrl(url, { label });
                            this.notify(true, `Torrent added with label: ${label}`);
                        }
                    }
                    else if (info.menuItemId.startsWith('add-torrent-path-')) {
                        const pathIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        const { client, state } = await this.clientProvider();
                        if (!client) {
                            this.notify(false, `Failed: ${state}`);
                            return;
                        }

                        // We still need the server config for path lookup, get it from ServerResolver
                        const { servers } = await ServerResolver.resolve();
                        const currentServer = servers[settings.globals.currentServer || 0];
                        const path = currentServer?.directories[pathIndex];

                        if (path) {
                            await client.addTorrentUrl(url, { path });
                            this.notify(true, `Torrent added to path: ${path}`);
                        }
                    }
                }
            } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : 'Unknown error';
                console.error('Context Menu Error:', e);
                this.notify(false, `Failed to add torrent: ${errMsg}`);
            }
        });
    }

    private async notify(success: boolean, message: string) {
        const settings = await storage.getItem<AppSettings>('local:options');
        if (settings?.globals?.enableNotifications === false) {
            return;
        }

        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon/default-64.png',
            title: success ? 'Torrent Control' : 'Error',
            message: message,
        });
    }
}
