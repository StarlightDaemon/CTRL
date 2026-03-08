import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { ServerConfig } from '@/shared/lib/types';
import { DelugeRpcResponseSchema, DelugeUpdateUiSchema, DelugeHostsListSchema, DelugeTorrent, DelugeWebPlugins, DelugeWebPluginsSchema, DelugeMethodsSchema, DelugeTorrentOptions, DelugeFilePriority, DelugeFile, DelugePeer, DelugeTracker, DelugePeerSchema, DelugeTrackerSchema } from './DelugeSchema';

/**
 * Deluge JSON-RPC Error Codes
 * Reference: Deluge Web API documentation
 */
export const DelugeErrorCodes = {
    NOT_AUTHENTICATED: 1,
    UNKNOWN_METHOD: 2,
    INTERNAL_ERROR: 3,
    RPC_FAILED: 4,
    AUTH_LEVEL_LOW: 5,
} as const;

export type DelugeErrorCode = typeof DelugeErrorCodes[keyof typeof DelugeErrorCodes];

@injectable()
export class DelugeAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;
    private requestId = 0;

    /** Request timeout in milliseconds */
    private static readonly REQUEST_TIMEOUT_MS = 30000;
    /** Connection cache TTL in milliseconds */
    private static readonly CONNECTION_CACHE_TTL = 5000;

    private daemonConnected: boolean = false;
    private lastConnectionCheck: number = 0;
    /** Cached daemon version for compatibility checks */
    private cachedVersion: string | null = null;

    constructor(config: ServerConfig) {
        this.config = config;
        this.baseUrl = `${config.hostname.replace(/\/$/, '')}/json`;
        this.client = new FetchHttpClient(this.baseUrl);
    }

    private nextId() {
        return ++this.requestId;
    }

    /**
     * Generic wrapper for Deluge JSON-RPC calls.
     * Handles payload construction and basic error parsing.
     * @internal Exposed for plugin classes to use directly.
     */
    /**
     * Generic wrapper for Deluge JSON-RPC calls.
     * Includes timeout protection and structured error parsing.
     * @internal Exposed for plugin classes to use directly.
     */
    protected async call<T>(method: string, params: unknown[] = []): Promise<T> {
        const payload = {
            method,
            params,
            id: this.nextId()
        };

        // Set up timeout protection via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            DelugeAdapter.REQUEST_TIMEOUT_MS
        );

        try {
            const response = await this.client.post<any>('', payload, {
                signal: controller.signal
            });

            // Parse RPC Wrapper with structured error handling
            if (response.error) {
                const errorCode = response.error.code as DelugeErrorCode | undefined;
                const errorMessage = response.error.message || `Error code ${errorCode}`;
                const error = new Error(`Deluge RPC Error (${errorCode}): ${errorMessage}`);
                (error as any).code = errorCode;
                throw error;
            }

            return response.result as T;
        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') {
                throw new Error(`Deluge request timeout after ${DelugeAdapter.REQUEST_TIMEOUT_MS}ms`);
            }
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Checks if the current session is valid.
     * Useful for "check before login" pattern to avoid session thrashing.
     */
    async checkSession(): Promise<boolean> {
        try {
            return await this.call<boolean>('auth.check_session');
        } catch {
            return false;
        }
    }

    /**
     * Ensures daemon connection is established (Gate 2).
     * Separate from authentication (Gate 1) per Two-Gate Architecture.
     */
    private async ensureDaemonConnection(): Promise<void> {
        const now = Date.now();
        if ((now - this.lastConnectionCheck) < DelugeAdapter.CONNECTION_CACHE_TTL) {
            if (this.daemonConnected) return;
        }

        const isConnected = await this.call<boolean>('web.connected');
        this.daemonConnected = isConnected;
        this.lastConnectionCheck = now;

        if (isConnected) return;

        // Get available hosts
        const hosts = await this.call<any[]>('web.get_hosts');
        if (!hosts || hosts.length === 0) {
            throw new Error('No Deluge Daemons available');
        }

        // Default to first host (tuple[0] is ID)
        const hostId = hosts[0][0];

        const hostStatus = await this.call<[string, string, string?]>('web.get_host_status', [hostId]);
        const status = hostStatus[1]?.toLowerCase();
        if (status !== 'online' && status !== 'connected') {
            throw new Error(`Deluge daemon is offline: ${hosts[0][1]}:${hosts[0][2]}`);
        }

        await this.call('web.connect', [hostId]);
        this.daemonConnected = true;
    }

    /**
     * The Multi-Step Handshake
     * Gate 1: Web Authentication
     * Gate 2: Daemon Connection
     */
    async login(): Promise<void> {
        console.log('[Deluge] Starting Handshake...');

        // Gate 1: Web Authentication
        const loginRes = await this.call<boolean>('auth.login', [this.config.password]);
        if (!loginRes) {
            throw new Error('Authentication Failed');
        }

        // Gate 2: Daemon Connection
        await this.ensureDaemonConnection();

        console.log('[Deluge] Handshake Complete');
    }

    async logout(): Promise<void> {
        await this.call('auth.delete_session');
    }

    /**
     * Helper to handle re-auth loop with "check before login" pattern.
     * Distinguishes between session expiry and daemon disconnection.
     * @internal Exposed for plugin classes to use directly.
     */
    protected async ensureAuth<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (e: unknown) {
            const errorCode = (e as any)?.code;
            const message = e instanceof Error ? e.message : String(e);

            // Check for authentication errors (code 1 or message patterns)
            const isAuthError =
                errorCode === DelugeErrorCodes.NOT_AUTHENTICATED ||
                message.includes('Not authenticated') ||
                message.includes('Error (1)');

            if (isAuthError) {
                console.log('[Deluge] Auth error detected, checking session...');

                // Check if session is still valid (might be daemon connection issue)
                const sessionValid = await this.checkSession();
                if (sessionValid) {
                    console.log('[Deluge] Session valid, reconnecting daemon...');
                    await this.ensureDaemonConnection();
                    return await action();
                }

                console.log('[Deluge] Session expired, re-authenticating...');
                await this.login();
                return await action();
            }

            // Handle daemon disconnection (code 2 = unknown method often means disconnected)
            if (errorCode === DelugeErrorCodes.UNKNOWN_METHOD && message.includes('core.')) {
                console.log('[Deluge] Daemon disconnected, reconnecting...');
                await this.ensureDaemonConnection();
                return await action();
            }

            throw e;
        }
    }

    async getTorrents(): Promise<Torrent[]> {
        return this.ensureAuth(async () => {
            const keys = [
                "name", "state", "progress", "eta",
                "download_payload_rate", "upload_payload_rate",
                "total_size", "hash", "save_path", "ratio", "queue",
                "time_added", "label" // Extended fields
            ];

            const response = await this.call<any>('web.update_ui', [keys, {}]);
            const validated = DelugeUpdateUiSchema.parse(response);

            if (!validated.torrents) return [];

            return Object.values(validated.torrents).map(t => this.mapTorrent(t));
        });
    }

    /**
     * Gets torrents matching filter criteria.
     * More efficient than fetching all and filtering client-side.
     */
    async getTorrentsFiltered(filter: {
        state?: string;
        label?: string;
        tracker_host?: string;
    }): Promise<Torrent[]> {
        return this.ensureAuth(async () => {
            const keys = [
                "name", "state", "progress", "eta",
                "download_payload_rate", "upload_payload_rate",
                "total_size", "hash", "save_path", "ratio", "queue",
                "time_added", "label"
            ];
            const filterDict: Record<string, string> = {};
            if (filter.state) filterDict.state = filter.state;
            if (filter.label) filterDict.label = filter.label;
            if (filter.tracker_host) filterDict.tracker_host = filter.tracker_host;

            const response = await this.call<any>('web.update_ui', [keys, filterDict]);
            const validated = DelugeUpdateUiSchema.parse(response);

            if (!validated.torrents) return [];
            return Object.values(validated.torrents).map(t => this.mapTorrent(t));
        });
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.ensureAuth(async () => {
            const delugeOptions = {
                add_paused: options?.paused ?? false,
                download_location: options?.path
            };

            // path is "core.add_torrent_url"
            // params: [url, options, headers]
            await this.call('core.add_torrent_url', [url, delugeOptions, {}]);
        });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        await this.ensureAuth(async () => {
            const base64 = await this.blobToBase64(file);
            const delugeOptions = {
                add_paused: options?.paused ?? false,
                download_location: options?.path
            };

            // params: [filename, base64_content, options]
            // Filename must be present.
            const filename = 'upload.torrent';

            await this.call('core.add_torrent_file', [filename, base64, delugeOptions]);
        });
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.ensureAuth(async () => this.call('core.pause_torrent', [[id]]));
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.ensureAuth(async () => this.call('core.resume_torrent', [[id]]));
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        // Deluge remove_torrent takes [id, remove_data (bool)]
        await this.ensureAuth(async () => this.call('core.remove_torrent', [id, deleteData ?? false]));
    }

    /**
     * Removes multiple torrents efficiently.
     * Uses core.remove_torrents (plural) on Deluge 2.x for session-file efficiency.
     * Falls back to individual removal on older versions.
     */
    async removeTorrents(ids: string[], deleteData: boolean = false): Promise<void> {
        await this.ensureAuth(async () => {
            const is2x = await this.is2xOrHigher();
            if (is2x) {
                // Deluge 2.x batch removal - single session file write
                await this.call('core.remove_torrents', [ids, deleteData]);
            } else {
                // Fallback for 1.x - individual removal
                for (const id of ids) {
                    await this.call('core.remove_torrent', [id, deleteData]);
                }
            }
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch (e) {
            console.error('[Deluge] Test Failed:', e);
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('web.connected');
        return Date.now() - start;
    }

    // Categories in Deluge are "Labels" (Plugin). 
    // This requires the 'Label' plugin to be enabled.
    async getCategories(): Promise<string[]> {
        return this.ensureAuth(async () => {
            try {
                // label.get_labels
                const labels = await this.call<string[]>('label.get_labels');
                return labels || [];
            } catch (e) {
                // Plugin might not be enabled
                return [];
            }
        });
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('label.set_torrent', [hash, category]);
        });
    }

    async getTags(): Promise<string[]> {
        return []; // Deluge uses Labels, mapped to Categories. Tags are not distinct in v1/v2 core.
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // No-op
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // No-op
    }

    // =====================================================
    // Phase 1: Plugin Infrastructure & Detection
    // =====================================================

    /**
     * Discovers available RPC methods from the daemon.
     * Uses system.listMethods for introspection.
     */
    async discoverMethods(): Promise<string[]> {
        return this.ensureAuth(async () => {
            const methods = await this.call<string[]>('system.listMethods');
            return DelugeMethodsSchema.parse(methods);
        });
    }

    /**
     * Gets the list of enabled core plugins.
     */
    async getEnabledPlugins(): Promise<string[]> {
        return this.ensureAuth(async () => {
            const plugins = await this.call<string[]>('core.get_enabled_plugins');
            return plugins || [];
        });
    }

    /**
     * Checks if a specific plugin is enabled.
     */
    async isPluginEnabled(pluginName: string): Promise<boolean> {
        const enabledPlugins = await this.getEnabledPlugins();
        return enabledPlugins.includes(pluginName);
    }

    /**
     * Gets WebUI plugin information.
     */
    async getWebPlugins(): Promise<DelugeWebPlugins> {
        return this.ensureAuth(async () => {
            const result = await this.call<any>('web.get_plugins');
            return DelugeWebPluginsSchema.parse(result);
        });
    }

    /**
     * Checks for plugin availability by namespace prefix in available methods.
     */
    async hasPluginMethods(namespace: string): Promise<boolean> {
        const methods = await this.discoverMethods();
        return methods.some(m => m.startsWith(`${namespace}.`));
    }

    // =====================================================
    // Phase 2: Advanced Torrent Management
    // =====================================================

    /**
     * Moves torrent data to a new location.
     * Calls core.move_storage.
     */
    async moveStorage(torrentIds: string[], destPath: string): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.move_storage', [torrentIds, destPath]);
        });
    }

    /**
     * Renames files within a torrent.
     * @param renames - Array of [fileIndex, newName] tuples
     */
    async renameFiles(torrentId: string, renames: [number, string][]): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.rename_files', [torrentId, renames]);
        });
    }

    /**
     * Renames a folder within a torrent.
     */
    async renameFolder(torrentId: string, oldPath: string, newPath: string): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.rename_folder', [torrentId, oldPath, newPath]);
        });
    }

    /**
     * Sets options for one or more torrents.
     */
    async setTorrentOptions(torrentIds: string[], options: DelugeTorrentOptions): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.set_torrent_options', [torrentIds, options]);
        });
    }

    /**
     * Gets available free space at a path.
     * @returns Free space in bytes
     */
    async getFreeSpace(path?: string): Promise<number> {
        return this.ensureAuth(async () => {
            const params = path ? [path] : [];
            return await this.call<number>('core.get_free_space', params);
        });
    }

    /**
     * Gets the global daemon configuration.
     */
    async getConfig(): Promise<Record<string, unknown>> {
        return this.ensureAuth(async () => {
            return await this.call<Record<string, unknown>>('core.get_config');
        });
    }

    /**
     * Sets global daemon configuration values.
     */
    async setConfig(config: Record<string, unknown>): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.set_config', [config]);
        });
    }

    /**
     * Gets daemon version information.
     */
    async getVersion(): Promise<string> {
        return this.ensureAuth(async () => {
            return await this.call<string>('daemon.info');
        });
    }

    /**
     * Checks if the daemon is version 2.x or higher.
     * Uses cached version for efficiency.
     */
    async is2xOrHigher(): Promise<boolean> {
        try {
            if (!this.cachedVersion) {
                this.cachedVersion = await this.getVersion();
            }
            const major = parseInt(this.cachedVersion.split('.')[0], 10);
            return major >= 2;
        } catch {
            return false;
        }
    }

    /**
     * Gets the cached daemon version.
     */
    async getVersionCached(): Promise<string> {
        if (!this.cachedVersion) {
            this.cachedVersion = await this.getVersion();
        }
        return this.cachedVersion;
    }

    // =====================================================
    // Phase 3: Host Status Inspection
    // =====================================================

    /**
     * Gets all available daemon hosts with their current status.
     */
    async getAvailableHosts(): Promise<Array<{
        id: string;
        hostname: string;
        port: number;
        status: string;
    }>> {
        return this.ensureAuth(async () => {
            const hosts = await this.call<any[]>('web.get_hosts');
            return hosts.map(h => ({
                id: h[0],
                hostname: h[1],
                port: h[2],
                status: h[3] || 'Unknown',
            }));
        });
    }

    /**
     * Checks the status of a specific daemon host.
     * Returns status and version if available.
     */
    async getHostStatus(hostId: string): Promise<{ status: string; version?: string }> {
        return this.ensureAuth(async () => {
            const result = await this.call<[string, string, string?]>('web.get_host_status', [hostId]);
            return {
                status: result[1],
                version: result[2],
            };
        });
    }

    // =====================================================
    // Phase 2: File Management & Priorities
    // =====================================================

    /**
     * Gets files for a specific torrent with their priorities and progress.
     */
    async getFiles(torrentId: string): Promise<Array<DelugeFile & { progress: number; priority: DelugeFilePriority }>> {
        return this.ensureAuth(async () => {
            const status = await this.call<any>('core.get_torrent_status', [
                torrentId,
                ['files', 'file_priorities', 'file_progress']
            ]);

            const files = status.files || [];
            const priorities = status.file_priorities || [];
            const progress = status.file_progress || [];

            return files.map((f: any, i: number) => ({
                index: f.index ?? i,
                path: f.path,
                size: f.size,
                offset: f.offset ?? 0,
                progress: progress[i] ?? 0,
                priority: (priorities[i] ?? 1) as DelugeFilePriority,
            }));
        });
    }

    /**
     * Sets file priorities for a torrent.
     * @param priorities - Array of priorities matching file indices (0=skip, 1=normal, 5=high, 7=highest)
     */
    async setFilePriorities(torrentId: string, priorities: DelugeFilePriority[]): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.set_torrent_options', [
                [torrentId],
                { file_priorities: priorities }
            ]);
        });
    }

    // =====================================================
    // Phase 2: Peer & Tracker Inspection
    // =====================================================

    /**
     * Gets peer information for a specific torrent.
     */
    async getPeers(torrentId: string): Promise<DelugePeer[]> {
        return this.ensureAuth(async () => {
            const status = await this.call<any>('core.get_torrent_status', [
                torrentId,
                ['peers']
            ]);
            const peers = status.peers || [];
            return peers.map((p: any) => DelugePeerSchema.parse(p));
        });
    }

    /**
     * Gets tracker information for a specific torrent.
     */
    async getTrackers(torrentId: string): Promise<DelugeTracker[]> {
        return this.ensureAuth(async () => {
            const status = await this.call<any>('core.get_torrent_status', [
                torrentId,
                ['trackers']
            ]);
            const trackers = status.trackers || [];
            return trackers.map((t: any) => DelugeTrackerSchema.parse(t));
        });
    }

    /**
     * Sets trackers for a torrent. This REPLACES the existing tracker list.
     * To add a tracker, first fetch existing trackers, append, then set.
     */
    async setTrackers(torrentId: string, trackers: { url: string; tier: number }[]): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.set_torrent_trackers', [torrentId, trackers]);
        });
    }

    // =====================================================
    // Phase 2: Force Recheck & Queue Manipulation
    // =====================================================

    /**
     * Forces a hash recheck on the specified torrents.
     */
    async forceRecheck(ids: string[]): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('core.force_recheck', [ids]);
        });
    }

    /**
     * Moves torrents to the top of the queue.
     */
    async queueTop(ids: string[]): Promise<void> {
        await this.ensureAuth(async () => this.call('core.queue_top', [ids]));
    }

    /**
     * Moves torrents up one position in the queue.
     */
    async queueUp(ids: string[]): Promise<void> {
        await this.ensureAuth(async () => this.call('core.queue_up', [ids]));
    }

    /**
     * Moves torrents down one position in the queue.
     */
    async queueDown(ids: string[]): Promise<void> {
        await this.ensureAuth(async () => this.call('core.queue_down', [ids]));
    }

    /**
     * Moves torrents to the bottom of the queue.
     */
    async queueBottom(ids: string[]): Promise<void> {
        await this.ensureAuth(async () => this.call('core.queue_bottom', [ids]));
    }

    // =====================================================
    // Phase 2: Label Plugin Expansion
    // =====================================================

    /**
     * Adds a new label. Requires Label plugin.
     */
    async addLabel(label: string): Promise<void> {
        await this.ensureAuth(async () => this.call('label.add', [label]));
    }

    /**
     * Removes a label. Requires Label plugin.
     */
    async removeLabel(label: string): Promise<void> {
        await this.ensureAuth(async () => this.call('label.remove', [label]));
    }

    /**
     * Gets options for a specific label. Requires Label plugin.
     */
    async getLabelOptions(label: string): Promise<Record<string, unknown>> {
        return this.ensureAuth(async () =>
            this.call<Record<string, unknown>>('label.get_options', [label])
        );
    }

    /**
     * Sets options for a specific label. Requires Label plugin.
     * Options can include: download_location, max_download_speed, max_upload_speed, etc.
     */
    async setLabelOptions(label: string, options: Record<string, unknown>): Promise<void> {
        await this.ensureAuth(async () => this.call('label.set_options', [label, options]));
    }

    // =====================================================
    // Event Poller Factory
    // =====================================================

    private eventPoller?: import('./DelugeEventPoller').DelugeEventPoller;

    /**
     * Gets or creates the event poller instance.
     */
    async getEventPoller(): Promise<import('./DelugeEventPoller').DelugeEventPoller> {
        if (!this.eventPoller) {
            const { DelugeEventPoller } = await import('./DelugeEventPoller');
            this.eventPoller = new DelugeEventPoller(this);
        }
        return this.eventPoller;
    }

    // =====================================================
    // Plugin Factories
    // =====================================================

    /**
     * Gets or creates an AutoAdd plugin instance.
     */
    async getAutoAddPlugin(): Promise<import('./plugins/DelugeAutoAddPlugin').DelugeAutoAddPlugin> {
        const { DelugeAutoAddPlugin } = await import('./plugins/DelugeAutoAddPlugin');
        return new DelugeAutoAddPlugin(this);
    }

    /**
     * Gets or creates a Scheduler plugin instance.
     */
    async getSchedulerPlugin(): Promise<import('./plugins/DelugeSchedulerPlugin').DelugeSchedulerPlugin> {
        const { DelugeSchedulerPlugin } = await import('./plugins/DelugeSchedulerPlugin');
        return new DelugeSchedulerPlugin(this);
    }

    /**
     * Gets or creates an Execute plugin instance.
     */
    async getExecutePlugin(): Promise<import('./plugins/DelugeExecutePlugin').DelugeExecutePlugin> {
        const { DelugeExecutePlugin } = await import('./plugins/DelugeExecutePlugin');
        return new DelugeExecutePlugin(this);
    }

    private mapTorrent(t: DelugeTorrent): Torrent {
        return {
            id: t.hash,
            name: t.name,
            status: this.mapStatus(t.state),
            progress: t.progress,
            size: t.total_size,
            downloadSpeed: t.download_payload_rate,
            uploadSpeed: t.upload_payload_rate,
            eta: t.eta,
            savePath: t.save_path,
            addedDate: t.time_added ?? 0,
            category: t.label ?? '',
            tags: []
        };
    }

    private mapStatus(state: string): TorrentStatus {
        // Deluge states: "Downloading", "Seeding", "Paused", "Checking", "Queued", "Error", "Allocating", "Moving"
        const lower = state.toLowerCase();
        if (lower === 'downloading') return 'downloading';
        if (lower === 'seeding') return 'seeding';
        if (lower === 'paused') return 'paused';
        if (lower === 'checking') return 'checking';
        if (lower === 'queued') return 'queued';
        if (lower === 'error') return 'error';
        if (lower === 'allocating') return 'checking'; // Map allocating to checking
        if (lower === 'moving') return 'queued'; // Map moving to queued (not actively transferring)
        if (lower === 'active') return 'downloading'; // Fallback
        return 'unknown';
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:application/x-bittorrent;base64, prefix
                const raw = result.split(',')[1];
                resolve(raw);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
