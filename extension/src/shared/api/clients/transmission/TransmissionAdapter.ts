import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';
import { TransmissionResponseSchema, TransmissionTorrent } from './TransmissionSchema';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';
import { AsyncLock } from '@/shared/lib/concurrency/AsyncLock';
import {
    TransmissionCapabilities,
    TransmissionSession,
    // Phase 2 types
    TrackerStats,
    TorrentFile,
    BandwidthScheduleConfig,
    FreeSpaceInfo,
    // Phase 3 types
    TorrentViewMode,
    TorrentFieldSets,
    EnhancedTorrentStatus,
    TorrentStatusInfo,
    ConnectionSecurityInfo,
    SecurityWarning,
} from './TransmissionTypes';
import { buildCapabilities, getClientDescription } from './TransmissionCapabilities';
import {
    AuthenticationError,
    WhitelistError,
    DaemonError,
    RpcError,
    DuplicateTorrentError,
} from './TransmissionErrors';
import { TransmissionAdapterError } from './TransmissionAdapterError';
import { AdapterConnectionResult } from '@/shared/api/clients/shared/AdapterConnectionResult';
import { withAdapterRetry, RetryConfig, DEFAULT_RETRY_CONFIG } from '@/shared/lib/retry/withAdapterRetry';

/**
 * Phase 1 Enhanced Transmission RPC Adapter
 * 
 * Improvements:
 * - Task 1.1: Session management hardening with AsyncLock
 * - Task 1.2: RPC version detection and capability flagging
 * - Task 1.3: Enhanced error handling (401, 403, 409, 5xx differentiation)
 * - Task 1.4: Extended schema with queue, stats, and hash fields
 */
@injectable()
export class TransmissionAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private sessionId: string | null = null;
    private rpcUrl: string;

    /** Task 1.2: Capability flags from session handshake */
    private capabilities: TransmissionCapabilities | null = null;

    /** Task 1.1: Mutex for session ID refresh to prevent race conditions */
    private sessionLock = new AsyncLock();

    /** Retry limit for 409 handshake to prevent infinite loops */
    private readonly MAX_SESSION_RETRIES = 2;

    /** Exponential-backoff retry configuration for the connection test */
    private retryConfig: RetryConfig;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.rpcUrl = '/transmission/rpc';

        // Allow per-server retry overrides (defaults to the shared DEFAULT_RETRY_CONFIG)
        this.retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...(this.config.clientOptions?.retryConfig as Partial<RetryConfig> || {}),
        };
    }

    /**
     * Task 1.2: Enhanced login with capability detection
     */
    async login(): Promise<void> {
        try {
            // Fetch session to trigger initial handshake and get capabilities
            const sessionData = await this.call<{ arguments?: TransmissionSession }>('session-get');

            if (sessionData.arguments) {
                this.capabilities = buildCapabilities(sessionData.arguments);
                console.info('[TransmissionAdapter] Connected:', getClientDescription(this.capabilities));
            }
        } catch (e) {
            // If session-get fails after retry, it's a real connection error
            console.error('[TransmissionAdapter] Login failed:', e);
            throw e;
        }
    }

    async logout(): Promise<void> {
        this.sessionId = null;
        this.capabilities = null;
    }

    /**
     * Task 1.4: Extended field fetching for queue, stats, and hash
     */
    async getTorrents(): Promise<Torrent[]> {
        const response = await this.call<{ arguments?: { torrents?: TransmissionTorrent[] } }>('torrent-get', {
            fields: [
                // Core identification
                'id', 'name', 'hashString', 'status',

                // Size & Progress
                'totalSize', 'percentDone', 'rateDownload', 'rateUpload', 'eta',

                // Metadata
                'downloadDir', 'addedDate',

                // Task 1.3: Error reporting
                'error', 'errorString',

                // Task 1.4: Queue management
                'queuePosition', 'bandwidthPriority',

                // Task 1.4: Statistics
                'uploadRatio', 'uploadedEver', 'downloadedEver',

                // Optional
                'labels'
            ]
        });

        const parsed = TransmissionResponseSchema.parse(response);
        if (!parsed.arguments?.torrents) return [];

        return parsed.arguments.torrents.map(t => this.mapToEntity(t));
    }

    /**
 * Task 1.3: Enhanced torrent addition with duplicate detection
 */
    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const args: Record<string, unknown> = { filename: url };
        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        const response = await this.call<{ result?: string; arguments?: Record<string, unknown> }>('torrent-add', args);

        // Check for duplicate torrent (both Transmission 3 and 4 signals)
        // Transmission 3: result === 'success', arguments['torrent-duplicate'] present
        // Transmission 4: result === 'duplicate torrent', arguments['torrent-duplicate'] present
        const isDuplicateResult = response.result === 'duplicate torrent';
        const hasDuplicateArg = response.arguments && 'torrent-duplicate' in response.arguments;

        if (isDuplicateResult || hasDuplicateArg) {
            const duplicate = response.arguments?.['torrent-duplicate'] as { name?: string } | undefined;
            throw new DuplicateTorrentError(duplicate?.name);
        }
    }
    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        const args: Record<string, unknown> = { metainfo: base64 };
        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        const response = await this.call<{ result?: string; arguments?: Record<string, unknown> }>('torrent-add', args);

        // Check for duplicate torrent (both Transmission 3 and 4 signals)
        // Transmission 3: result === 'success', arguments['torrent-duplicate'] present
        // Transmission 4: result === 'duplicate torrent', arguments['torrent-duplicate'] present
        const isDuplicateResult = response.result === 'duplicate torrent';
        const hasDuplicateArg = response.arguments && 'torrent-duplicate' in response.arguments;

        if (isDuplicateResult || hasDuplicateArg) {
            const duplicate = response.arguments?.['torrent-duplicate'] as { name?: string } | undefined;
            throw new DuplicateTorrentError(duplicate?.name);
        }
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call('torrent-stop', { ids: [parseInt(id)] });
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call('torrent-start', { ids: [parseInt(id)] });
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        await this.call('torrent-remove', {
            ids: [parseInt(id)],
            'delete-local-data': deleteData
        });
    }

    async testConnection(): Promise<AdapterConnectionResult> {
        try {
            await withAdapterRetry(() => this.call('session-get'), this.retryConfig);
            return { connected: true };
        } catch (error) {
            return { connected: false, error: TransmissionAdapterError.from(error) };
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('session-get');
        return Date.now() - start;
    }

    /**
     * Task 1.1: Enhanced RPC call with mutex-protected session handling
     * Task 1.3: Enhanced error differentiation (401, 403, 409, 5xx)
     */
    private async call<T = unknown>(method: string, args: Record<string, unknown> = {}, retryCount = 0): Promise<T> {
        const headers: Record<string, string> = {};

        if (this.sessionId) {
            headers['X-Transmission-Session-Id'] = this.sessionId;
        }

        if (this.config.username || this.config.password) {
            const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
            headers['Authorization'] = `Basic ${auth}`;
        }

        try {
            const response = await this.httpClient.post<T>(this.rpcUrl, {
                method,
                arguments: args,
            }, { headers, timeoutMs: 14000 });

            // Debug logging for successful response
            if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) {
                console.debug(`[TransmissionAdapter] RPC ${method} ${retryCount === 0 ? 'initial' : 'retry'} request succeeded`);
            }

            // Validate RPC result
            // Note: Transmission 4 returns "duplicate torrent" for torrent-add operations
            // when a torrent already exists. This is a non-fatal result that should be
            // handled by the caller (addTorrentUrl/addTorrentFile), not thrown here.
            const rpcResponse = response as { result?: string; arguments?: unknown };
            if (rpcResponse.result && rpcResponse.result !== 'success' && rpcResponse.result !== 'duplicate torrent') {
                throw new RpcError(rpcResponse.result, method);
            }

            return response;
        } catch (e) {
            if (e instanceof HttpError) {
                const { status, response } = e;

                // Debug logging for HTTP errors
                if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) {
                    console.debug(`[TransmissionAdapter] RPC ${method} ${retryCount === 0 ? 'initial' : 'retry'} request: HTTP ${status}`);
                }

                // 409 Conflict: Session ID required/expired
                if (status === 409) {
                    if (retryCount >= 1) {
                        // Already retried once, handshake failed
                        throw new Error('Transmission handshake failed. Verify RPC is enabled and reachable.');
                    }

                    // Extract session ID from response headers
                    const newSessionId = await this.sessionLock.run(async () => {
                        return response.headers.get('X-Transmission-Session-Id');
                    });

                    if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) {
                        console.debug(`[TransmissionAdapter] Transmission RPC initial status: 409`);
                        console.debug(`[TransmissionAdapter] Transmission RPC retry: sending session header (present=${!!newSessionId})`);
                    }

                    if (!newSessionId) {
                        throw new Error('Transmission handshake failed. Server did not provide X-Transmission-Session-Id header.');
                    }

                    // Store session ID and retry with the same method + args
                    this.sessionId = newSessionId;
                    return this.call<T>(method, args, retryCount + 1);
                }

                if (status === 401) {
                    throw new AuthenticationError();
                }

                if (status === 403) {
                    throw new WhitelistError(this.config.hostname);
                }

                if (status === 404 || (status >= 300 && status < 400)) {
                    throw new Error('Transmission RPC endpoint not found. Verify the RPC URL (expected /transmission/rpc) and port.');
                }

                if (status >= 500) {
                    throw new DaemonError(status, e.message);
                }
            }

            // Network failure / fetch rejected
            if (e instanceof Error && (e.name === 'TypeError' || e.message.includes('fetch'))) {
                throw new Error('Cannot reach server. Verify host/port and that remote access allows this device.');
            }

            // Timeout: enrich with resolved URL for diagnostics (no credentials included)
            if (e instanceof Error && e.message.startsWith('Connection timed out after')) {
                let resolvedUrl = '(unknown)';
                try {
                    resolvedUrl = new URL(this.rpcUrl, this.config.hostname).toString();
                } catch {
                    // hostname may be malformed; fall back to raw values
                    resolvedUrl = `${this.config.hostname}${this.rpcUrl}`;
                }
                throw new Error(`${e.message} (target: ${resolvedUrl})`);
            }

            // Re-throw all other errors
            if (e instanceof Error) {
                throw e;
            }
            throw new Error('Connection test failed. Verify host, port, and credentials.');
        }
    }

    /**
     * Task 1.3 & 1.4: Enhanced entity mapping with error reporting and new fields
     */
    private mapToEntity(t: TransmissionTorrent): Torrent {
        return {
            id: t.id.toString(),
            name: t.name,
            status: TransmissionAdapter.mapStatus(t.status),
            progress: t.percentDone * 100,
            size: t.totalSize,
            downloadSpeed: t.rateDownload,
            uploadSpeed: t.rateUpload,
            eta: t.eta,
            savePath: t.downloadDir,
            addedDate: t.addedDate * 1000,
            tags: t.labels || [],
            category: t.labels && t.labels.length > 0 ? t.labels[0] : undefined,

            // Task 1.3: Error reporting
            errorLevel: t.error,
            errorMessage: t.errorString || undefined,

            // Task 1.4: Queue and priority
            queuePosition: t.queuePosition,
            priority: t.bandwidthPriority,

            // Task 1.4: Persistent identifier
            hash: t.hashString,

            // Task 1.4: Statistics
            ratio: t.uploadRatio,
            uploadedTotal: t.uploadedEver,
            downloadedTotal: t.downloadedEver,
        };
    }

    private static mapStatus(status: number): TorrentStatus {
        // 0: STOPPED, 1: CHECK_WAIT, 2: CHECK, 3: DOWNLOAD_WAIT, 4: DOWNLOAD, 5: SEED_WAIT, 6: SEED
        switch (status) {
            case 0: return 'paused';
            case 1: return 'queued'; // Queued for check
            case 2: return 'checking';
            case 3: return 'queued'; // Queued for download
            case 4: return 'downloading';
            case 5: return 'queued'; // Queued for seed
            case 6: return 'seeding';
            default: return 'unknown';
        }
    }

    async getCategories(): Promise<string[]> {
        // Transmission uses labels as categories/tags.
        // We fetch all torrents to get unique labels.
        const torrents = await this.getTorrents();
        const labels = new Set<string>();
        torrents.forEach(t => {
            if (t.tags) t.tags.forEach(tag => labels.add(tag));
        });
        return Array.from(labels).sort();
    }

    async setCategory(hash: string, category: string): Promise<void> {
        // Transmission doesn't have exclusive categories, so we just add it as a label.
        await this.addTags(hash, [category]);
    }

    async getTags(): Promise<string[]> {
        return this.getCategories();
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // 1. Get current tags
        const currentTags = await this.getTorrentTags(hash);
        // 2. Merge
        const newTags = Array.from(new Set([...currentTags, ...tags]));
        // 3. Set
        await this.call('torrent-set', {
            ids: [parseInt(hash)],
            labels: newTags
        });
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // 1. Get current tags
        const currentTags = await this.getTorrentTags(hash);
        // 2. Filter
        const newTags = currentTags.filter(t => !tags.includes(t));
        // 3. Set
        await this.call('torrent-set', {
            ids: [parseInt(hash)],
            labels: newTags
        });
    }

    private async getTorrentTags(hash: string): Promise<string[]> {
        const response = await this.call<{ arguments?: { torrents?: TransmissionTorrent[] } }>('torrent-get', {
            ids: [parseInt(hash)],
            fields: ['labels']
        });
        const parsed = TransmissionResponseSchema.parse(response);
        const torrent = parsed.arguments?.torrents?.[0];
        return torrent?.labels || [];
    }

    // ========================================================================
    // Phase 2: Feature Parity - Queue Management (Task 2.1)
    // ========================================================================

    /**
     * Move torrents to the top of the queue
     */
    async queueMoveTop(ids: string[]): Promise<void> {
        await this.call('queue-move-top', { ids: ids.map(id => parseInt(id)) });
    }

    /**
     * Move torrents up one position in the queue
     */
    async queueMoveUp(ids: string[]): Promise<void> {
        await this.call('queue-move-up', { ids: ids.map(id => parseInt(id)) });
    }

    /**
     * Move torrents down one position in the queue
     */
    async queueMoveDown(ids: string[]): Promise<void> {
        await this.call('queue-move-down', { ids: ids.map(id => parseInt(id)) });
    }

    /**
     * Move torrents to the bottom of the queue
     */
    async queueMoveBottom(ids: string[]): Promise<void> {
        await this.call('queue-move-bottom', { ids: ids.map(id => parseInt(id)) });
    }

    /**
     * Set bandwidth priority for a torrent
     * @param id Torrent ID
     * @param priority -1 (Low), 0 (Normal), 1 (High)
     */
    async setBandwidthPriority(id: string, priority: -1 | 0 | 1): Promise<void> {
        await this.call('torrent-set', {
            ids: [parseInt(id)],
            bandwidthPriority: priority
        });
    }

    /**
     * Force start a torrent, bypassing queue limits
     */
    async forceStartTorrent(id: string): Promise<void> {
        await this.call('torrent-start-now', { ids: [parseInt(id)] });
    }

    // ========================================================================
    // Phase 2: Feature Parity - Tracker Management (Task 2.2)
    // ========================================================================

    /**
     * Get trackers for a torrent
     */
    async getTrackers(id: string): Promise<TrackerStats[]> {
        const response = await this.call<{ arguments?: { torrents?: Array<{ trackerStats?: TrackerStats[] }> } }>('torrent-get', {
            ids: [parseInt(id)],
            fields: ['trackerStats']
        });

        const torrent = response.arguments?.torrents?.[0];
        return torrent?.trackerStats || [];
    }

    /**
     * Add a tracker to a torrent (handles v3/v4 branching)
     * @param id Torrent ID
     * @param announceUrl Tracker announce URL
     */
    async addTracker(id: string, announceUrl: string): Promise<void> {
        if (this.capabilities?.supportsTrackerList) {
            // v17+ (Transmission 4.x): Use trackerList string
            const currentList = await this.getTrackerList(id);
            const newList = currentList ? `${currentList}\n\n${announceUrl}` : announceUrl;
            await this.call('torrent-set', {
                ids: [parseInt(id)],
                trackerList: newList
            });
        } else {
            // v16- (Transmission 3.x): Use trackerAdd array
            await this.call('torrent-set', {
                ids: [parseInt(id)],
                trackerAdd: [announceUrl]
            });
        }
    }

    /**
     * Remove a tracker from a torrent (handles v3/v4 branching)
     * @param id Torrent ID
     * @param trackerId Tracker ID (for v3) or announce URL (for v4)
     */
    async removeTracker(id: string, trackerId: number | string): Promise<void> {
        if (this.capabilities?.supportsTrackerList) {
            // v17+ (Transmission 4.x): Read-Modify-Write with trackerList
            const currentList = await this.getTrackerList(id);
            if (!currentList) return;

            // Remove the tracker URL from the list
            const announceUrl = typeof trackerId === 'string' ? trackerId : await this.getTrackerAnnounceById(id, trackerId);
            if (!announceUrl) return;

            const lines = currentList.split('\n');
            const filteredLines = lines.filter(line => line.trim() !== announceUrl.trim());
            const newList = filteredLines.join('\n');

            await this.call('torrent-set', {
                ids: [parseInt(id)],
                trackerList: newList
            });
        } else {
            // v16- (Transmission 3.x): Use trackerRemove with ID
            const idNum = typeof trackerId === 'number' ? trackerId : parseInt(trackerId);
            await this.call('torrent-set', {
                ids: [parseInt(id)],
                trackerRemove: [idNum]
            });
        }
    }

    /**
     * Replace all trackers (v17+ only, falls back to add for v16-)
     */
    async replaceTrackers(id: string, trackerList: string): Promise<void> {
        if (this.capabilities?.supportsTrackerList) {
            await this.call('torrent-set', {
                ids: [parseInt(id)],
                trackerList
            });
        } else {
            // v16-: Can't bulk replace, throw error
            throw new RpcError('Bulk tracker replacement requires Transmission 4.x (RPC v17+)', 'torrent-set');
        }
    }

    /**
     * Get the current tracker list string (v17+ only)
     */
    private async getTrackerList(id: string): Promise<string> {
        const response = await this.call<{ arguments?: { torrents?: Array<{ trackerList?: string }> } }>('torrent-get', {
            ids: [parseInt(id)],
            fields: ['trackerList']
        });
        return response.arguments?.torrents?.[0]?.trackerList || '';
    }

    /**
     * Get announce URL by tracker ID
     */
    private async getTrackerAnnounceById(id: string, trackerId: number): Promise<string | null> {
        const trackers = await this.getTrackers(id);
        const tracker = trackers.find(t => t.id === trackerId);
        return tracker?.announce || null;
    }

    // ========================================================================
    // Phase 2: Feature Parity - File Management (Task 2.3)
    // ========================================================================

    /**
     * Get files for a torrent
     */
    async getFiles(id: string): Promise<TorrentFile[]> {
        const response = await this.call<{
            arguments?: {
                torrents?: Array<{
                    files?: Array<{ name: string; length: number; bytesCompleted: number }>;
                    fileStats?: Array<{ wanted: boolean; priority: number }>;
                }>;
            };
        }>('torrent-get', {
            ids: [parseInt(id)],
            fields: ['files', 'fileStats']
        });

        const torrent = response.arguments?.torrents?.[0];
        if (!torrent?.files || !torrent?.fileStats) return [];

        // Zip files and fileStats together
        return torrent.files.map((file, index) => ({
            index,
            name: file.name,
            size: file.length,
            bytesCompleted: file.bytesCompleted,
            wanted: torrent.fileStats![index]?.wanted ?? true,
            priority: (torrent.fileStats![index]?.priority ?? 0) as -1 | 0 | 1,
        }));
    }

    /**
     * Set file priority (high/normal/low)
     * @param id Torrent ID
     * @param fileIndices Array of file indices
     * @param priority 'high' | 'normal' | 'low'
     */
    async setFilePriority(id: string, fileIndices: number[], priority: 'high' | 'normal' | 'low'): Promise<void> {
        const priorityField = priority === 'high' ? 'priority-high' :
            priority === 'low' ? 'priority-low' : 'priority-normal';

        await this.call('torrent-set', {
            ids: [parseInt(id)],
            [priorityField]: fileIndices
        });
    }

    /**
     * Set files wanted/unwanted (select/deselect for download)
     * @param id Torrent ID
     * @param fileIndices Array of file indices
     * @param wanted Whether files should be downloaded
     */
    async setFilesWanted(id: string, fileIndices: number[], wanted: boolean): Promise<void> {
        const field = wanted ? 'files-wanted' : 'files-unwanted';
        await this.call('torrent-set', {
            ids: [parseInt(id)],
            [field]: fileIndices
        });
    }

    /**
     * Force verify (recheck) a torrent
     */
    async verifyTorrent(id: string): Promise<void> {
        await this.call('torrent-verify', { ids: [parseInt(id)] });
    }

    /**
     * Move torrent data to a new location
     * @param id Torrent ID
     * @param newPath New directory path
     * @param moveFiles If true, physically move files; if false, just update path pointer
     */
    async moveTorrentData(id: string, newPath: string, moveFiles: boolean = true): Promise<void> {
        await this.call('torrent-set-location', {
            ids: [parseInt(id)],
            location: newPath,
            move: moveFiles
        });
    }

    // ========================================================================
    // Phase 2: Feature Parity - Bandwidth Scheduling (Task 2.4)
    // ========================================================================

    /**
     * Get current bandwidth schedule configuration
     */
    async getBandwidthSchedule(): Promise<BandwidthScheduleConfig> {
        const response = await this.call<{ arguments?: TransmissionSession }>('session-get');
        const session = response.arguments;

        return {
            altSpeedEnabled: session?.['alt-speed-enabled'] ?? false,
            altSpeedDown: session?.['alt-speed-down'] ?? 50,
            altSpeedUp: session?.['alt-speed-up'] ?? 50,
            schedulerEnabled: session?.['alt-speed-time-enabled'] ?? false,
            timeBegin: session?.['alt-speed-time-begin'] ?? 540, // 9:00 AM
            timeEnd: session?.['alt-speed-time-end'] ?? 1020,    // 5:00 PM
            days: session?.['alt-speed-time-day'] ?? 127,        // Every day
        };
    }

    /**
     * Set bandwidth schedule configuration
     */
    async setBandwidthSchedule(config: Partial<BandwidthScheduleConfig>): Promise<void> {
        const args: Record<string, unknown> = {};

        if (config.altSpeedEnabled !== undefined) args['alt-speed-enabled'] = config.altSpeedEnabled;
        if (config.altSpeedDown !== undefined) args['alt-speed-down'] = config.altSpeedDown;
        if (config.altSpeedUp !== undefined) args['alt-speed-up'] = config.altSpeedUp;
        if (config.schedulerEnabled !== undefined) args['alt-speed-time-enabled'] = config.schedulerEnabled;
        if (config.timeBegin !== undefined) args['alt-speed-time-begin'] = config.timeBegin;
        if (config.timeEnd !== undefined) args['alt-speed-time-end'] = config.timeEnd;
        if (config.days !== undefined) args['alt-speed-time-day'] = config.days;

        await this.call('session-set', args);
    }

    /**
     * Toggle Turtle Mode (alternative speed limits) on/off
     */
    async setTurtleMode(enabled: boolean): Promise<void> {
        await this.call('session-set', { 'alt-speed-enabled': enabled });
    }

    // ========================================================================
    // Phase 2: Feature Parity - Blocklist Management (Task 2.5)
    // ========================================================================

    /**
     * Get blocklist status
     */
    async getBlocklistInfo(): Promise<{ enabled: boolean; url: string; size: number }> {
        const response = await this.call<{ arguments?: TransmissionSession }>('session-get');
        const session = response.arguments;

        return {
            enabled: session?.['blocklist-enabled'] ?? false,
            url: session?.['blocklist-url'] ?? '',
            size: session?.['blocklist-size'] ?? 0,
        };
    }

    /**
     * Enable or disable blocklist
     */
    async setBlocklistEnabled(enabled: boolean): Promise<void> {
        await this.call('session-set', { 'blocklist-enabled': enabled });
    }

    /**
     * Set blocklist URL
     */
    async setBlocklistUrl(url: string): Promise<void> {
        await this.call('session-set', { 'blocklist-url': url });
    }

    /**
     * Trigger blocklist update (downloads and parses the blocklist)
     * @returns Number of rules loaded
     */
    async updateBlocklist(): Promise<number> {
        const response = await this.call<{ arguments?: { 'blocklist-size': number } }>('blocklist-update');
        return response.arguments?.['blocklist-size'] ?? 0;
    }

    // ========================================================================
    // Phase 2: Feature Parity - Free Space (Task 2.6)
    // ========================================================================

    /**
     * Get free space for a path
     * Falls back to parent directories if path doesn't exist
     */
    async getFreeSpace(path: string): Promise<FreeSpaceInfo> {
        // Check if client supports free-space
        if (this.capabilities && !this.capabilities.supportsFreeSpace) {
            return { path, freeBytes: -1 }; // Indicate unsupported
        }

        try {
            const response = await this.call<{
                arguments?: { path: string; 'size-bytes': number; 'total_size'?: number };
            }>('free-space', { path });

            return {
                path: response.arguments?.path ?? path,
                freeBytes: response.arguments?.['size-bytes'] ?? -1,
                totalBytes: response.arguments?.['total_size'],
            };
        } catch (e) {
            // If path doesn't exist, try parent directory
            if (e instanceof RpcError && path.includes('/')) {
                const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
                if (parentPath !== path) {
                    return this.getFreeSpace(parentPath);
                }
            }
            // Return error indicator
            return { path, freeBytes: -1 };
        }
    }

    /**
     * Get detected capabilities (available after login)
     */
    getCapabilities(): TransmissionCapabilities | null {
        return this.capabilities;
    }

    // ========================================================================
    // Phase 3: Optimization & UX
    // ========================================================================

    /**
     * Task 3.1: Adaptive field fetching based on view mode
     * Uses lightweight field set for list view, full set for detail view
     */
    async getTorrentsWithViewMode(viewMode: TorrentViewMode = 'list'): Promise<Torrent[]> {
        const fields = TorrentFieldSets[viewMode];

        const response = await this.call<{ arguments?: { torrents?: TransmissionTorrent[] } }>('torrent-get', {
            fields: [...fields] // Clone to avoid mutation
        });

        const parsed = TransmissionResponseSchema.parse(response);
        if (!parsed.arguments?.torrents) return [];

        return parsed.arguments.torrents.map(t => this.mapToEntity(t));
    }

    /**
     * Task 3.1: Get only recently changed torrents (performance optimization)
     * Uses 'recently-active' special ID to get only changed torrents since last poll
     * Note: BiglyBT may return stale data with this method
     */
    async getRecentlyActiveTorrents(): Promise<{ active: Torrent[]; removed: number[] }> {
        const response = await this.call<{
            arguments?: {
                torrents?: TransmissionTorrent[];
                removed?: number[];
            };
        }>('torrent-get', {
            ids: 'recently-active',
            fields: [...TorrentFieldSets.minimal]
        });

        const parsed = TransmissionResponseSchema.parse(response);

        return {
            active: (parsed.arguments?.torrents ?? []).map(t => this.mapToEntity(t)),
            removed: parsed.arguments?.removed ?? []
        };
    }

    /**
     * Task 3.3: Get enhanced status info with granular states
     */
    getEnhancedStatus(torrent: Torrent, rawStatus?: number, isStalled?: boolean, metadataPercent?: number): TorrentStatusInfo {
        // Determine enhanced status based on multiple factors
        let status: EnhancedTorrentStatus = 'unknown';
        let label = 'Unknown';
        let errorSeverity: 'warning' | 'error' | null = null;
        let progress: number | undefined;

        // Check for errors first (highest priority)
        if (torrent.errorLevel && torrent.errorLevel > 0) {
            if (torrent.errorLevel === 1) {
                errorSeverity = 'warning';
                status = 'error-tracker';
                label = 'Tracker Warning';
            } else if (torrent.errorLevel === 2) {
                errorSeverity = 'error';
                status = 'error-tracker';
                label = 'Tracker Error';
            } else if (torrent.errorLevel === 3) {
                errorSeverity = 'error';
                status = 'error-local';
                label = 'Local Error';
            }
            return { status, label, isActive: false, errorSeverity, progress };
        }

        // Check for metadata fetching
        if (metadataPercent !== undefined && metadataPercent < 1) {
            return {
                status: 'metadata',
                label: 'Fetching Metadata',
                isActive: true,
                errorSeverity: null,
                progress: metadataPercent * 100
            };
        }

        // Map raw status with stall detection
        if (rawStatus !== undefined) {
            switch (rawStatus) {
                case 0: // STOPPED
                    return { status: 'paused', label: 'Paused', isActive: false, errorSeverity: null };
                case 1: // CHECK_WAIT
                    return { status: 'queued-verify', label: 'Queued for Verification', isActive: false, errorSeverity: null };
                case 2: // CHECK
                    return { status: 'checking', label: 'Verifying', isActive: true, errorSeverity: null };
                case 3: // DOWNLOAD_WAIT
                    return { status: 'queued-download', label: 'Queued', isActive: false, errorSeverity: null };
                case 4: // DOWNLOAD
                    if (isStalled) {
                        return { status: 'stalled-download', label: 'Stalled', isActive: false, errorSeverity: 'warning' };
                    }
                    return { status: 'downloading', label: 'Downloading', isActive: true, errorSeverity: null };
                case 5: // SEED_WAIT
                    return { status: 'queued-seed', label: 'Queued for Seeding', isActive: false, errorSeverity: null };
                case 6: // SEED
                    if (isStalled) {
                        return { status: 'stalled-seed', label: 'Stalled (Seeding)', isActive: false, errorSeverity: null };
                    }
                    return { status: 'seeding', label: 'Seeding', isActive: true, errorSeverity: null };
            }
        }

        // Fallback to basic status mapping
        switch (torrent.status) {
            case 'downloading':
                return { status: 'downloading', label: 'Downloading', isActive: true, errorSeverity: null };
            case 'seeding':
                return { status: 'seeding', label: 'Seeding', isActive: true, errorSeverity: null };
            case 'paused':
                return { status: 'paused', label: 'Paused', isActive: false, errorSeverity: null };
            case 'checking':
                return { status: 'checking', label: 'Verifying', isActive: true, errorSeverity: null };
            case 'queued':
                return { status: 'queued', label: 'Queued', isActive: false, errorSeverity: null };
            case 'completed':
                return { status: 'completed', label: 'Completed', isActive: false, errorSeverity: null };
            case 'error':
                return { status: 'error', label: 'Error', isActive: false, errorSeverity: 'error' };
            default:
                return { status: 'unknown', label: 'Unknown', isActive: false, errorSeverity: null };
        }
    }

    /**
     * Task 3.4: Sanitize Vuze path bug
     * Vuze incorrectly includes the torrent name in downloadDir
     */
    sanitizeDownloadPath(path: string, torrentName: string): string {
        if (!this.capabilities?.hasVuzePathBug) {
            return path;
        }

        // Vuze bug: downloadDir includes "/TorrentName" at the end
        // We need to remove it to get the actual download directory
        if (path.endsWith('/' + torrentName)) {
            return path.substring(0, path.length - torrentName.length - 1);
        }

        // Also handle Windows paths
        if (path.endsWith('\\' + torrentName)) {
            return path.substring(0, path.length - torrentName.length - 1);
        }

        return path;
    }

    /**
     * Task 3.5: Get connection security info
     */
    getConnectionSecurityInfo(): ConnectionSecurityInfo {
        const warnings: SecurityWarning[] = [];
        let url: URL;

        try {
            url = new URL(this.config.hostname);
        } catch {
            return {
                isSecure: false,
                isLocal: false,
                warnings: ['insecure-remote'],
                statusText: 'Invalid URL'
            };
        }

        const isSecure = url.protocol === 'https:';
        const hostname = url.hostname.toLowerCase();
        const isLocal = hostname === 'localhost' ||
            hostname === '127.0.0.1' ||
            hostname === '::1' ||
            hostname.endsWith('.local') ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

        // Check for insecure remote connection
        if (!isSecure && !isLocal) {
            warnings.push('insecure-remote');
        }

        // Generate status text
        let statusText: string;
        if (isSecure) {
            statusText = 'Secure connection (HTTPS)';
        } else if (isLocal) {
            statusText = 'Local connection (HTTP)';
        } else {
            statusText = '⚠️ Insecure remote connection - credentials sent in plaintext';
        }

        return {
            isSecure,
            isLocal,
            warnings,
            statusText
        };
    }

    /**
     * Task 3.2: Optimistic pause with rollback
     * Returns a rollback function to call if the operation fails
     */
    async pauseTorrentOptimistic(id: string, onOptimisticUpdate: (torrent: Partial<Torrent>) => void): Promise<() => void> {
        // Apply optimistic update immediately
        onOptimisticUpdate({ id, status: 'paused' });

        // Store rollback state
        const rollback = () => {
            onOptimisticUpdate({ id, status: 'downloading' }); // Or previous state
        };

        try {
            await this.pauseTorrent(id);
            return () => { }; // No rollback needed
        } catch (e) {
            rollback();
            throw e;
        }
    }

    /**
     * Task 3.2: Optimistic resume with rollback
     */
    async resumeTorrentOptimistic(id: string, onOptimisticUpdate: (torrent: Partial<Torrent>) => void): Promise<() => void> {
        // Apply optimistic update immediately
        onOptimisticUpdate({ id, status: 'downloading' });

        const rollback = () => {
            onOptimisticUpdate({ id, status: 'paused' });
        };

        try {
            await this.resumeTorrent(id);
            return () => { };
        } catch (e) {
            rollback();
            throw e;
        }
    }

    /**
     * Get a single torrent with full detail fields
     */
    async getTorrentDetails(id: string): Promise<Torrent | null> {
        const response = await this.call<{ arguments?: { torrents?: TransmissionTorrent[] } }>('torrent-get', {
            ids: [parseInt(id)],
            fields: [...TorrentFieldSets.detail]
        });

        const parsed = TransmissionResponseSchema.parse(response);
        const torrent = parsed.arguments?.torrents?.[0];

        if (!torrent) return null;

        // Apply Vuze path sanitization if needed
        const entity = this.mapToEntity(torrent);
        if (this.capabilities?.hasVuzePathBug) {
            entity.savePath = this.sanitizeDownloadPath(entity.savePath, entity.name);
        }

        return entity;
    }
}
