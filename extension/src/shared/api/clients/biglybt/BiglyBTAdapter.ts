import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';
import {
    BiglyBTSessionSchema,
    BiglyBTTagListResponseSchema,
    BiglyBTTorrentResponseSchema,
    BiglyBTCapabilities,
    BiglyBTTag,
    BiglyBTTorrent,
    BiglyBTNetwork,
    BiglyBTPeerSource,
    SimpleApiConfig,
    BiglyBTTimeouts,
    RetryConfig,
    BiglyBTErrorType,
    TorrentNetworkStatus,
    extractCapabilities,
    truncateError,
    parseSimpleApiConfig,
    buildSimpleApiUrl,
    DEFAULT_TIMEOUTS,
    DEFAULT_RETRY_CONFIG,
    classifyError,
    getErrorMessage,
    calculateBackoffDelay,
    sleep,
    inferNetworkFromTrackers,
    getNetworkModeLabel
} from './BiglyBTSchema';

/**
 * BiglyBT Adapter
 * 
 * Implements ITorrentClient for BiglyBT via the xmwebui plugin.
 * BiglyBT exposes a Transmission-compatible RPC endpoint but with
 * vendor extensions for advanced functionality.
 * 
 * Key features over standard Transmission:
 * - Version detection via biglybt-version field
 * - Atomic tag operations (tagsAdd/tagsRemove)
 * - Swarm Merging telemetry (swarm-merge-bytes)
 * - mapPerFile handling for large torrents
 * - Robust error handling for Java stack traces
 */
@injectable()
export class BiglyBTAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private sessionId: string | null = null;
    private rpcUrl: string;

    // BiglyBT capability flags
    private capabilities: BiglyBTCapabilities = {
        isBiglyBT: false,
        version: null,
        pluginVersion: null,
        i2pAvailable: false,
        i2pAddress: null,
        torAvailable: false,
        torAddress: null,
        supportedMethods: [],
        supportsForceStart: false,
        supportsTagsList: false,
    };

    // Cache of available tags
    private tagCache: BiglyBTTag[] = [];

    // Timeout configuration (JVM-aware defaults)
    private timeouts: BiglyBTTimeouts;

    // Retry configuration for startup
    private retryConfig: RetryConfig;

    // Track last error for diagnostics
    private lastErrorType: BiglyBTErrorType | null = null;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.rpcUrl = 'transmission/rpc';

        // Allow timeout overrides from clientOptions
        this.timeouts = {
            ...DEFAULT_TIMEOUTS,
            ...(config.clientOptions?.timeouts as Partial<BiglyBTTimeouts> || {})
        };

        // Allow retry config overrides
        this.retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...(config.clientOptions?.retryConfig as Partial<RetryConfig> || {})
        };
    }

    /**
     * Check if connected to BiglyBT (vs standard Transmission)
     */
    get isBiglyBT(): boolean {
        return this.capabilities.isBiglyBT;
    }

    /**
     * Get BiglyBT version string (or null if not BiglyBT)
     */
    get biglybtVersion(): string | null {
        return this.capabilities.version;
    }

    /**
     * Check if I2P network is available
     */
    get i2pAvailable(): boolean {
        return this.capabilities.i2pAvailable;
    }

    /**
     * Check if Tor network is available
     */
    get torAvailable(): boolean {
        return this.capabilities.torAvailable;
    }

    /**
     * Check if Simple API is configured
     * Required for I2P/Tor network control features
     */
    get isSimpleApiConfigured(): boolean {
        return this.simpleApiConfig !== null;
    }

    /**
     * Get the last error type encountered (for diagnostics)
     */
    get lastError(): BiglyBTErrorType | null {
        return this.lastErrorType;
    }

    /**
     * Get user-friendly message for the last error
     */
    get lastErrorMessage(): string | null {
        return this.lastErrorType ? getErrorMessage(this.lastErrorType) : null;
    }

    /**
     * Get Simple API configuration from clientOptions
     */
    private get simpleApiConfig(): SimpleApiConfig | null {
        return parseSimpleApiConfig(this.config.clientOptions);
    }

    /**
     * Login and detect BiglyBT capabilities
     * 
     * Key differences from Transmission:
     * - Always send a valid JSON payload (BiglyBT may fail on empty POST)
     * - Extract BiglyBT-specific session fields for capability detection
     */
    async login(): Promise<void> {
        try {
            // Use session-get with proper payload to avoid empty POST issues
            const response = await this.call('session-get', {});

            // Parse and extract capabilities
            const parsed = BiglyBTSessionSchema.safeParse(response);
            if (parsed.success) {
                this.capabilities = extractCapabilities(parsed.data);

                if (this.capabilities.isBiglyBT) {
                    console.log(`[BiglyBTAdapter] Detected BiglyBT v${this.capabilities.version}`);
                    if (this.capabilities.i2pAvailable) {
                        console.log(`[BiglyBTAdapter] I2P available at ${this.capabilities.i2pAddress}`);
                    }
                    if (this.capabilities.torAvailable) {
                        console.log(`[BiglyBTAdapter] Tor available at ${this.capabilities.torAddress}`);
                    }
                } else {
                    console.log('[BiglyBTAdapter] Standard Transmission detected, using base functionality');
                }
            }
        } catch (e) {
            // Expected to fail if session ID is missing, but call() handles retry
            // If still fails after retry, it's a real connection error
            console.error('[BiglyBTAdapter] Login failed:', e);
            throw e;
        }
    }

    /**
     * Login with exponential backoff retry
     * 
     * Use this during initial connection when BiglyBT may still be starting up.
     * The xmwebui plugin can take 10-20 seconds to initialize after BiglyBT starts.
     * 
     * @param config - Optional custom retry configuration
     * @returns true if login succeeded, false if all retries exhausted
     */
    async loginWithRetry(config?: Partial<RetryConfig>): Promise<boolean> {
        const retryConfig = { ...this.retryConfig, ...config };

        for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
            try {
                await this.login();
                console.log(`[BiglyBTAdapter] Login succeeded on attempt ${attempt + 1}`);
                return true;
            } catch (e) {
                const errorType = classifyError(e);
                const delay = calculateBackoffDelay(attempt, retryConfig);

                // Only retry on connection-related errors
                if (errorType === 'CONNECTION_REFUSED' || errorType === 'TIMEOUT') {
                    console.log(
                        `[BiglyBTAdapter] Login attempt ${attempt + 1} failed (${errorType}), ` +
                        `retrying in ${delay}ms...`
                    );
                    await sleep(delay);
                } else {
                    // Auth errors, RPC errors etc. should fail immediately
                    console.error(`[BiglyBTAdapter] Login failed with non-retryable error: ${errorType}`);
                    throw e;
                }
            }
        }

        console.error(`[BiglyBTAdapter] Login failed after ${retryConfig.maxAttempts} attempts`);
        return false;
    }

    /**
     * Test connection with retry
     * 
     * Useful for UI "Connect" buttons where BiglyBT may be starting up.
     * 
     * @param config - Optional custom retry configuration
     * @returns true if connection succeeded
     */
    async testConnectionWithRetry(config?: Partial<RetryConfig>): Promise<boolean> {
        const retryConfig = { ...this.retryConfig, ...config };

        for (let attempt = 0; attempt < retryConfig.maxAttempts; attempt++) {
            try {
                await this.call('session-get', {});
                return true;
            } catch (e) {
                const errorType = classifyError(e);
                const delay = calculateBackoffDelay(attempt, retryConfig);

                if (errorType === 'CONNECTION_REFUSED' || errorType === 'TIMEOUT') {
                    await sleep(delay);
                } else {
                    throw e;
                }
            }
        }

        throw new Error(`BiglyBT connection failed after ${retryConfig.maxAttempts} attempts`);
    }

    /**
     * Clear session and logout
     */
    async logout(): Promise<void> {
        this.sessionId = null;
        this.capabilities = {
            isBiglyBT: false,
            version: null,
            pluginVersion: null,
            i2pAvailable: false,
            i2pAddress: null,
            torAvailable: false,
            torAddress: null,
            supportedMethods: [],
            supportsForceStart: false,
            supportsTagsList: false,
        };
    }

    /**
     * Get list of torrents with BiglyBT extensions
     * 
     * Key differences from Transmission:
     * - Always include mapPerFile: true to avoid Table format parsing errors
     * - Request swarm-merge-bytes for Swarm Merging telemetry
     */
    async getTorrents(): Promise<Torrent[]> {
        const baseFields = [
            'id', 'name', 'status', 'totalSize', 'percentDone',
            'rateDownload', 'rateUpload', 'eta', 'downloadDir',
            'addedDate', 'error', 'errorString', 'labels'
        ];

        // Add BiglyBT-specific fields if detected
        const fields = this.capabilities.isBiglyBT
            ? [...baseFields, 'swarm-merge-bytes', 'swarm-bytes']
            : baseFields;

        const args: Record<string, unknown> = {
            fields,
            // Critical: Always set mapPerFile to true for deterministic response structure
            // BiglyBT can return "Table" format (arrays) if this is false, breaking parsing
            mapPerFile: true
        };

        const response = await this.call('torrent-get', args);

        const parsed = BiglyBTTorrentResponseSchema.safeParse(response);
        if (!parsed.success || !parsed.data.arguments?.torrents) {
            return [];
        }

        return parsed.data.arguments.torrents.map(t => this.mapToEntity(t));
    }

    /**
     * Add torrent via URL with BiglyBT extensions
     * 
     * Supports vuze_tags argument for immediate tag assignment.
     */
    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const args: Record<string, unknown> = { filename: url };

        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        // BiglyBT-specific: Use vuze_tags for immediate tag assignment
        if (this.capabilities.isBiglyBT && options?.label) {
            args['vuze_tags'] = [options.label];
        } else if (options?.label) {
            args['labels'] = [options.label];
        }

        await this.call('torrent-add', args);
    }

    /**
     * Add torrent from file with BiglyBT extensions
     */
    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        const args: Record<string, unknown> = { metainfo: base64 };

        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        // BiglyBT-specific: Use vuze_tags for immediate tag assignment
        if (this.capabilities.isBiglyBT && options?.label) {
            args['vuze_tags'] = [options.label];
        } else if (options?.label) {
            args['labels'] = [options.label];
        }

        await this.call('torrent-add', args);
    }

    /**
     * Pause a torrent
     */
    async pauseTorrent(id: string): Promise<void> {
        await this.call('torrent-stop', { ids: [parseInt(id)] });
    }

    /**
     * Resume a torrent
     */
    async resumeTorrent(id: string): Promise<void> {
        await this.call('torrent-start', { ids: [parseInt(id)] });
    }

    /**
     * Remove a torrent
     */
    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        await this.call('torrent-remove', {
            ids: [parseInt(id)],
            'delete-local-data': deleteData
        });
    }

    // =========================================================================
    // Phase 2: Force Start & Queue Management
    // =========================================================================

    /**
     * Force start a torrent (bypasses queue limits)
     * 
     * Uses torrent-start-now RPC method specific to BiglyBT.
     * This ignores global queue limits and seed ratio rules.
     */
    async forceStart(id: string): Promise<void> {
        await this.call('torrent-start-now', { ids: [parseInt(id)] });
    }

    /**
     * Force start multiple torrents
     */
    async forceStartAll(ids: string[]): Promise<void> {
        await this.call('torrent-start-now', {
            ids: ids.map(id => parseInt(id))
        });
    }

    /**
     * Check if a torrent is in forced state
     * 
     * @returns true if forced, false if not or unknown
     */
    async isForced(id: string): Promise<boolean> {
        const response = await this.call('torrent-get', {
            ids: [parseInt(id)],
            fields: ['isForced'],
            mapPerFile: true
        });

        const parsed = BiglyBTTorrentResponseSchema.safeParse(response);
        const torrent = parsed.success ? parsed.data.arguments?.torrents?.[0] : undefined;
        return (torrent as Record<string, unknown>)?.isForced === true;
    }

    /**
     * Move torrent to top of queue
     */
    async queueMoveTop(id: string): Promise<void> {
        await this.call('queue-move-top', { ids: [parseInt(id)] });
    }

    /**
     * Move torrent to bottom of queue
     */
    async queueMoveBottom(id: string): Promise<void> {
        await this.call('queue-move-bottom', { ids: [parseInt(id)] });
    }

    /**
     * Move torrent up in queue
     */
    async queueMoveUp(id: string): Promise<void> {
        await this.call('queue-move-up', { ids: [parseInt(id)] });
    }

    /**
     * Move torrent down in queue
     */
    async queueMoveDown(id: string): Promise<void> {
        await this.call('queue-move-down', { ids: [parseInt(id)] });
    }

    // =========================================================================
    // Phase 2: Per-Torrent Speed Limits
    // =========================================================================

    /**
     * Set upload speed limit for a torrent
     * 
     * @param id - Torrent ID
     * @param limitKBps - Speed limit in KB/s (-1 to disable)
     */
    async setUploadLimit(id: string, limitKBps: number): Promise<void> {
        await this.call('torrent-set', {
            ids: [parseInt(id)],
            uploadLimit: limitKBps,
            uploadLimited: limitKBps >= 0
        });
    }

    /**
     * Set download speed limit for a torrent
     * 
     * @param id - Torrent ID
     * @param limitKBps - Speed limit in KB/s (-1 to disable)
     */
    async setDownloadLimit(id: string, limitKBps: number): Promise<void> {
        await this.call('torrent-set', {
            ids: [parseInt(id)],
            downloadLimit: limitKBps,
            downloadLimited: limitKBps >= 0
        });
    }

    /**
     * Get speed limits for a torrent
     * 
     * @returns Object with upload/download limits or null if not available
     */
    async getSpeedLimits(id: string): Promise<{
        uploadLimit: number | null;
        uploadLimited: boolean;
        downloadLimit: number | null;
        downloadLimited: boolean;
    } | null> {
        const response = await this.call('torrent-get', {
            ids: [parseInt(id)],
            fields: ['uploadLimit', 'uploadLimited', 'downloadLimit', 'downloadLimited'],
            mapPerFile: true
        });

        const parsed = BiglyBTTorrentResponseSchema.safeParse(response);
        const torrent = parsed.success ? parsed.data.arguments?.torrents?.[0] : undefined;

        if (!torrent) return null;

        const t = torrent as Record<string, unknown>;
        return {
            uploadLimit: typeof t.uploadLimit === 'number' ? t.uploadLimit : null,
            uploadLimited: t.uploadLimited === true,
            downloadLimit: typeof t.downloadLimit === 'number' ? t.downloadLimit : null,
            downloadLimited: t.downloadLimited === true,
        };
    }

    // =========================================================================
    // Phase 3: Network Inference
    // =========================================================================

    /**
     * Get network status for a torrent by analyzing tracker URLs
     * 
     * BiglyBT doesn't expose a direct 'networks' field in torrent-get.
     * Network status is inferred from tracker announce URLs:
     * - .i2p addresses = I2P network
     * - .onion addresses = Tor network
     * - Standard URLs = Public network
     * 
     * @param id - Torrent ID
     * @returns Network status with I2P/Tor/Public indicators and mixed mode warning
     */
    async getNetworkStatus(id: string): Promise<TorrentNetworkStatus | null> {
        const response = await this.call('torrent-get', {
            ids: [parseInt(id)],
            fields: ['trackerStats'],
            mapPerFile: true
        });

        const parsed = BiglyBTTorrentResponseSchema.safeParse(response);
        const torrent = parsed.success ? parsed.data.arguments?.torrents?.[0] : undefined;

        if (!torrent) return null;

        // Extract tracker announce URLs from trackerStats
        const t = torrent as Record<string, unknown>;
        const trackerStats = t.trackerStats as Array<{ announce?: string }> | undefined;

        if (!trackerStats || !Array.isArray(trackerStats)) {
            return inferNetworkFromTrackers([]);
        }

        const trackerUrls = trackerStats
            .map(stat => stat.announce)
            .filter((url): url is string => typeof url === 'string');

        return inferNetworkFromTrackers(trackerUrls);
    }

    /**
     * Get formatted network mode label for a torrent
     * 
     * @param id - Torrent ID
     * @returns Human-readable string like "I2P", "Tor", "Public", or "Mixed (I2P + Public)"
     */
    async getNetworkModeLabel(id: string): Promise<string> {
        const status = await this.getNetworkStatus(id);
        if (!status) return 'Unknown';
        return getNetworkModeLabel(status);
    }

    /**
     * Test connection to BiglyBT
     */
    async testConnection(): Promise<boolean> {
        await this.call('session-get', {});
        return true;
    }

    /**
     * Ping the server and return latency
     */
    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('session-get', {});
        return Date.now() - start;
    }

    /**
     * Get list of available tags (BiglyBT-specific)
     * 
     * Uses tags-get-list RPC method which returns full tag objects
     * including UID, type, and count.
     */
    async getTagList(): Promise<BiglyBTTag[]> {
        if (!this.capabilities.isBiglyBT) {
            // Fall back to standard labels-from-torrents approach
            const tags = await this.getTagsFromTorrents();
            return tags.map((name, idx) => ({
                uid: idx,
                name,
                type: 1, // Manual
                count: 0
            }));
        }

        try {
            const response = await this.call('tags-get-list', {});
            const parsed = BiglyBTTagListResponseSchema.safeParse(response);

            if (parsed.success && parsed.data.arguments?.tags) {
                this.tagCache = parsed.data.arguments.tags;
                return this.tagCache;
            }
        } catch (e) {
            console.warn('[BiglyBTAdapter] tags-get-list failed, falling back:', e);
        }

        const tags = await this.getTagsFromTorrents();
        return tags.map((name, idx) => ({ uid: idx, name, type: 1, count: 0 }));
    }

    /**
     * Get categories (uses tags/labels as categories)
     */
    async getCategories(): Promise<string[]> {
        return this.getTags();
    }

    /**
     * Set category for a torrent (adds as tag)
     */
    async setCategory(hash: string, category: string): Promise<void> {
        await this.addTags(hash, [category]);
    }

    /**
     * Get list of tag names
     */
    async getTags(): Promise<string[]> {
        const tags = await this.getTagList();
        return tags.map(t => t.name);
    }

    /**
     * Resolve a hash-like string or numeric string to the numeric standard ID expected by torrent-set.
     */
    private async resolveNumericId(hashOrId: string): Promise<number> {
        if (/^\d+$/.test(hashOrId)) {
            return parseInt(hashOrId, 10);
        }

        const response = await this.call('torrent-get', {
            ids: [hashOrId],
            fields: ['id'],
            mapPerFile: true
        });

        // We only requested 'id', so extracting directly bypasses full schema validation
        // which might fail if required fields are missing from the narrow response.
        const res = response as any;
        const torrents = res?.arguments?.torrents;
        const torrent = Array.isArray(torrents) ? torrents[0] : undefined;

        if (!torrent || typeof torrent.id !== 'number') {
            throw new Error(`Failed to resolve numeric ID for torrent: ${hashOrId}`);
        }

        return torrent.id;
    }

    /**
     * Add tags to a torrent (atomic operation for BiglyBT)
     * 
     * BiglyBT supports atomic tagsAdd which avoids race conditions.
     * For standard Transmission, falls back to fetch/merge/set pattern.
     */
    async addTags(hash: string, tags: string[]): Promise<void> {
        const id = await this.resolveNumericId(hash);

        if (this.capabilities.isBiglyBT) {
            // Atomic operation - no fetch/merge/set cycle needed
            await this.call('torrent-set', {
                ids: [id],
                tagsAdd: tags
            });
        } else {
            // Fallback: fetch current, merge, set
            const current = await this.getTorrentTags(hash);
            const merged = Array.from(new Set([...current, ...tags]));
            await this.call('torrent-set', {
                ids: [id],
                labels: merged
            });
        }
    }

    /**
     * Remove tags from a torrent (atomic operation for BiglyBT)
     */
    async removeTags(hash: string, tags: string[]): Promise<void> {
        const id = await this.resolveNumericId(hash);

        if (this.capabilities.isBiglyBT) {
            // Atomic operation
            await this.call('torrent-set', {
                ids: [id],
                tagsRemove: tags
            });
        } else {
            // Fallback: fetch current, filter, set
            const current = await this.getTorrentTags(hash);
            const filtered = current.filter(t => !tags.includes(t));
            await this.call('torrent-set', {
                ids: [id],
                labels: filtered
            });
        }
    }

    /**
     * Get tags for a specific torrent
     */
    private async getTorrentTags(hash: string): Promise<string[]> {
        const id = await this.resolveNumericId(hash);
        const response = await this.call('torrent-get', {
            ids: [id],
            fields: ['labels'],
            mapPerFile: true
        });
        const parsed = BiglyBTTorrentResponseSchema.safeParse(response);
        const torrent = parsed.success ? parsed.data.arguments?.torrents?.[0] : undefined;
        return torrent?.labels || [];
    }

    /**
     * Collect unique tags from all torrents (fallback)
     */
    private async getTagsFromTorrents(): Promise<string[]> {
        const torrents = await this.getTorrents();
        const labels = new Set<string>();
        torrents.forEach(t => {
            if (t.tags) t.tags.forEach(tag => labels.add(tag));
        });
        return Array.from(labels).sort();
    }

    /**
     * RPC call with improved error handling
     * 
     * Key improvements over base TransmissionAdapter:
     * - Truncates Java stack traces in error messages
     * - Handles 409 retries with multiple attempts
     * - Tracks error types for diagnostics
     * - Always sends a valid JSON payload
     */
    private async call(
        method: string,
        args: Record<string, unknown> = {},
        options: { timeout?: number } = {}
    ): Promise<unknown> {
        // Select appropriate timeout based on method
        const timeout = options.timeout ?? this.getTimeoutForMethod(method);

        const makeRequest = async (): Promise<unknown> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };

            if (this.sessionId) {
                headers['X-Transmission-Session-Id'] = this.sessionId;
            }

            if (this.config.username || this.config.password) {
                const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
                headers['Authorization'] = `Basic ${auth}`;
            }

            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            try {
                const response = await this.httpClient.post(this.rpcUrl, {
                    method,
                    arguments: args,
                }, {
                    headers,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeoutId);
            }
        };

        // Allow up to 2 session refresh attempts (initial + retry)
        let lastError: unknown = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await makeRequest();
                this.lastErrorType = null; // Clear on success
                return this.validateResponse(response);
            } catch (e) {
                lastError = e;

                // Handle 409 Conflict (session ID refresh)
                if (e instanceof HttpError && e.status === 409) {
                    const newSessionId = e.response.headers.get('X-Transmission-Session-Id');
                    if (newSessionId) {
                        this.sessionId = newSessionId;
                        console.log('[BiglyBTAdapter] Session ID refreshed');
                        continue; // Retry with new session ID
                    }
                }

                // Classify and track error
                this.lastErrorType = classifyError(e);

                // Don't retry on non-409 errors
                break;
            }
        }

        // Truncate Java stack traces before re-throwing
        if (lastError instanceof Error) {
            lastError.message = truncateError(lastError.message);
        }
        throw lastError;
    }

    /**
     * Get appropriate timeout for RPC method
     */
    private getTimeoutForMethod(method: string): number {
        switch (method) {
            case 'session-get':
                return this.timeouts.handshake;
            case 'torrent-add':
                return this.timeouts.addTorrent;
            case 'torrent-get':
                return this.timeouts.poll;
            default:
                return this.timeouts.poll;
        }
    }

    // =========================================================================
    // Simple API Methods (Port 6906)
    // =========================================================================

    /**
     * Set which networks a torrent uses (Public, I2P, Tor)
     * 
     * Requires Simple API configuration in clientOptions:
     * - simpleApiPort: Port number (default 6906)
     * - simpleApiKey: API key from BiglyBT settings
     * 
     * @param infoHash - Torrent info hash
     * @param networks - Array of networks to enable
     * @returns true if successful, false if failed or not configured
     */
    async setNetworks(infoHash: string, networks: BiglyBTNetwork[]): Promise<boolean> {
        const config = this.simpleApiConfig;
        if (!config) {
            console.warn('[BiglyBTAdapter] Simple API not configured, cannot set networks');
            return false;
        }

        return this.simpleApiCall('setnetworks', {
            hash: infoHash,
            networks: networks.join(',')
        });
    }


    /**
     * Control peer sources for a torrent
     * 
     * @param infoHash - Torrent info hash
     * @param sources - Peer sources to modify
     * @param add - true to add sources, false to remove
     * @returns true if successful
     */
    async setPeerSources(
        infoHash: string,
        sources: BiglyBTPeerSource[],
        add: boolean = true
    ): Promise<boolean> {
        const config = this.simpleApiConfig;
        if (!config) {
            console.warn('[BiglyBTAdapter] Simple API not configured, cannot set peer sources');
            return false;
        }

        // Use +/- prefix for add/remove
        const prefix = add ? '+' : '-';
        const sourceList = sources.map(s => `${prefix}${s}`).join(',');

        return this.simpleApiCall('setpeersources', {
            hash: infoHash,
            peersources: sourceList
        });
    }

    /**
     * Set a download attribute via Simple API
     * 
     * Common attributes:
     * - uploadspeedlimit: Upload speed limit in bytes/sec
     * - downloadspeedlimit: Download speed limit in bytes/sec
     * - ipfilterenable: Enable/disable IP filter
     * 
     * @param infoHash - Torrent info hash
     * @param name - Attribute name
     * @param value - Attribute value
     */
    async setDownloadAttribute(
        infoHash: string,
        name: string,
        value: string
    ): Promise<boolean> {
        const config = this.simpleApiConfig;
        if (!config) {
            console.warn('[BiglyBTAdapter] Simple API not configured, cannot set attribute');
            return false;
        }

        return this.simpleApiCall('setdownloadattribute', {
            hash: infoHash,
            name,
            value
        });
    }

    /**
     * Make a Simple API call (REST-like GET request)
     */
    private async simpleApiCall(
        method: string,
        params: Record<string, string>
    ): Promise<boolean> {
        const config = this.simpleApiConfig;
        if (!config) {
            return false;
        }

        const url = buildSimpleApiUrl(
            this.config.hostname,
            config,
            method,
            params
        );

        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log(`[BiglyBTAdapter] Simple API ${method} succeeded`);
                return true;
            } else {
                console.warn(`[BiglyBTAdapter] Simple API ${method} failed: ${response.status}`);
                return false;
            }
        } catch (e) {
            console.error(`[BiglyBTAdapter] Simple API ${method} error:`, e);
            return false;
        }
    }

    // =========================================================================
    // Private Helpers
    // =========================================================================

    /**
     * Validate RPC response and handle BiglyBT-specific error formats
     */
    private validateResponse(response: unknown): unknown {
        if (typeof response === 'object' && response !== null) {
            const obj = response as Record<string, unknown>;

            // Check for error in result field
            if (obj.result && typeof obj.result === 'string' && obj.result !== 'success') {
                const errorMessage = truncateError(obj.result);
                throw new Error(`BiglyBT RPC Error: ${errorMessage}`);
            }
        }
        return response;
    }

    /**
     * Map BiglyBT torrent response to standard Torrent entity
     * 
     * Includes BiglyBT-specific fields when available.
     */
    private mapToEntity(t: BiglyBTTorrent): Torrent {
        const torrent: Torrent = {
            id: t.id.toString(),
            name: t.name,
            status: this.mapStatus(t.status),
            progress: t.percentDone * 100,
            size: t.totalSize,
            downloadSpeed: t.rateDownload,
            uploadSpeed: t.rateUpload,
            eta: t.eta,
            savePath: t.downloadDir,
            addedDate: t.addedDate * 1000,
            tags: t.labels || [],
            category: t.labels && t.labels.length > 0 ? t.labels[0] : undefined,
        };

        // Add BiglyBT-specific fields if available
        const swarmBytes = t['swarm-merge-bytes'] ?? t['swarm-bytes'];
        if (swarmBytes !== undefined) {
            (torrent as Torrent & { swarmMergeBytes?: number }).swarmMergeBytes = swarmBytes;
        }

        return torrent;
    }

    /**
     * Map Transmission status code to TorrentStatus
     */
    private mapStatus(status: number): TorrentStatus {
        // 0: STOPPED, 1: CHECK_WAIT, 2: CHECK, 3: DOWNLOAD_WAIT, 
        // 4: DOWNLOAD, 5: SEED_WAIT, 6: SEED
        switch (status) {
            case 0: return 'paused';
            case 1: return 'queued';
            case 2: return 'checking';
            case 3: return 'queued';
            case 4: return 'downloading';
            case 5: return 'queued';
            case 6: return 'seeding';
            default: return 'unknown';
        }
    }
}
