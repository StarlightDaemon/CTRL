import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    FloodListResponseArraySchema,
    FloodTorrent,
    FloodSessionVerifySchema,
    FloodConnectionTestSchema,
    FloodDiskUsageResponseSchema,
    FloodClientSettingsSchema,
    FloodValidationErrorSchema,
    FloodTorrentContentsResponseSchema,
    FloodRateLimitInfo,
    FloodDiskUsage,
    FloodClientSettings,
    FloodSessionVerify,
    FloodTorrentContent,
    FloodCapabilities,
} from './FloodSchema';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';

// ============================================================================
// Constants
// ============================================================================

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 5000;

/** Maximum retry attempts for exponential backoff */
const MAX_RETRY_ATTEMPTS = 3;

/** Base delay for exponential backoff in milliseconds */
const BASE_BACKOFF_DELAY_MS = 1000;

// ============================================================================
// Error Types
// ============================================================================

export class FloodAuthError extends Error {
    constructor(message: string, public readonly statusCode?: number) {
        super(message);
        this.name = 'FloodAuthError';
    }
}

export class FloodRateLimitError extends Error {
    constructor(
        message: string,
        public readonly rateLimitInfo: FloodRateLimitInfo
    ) {
        super(message);
        this.name = 'FloodRateLimitError';
    }
}

export class FloodValidationError extends Error {
    constructor(
        message: string,
        public readonly issues: Array<{ path: (string | number)[]; message: string }>
    ) {
        super(message);
        this.name = 'FloodValidationError';
    }
}

export class FloodTimeoutError extends Error {
    constructor(message: string = 'Request timeout') {
        super(message);
        this.name = 'FloodTimeoutError';
    }
}

export class FloodBackendDisconnectedError extends Error {
    constructor(message: string = 'Torrent client backend is not connected') {
        super(message);
        this.name = 'FloodBackendDisconnectedError';
    }
}

// ============================================================================
// Extended Options Types
// ============================================================================

/**
 * Flood-specific add torrent options extending the base interface.
 * Includes support for private tracker cookie forwarding.
 */
export interface FloodAddTorrentOptions extends AddTorrentOptions {
    /**
     * HTTP Cookie string for private tracker authentication.
     * Format: "uid=12345; pass=abcdef;"
     * Flood will use these cookies when fetching the .torrent from private trackers.
     */
    cookies?: string;

    /**
     * Enable initial seeding (super seeding) mode.
     * Only supported on qBittorrent backends.
     */
    initialSeeding?: boolean;
}

// ============================================================================
// Flood Adapter
// ============================================================================

@injectable()
export class FloodAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private token: string | null = null;
    private rateLimitInfo: FloodRateLimitInfo | null = null;
    private sessionVerified: boolean = false;
    private cachedBackendType: 'rtorrent' | 'qbittorrent' | 'transmission' | 'unknown' | null = null;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
    }

    // ========================================================================
    // Authentication & Session Management
    // ========================================================================

    async login(): Promise<void> {
        const response = await this.requestWithTimeout<{ success: boolean; token?: string }>(
            () => this.httpClient.post('api/auth/authenticate', {
                username: this.config.username,
                password: this.config.password,
            }),
            'Login request timed out'
        );

        if (response.success && response.token) {
            this.token = response.token;
            this.sessionVerified = true;
        } else if (response.success) {
            // Cookie-based auth - no token returned but success
            this.sessionVerified = true;
        } else {
            throw new FloodAuthError('Flood authentication failed');
        }
    }

    async logout(): Promise<void> {
        this.token = null;
        this.sessionVerified = false;
        this.cachedBackendType = null;
    }

    /**
     * Verify the current session is valid and get backend connection status.
     * Critical for detecting if the torrent daemon is reachable.
     */
    async verifySession(): Promise<FloodSessionVerify> {
        const headers = this.getHeaders();
        const response = await this.requestWithTimeout(
            () => this.httpClient.get('api/auth/verify', { headers }),
            'Session verification timed out'
        );

        const parsed = FloodSessionVerifySchema.parse(response);

        if (!parsed.clientConnected) {
            throw new FloodBackendDisconnectedError();
        }

        this.sessionVerified = true;
        return parsed;
    }

    // ========================================================================
    // Connection Testing
    // ========================================================================

    /**
     * Test if Flood is connected to the torrent daemon.
     * Distinct from auth - Flood may be up but daemon down.
     */
    async testBackendConnection(): Promise<boolean> {
        try {
            const headers = this.getHeaders();
            const response = await this.requestWithTimeout(
                () => this.httpClient.get('api/client/connection-test', { headers }),
                'Connection test timed out'
            );
            const parsed = FloodConnectionTestSchema.parse(response);
            return parsed.isConnected;
        } catch {
            return false;
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            // Also verify session to check backend connectivity
            await this.verifySession();
            return true;
        } catch {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.requestWithTimeout(
            () => this.getTorrents(),
            'Ping request timed out'
        );
        return Date.now() - start;
    }

    // ========================================================================
    // Torrent Operations
    // ========================================================================

    async getTorrents(): Promise<Torrent[]> {
        const headers = this.getHeaders();
        const response = await this.requestWithRetry(
            () => this.httpClient.get('api/torrents', { headers })
        );

        const parsed = FloodListResponseArraySchema.parse(response);
        return parsed.torrents.map(this.mapToEntity);
    }

    async addTorrentUrl(url: string, options?: FloodAddTorrentOptions): Promise<void> {
        const headers = this.getHeaders();
        const body: {
            urls: string[];
            destination?: string;
            start: boolean;
            tags: string[];
            isSequential?: boolean;
            isInitialSeeding?: boolean;
            cookie?: string;
        } = {
            urls: [url],
            destination: options?.path,
            start: !options?.paused,
            tags: options?.label ? [options.label] : [],
        };

        // Add sequential download if supported and requested
        if (options?.sequentialDownload) {
            body.isSequential = true;
        }

        // Add initial seeding mode if requested
        if (options?.initialSeeding) {
            body.isInitialSeeding = true;
        }

        // Add private tracker cookies for authenticated downloads
        if (options?.cookies) {
            body.cookie = options.cookies;
        }

        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/add-urls', body, { headers })
        );
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const headers = this.getHeaders();
        const base64 = await blobToBase64(file);

        const body: {
            files: string[];
            destination?: string;
            start: boolean;
            tags: string[];
            isSequential?: boolean;
        } = {
            files: [base64],
            destination: options?.path,
            start: !options?.paused,
            tags: options?.label ? [options.label] : [],
        };

        if (options?.sequentialDownload) {
            body.isSequential = true;
        }

        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/add-files', body, { headers })
        );
    }

    async pauseTorrent(id: string): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/stop', { hashes: [id] }, { headers })
        );
    }

    async resumeTorrent(id: string): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/start', { hashes: [id] }, { headers })
        );
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/delete', {
                hashes: [id],
                deleteData
            }, { headers })
        );
    }

    // ========================================================================
    // Tag & Category Management
    // ========================================================================

    async getCategories(): Promise<string[]> {
        // Flood uses tags as categories
        return this.getTags();
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.addTags(hash, [category]);
    }

    async getTags(): Promise<string[]> {
        const headers = this.getHeaders();
        try {
            const tags = await this.requestWithTimeout(
                () => this.httpClient.get<string[]>('api/tags', { headers }),
                'Get tags timed out'
            );
            return tags;
        } catch {
            return [];
        }
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch('api/torrents/tags', {
                hashes: [hash],
                tags: tags
            }, { headers })
        );
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        const currentTags = await this.getTorrentTags(hash);
        const newTags = currentTags.filter(t => !tags.includes(t));

        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.put('api/torrents/tags', {
                hashes: [hash],
                tags: newTags
            }, { headers })
        );
    }

    // ========================================================================
    // System Information (Phase 2 preview - exposed for early access)
    // ========================================================================

    /**
     * Get disk usage information for configured download paths.
     */
    async getDiskUsage(): Promise<FloodDiskUsage[]> {
        const headers = this.getHeaders();
        const response = await this.requestWithTimeout(
            () => this.httpClient.get('api/system/disk-usage', { headers }),
            'Disk usage request timed out'
        );
        return FloodDiskUsageResponseSchema.parse(response);
    }

    /**
     * Get client settings - useful for backend type detection.
     */
    async getClientSettings(): Promise<FloodClientSettings> {
        const headers = this.getHeaders();
        const response = await this.requestWithTimeout(
            () => this.httpClient.get('api/client/settings', { headers }),
            'Client settings request timed out'
        );
        return FloodClientSettingsSchema.parse(response);
    }

    /**
     * Detect the backend torrent client type.
     * Returns cached result after first detection.
     */
    async detectBackendType(): Promise<'rtorrent' | 'qbittorrent' | 'transmission' | 'unknown'> {
        if (this.cachedBackendType) {
            return this.cachedBackendType;
        }

        try {
            const settings = await this.getClientSettings();

            if (settings.scgiPath || settings.socketPath) {
                this.cachedBackendType = 'rtorrent';
            } else if (settings.webApiUrl) {
                this.cachedBackendType = 'qbittorrent';
            } else if (settings.rpcUrl) {
                this.cachedBackendType = 'transmission';
            } else {
                this.cachedBackendType = 'unknown';
            }
        } catch {
            this.cachedBackendType = 'unknown';
        }

        return this.cachedBackendType;
    }

    /**
     * Get current rate limit status (if available from last request).
     */
    getRateLimitInfo(): FloodRateLimitInfo | null {
        return this.rateLimitInfo;
    }

    // ========================================================================
    // Phase 2: Advanced Torrent Control
    // ========================================================================

    /**
     * Set sequential download mode for torrents.
     * Downloads pieces in order (0, 1, 2...) - useful for streaming.
     * Note: Not supported by all backends (rTorrent requires jesec fork).
     */
    async setSequentialDownload(hashes: string[], enabled: boolean): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch('api/torrents/sequential', {
                hashes,
                isSequential: enabled,
            }, { headers })
        );
    }

    /**
     * Set initial seeding (super seeding) mode for torrents.
     * Optimizes piece distribution in swarms.
     * Note: Primarily supported by qBittorrent, not rTorrent/Transmission.
     */
    async setInitialSeeding(hashes: string[], enabled: boolean): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch('api/torrents/initial-seeding', {
                hashes,
                isInitialSeeding: enabled,
            }, { headers })
        );
    }

    /**
     * Set priority for specific files within a torrent.
     * Priority levels: 0=Skip, 1=Low, 2=Normal, 3=High
     * @param hash - Torrent info hash
     * @param indices - 0-based file indices from torrent contents
     * @param priority - Priority level (0-3)
     */
    async setFilePriority(hash: string, indices: number[], priority: 0 | 1 | 2 | 3): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch(`api/torrents/${hash}/contents`, {
                indices,
                priority,
            }, { headers })
        );
    }

    /**
     * Get the file contents/list for a specific torrent.
     * Returns file metadata including names, sizes, and priorities.
     */
    async getTorrentContents(hash: string): Promise<FloodTorrentContent[]> {
        const headers = this.getHeaders();
        const response = await this.requestWithTimeout(
            () => this.httpClient.get(`api/torrents/${hash}/contents`, { headers }),
            'Get torrent contents timed out'
        );
        return FloodTorrentContentsResponseSchema.parse(response);
    }

    /**
     * Move torrent data to a new location.
     * @param hash - Torrent info hash
     * @param destination - New absolute path for torrent data
     * @param moveFiles - Whether to physically move files (default: true)
     */
    async moveTorrent(hash: string, destination: string, moveFiles: boolean = true): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch(`api/torrents/${hash}/move`, {
                destination,
                moveFiles,
            }, { headers })
        );
    }

    /**
     * Force recheck (verify) torrent data integrity.
     * Useful after moving files or recovering from corruption.
     */
    async recheckTorrent(hashes: string[]): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.post('api/torrents/check-hash', {
                hashes,
            }, { headers })
        );
    }

    /**
     * Set global priority for torrents (queue position).
     * Priority levels: 0=Don't Download, 1=Low, 2=Normal, 3=High
     */
    async setTorrentPriority(hashes: string[] | 'all', priority: 0 | 1 | 2 | 3): Promise<void> {
        const headers = this.getHeaders();
        await this.requestWithRetry(
            () => this.httpClient.patch('api/torrents/priority', {
                hashes,
                priority,
            }, { headers })
        );
    }

    /**
     * Get feature capabilities based on detected backend.
     * Helps UI decide which features to show/hide.
     */
    async getCapabilities(): Promise<FloodCapabilities> {
        const backend = await this.detectBackendType();

        return {
            supportsSequentialDownload: backend !== 'transmission',
            supportsInitialSeeding: backend === 'qbittorrent',
            supportsTags: true,
            supportsFilePriority: true,
            supportsMove: true,
            supportsRecheck: true,
            backendType: backend,
        };
    }

    // ========================================================================
    // Private Helpers
    // ========================================================================

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    private async getTorrentTags(hash: string): Promise<string[]> {
        const torrents = await this.getTorrents();
        const t = torrents.find(t => t.id === hash);
        return t?.tags || [];
    }

    /**
     * Wrap a request with timeout enforcement.
     */
    private async requestWithTimeout<T>(
        requestFn: () => Promise<T>,
        timeoutMessage: string = 'Request timeout',
        timeoutMs: number = DEFAULT_TIMEOUT_MS
    ): Promise<T> {
        const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new FloodTimeoutError(timeoutMessage)), timeoutMs)
        );
        return Promise.race([requestFn(), timeout]);
    }

    /**
     * Execute request with exponential backoff for retryable errors (401, 429).
     */
    private async requestWithRetry<T>(
        requestFn: () => Promise<T>,
        maxAttempts: number = MAX_RETRY_ATTEMPTS
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                return await this.requestWithTimeout(requestFn);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));

                // Parse rate limit info from error if available
                if (this.isRateLimitError(error)) {
                    const backoffTime = this.calculateBackoff(attempt);
                    await this.sleep(backoffTime);
                    continue;
                }

                // For auth errors, try re-authenticating once
                if (this.isAuthError(error) && attempt === 0 && this.sessionVerified) {
                    try {
                        await this.login();
                        continue;
                    } catch {
                        throw new FloodAuthError('Re-authentication failed');
                    }
                }

                // Non-retryable error
                throw error;
            }
        }

        throw lastError || new Error('Max retry attempts exceeded');
    }

    private isRateLimitError(error: unknown): boolean {
        if (error && typeof error === 'object' && 'status' in error) {
            return (error as { status: number }).status === 429;
        }
        return false;
    }

    private isAuthError(error: unknown): boolean {
        if (error && typeof error === 'object' && 'status' in error) {
            return (error as { status: number }).status === 401;
        }
        return false;
    }

    private calculateBackoff(attempt: number): number {
        // Exponential backoff with jitter: 1s, 2s, 4s + random jitter
        const exponentialDelay = BASE_BACKOFF_DELAY_MS * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        return exponentialDelay + jitter;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private mapToEntity(t: FloodTorrent): Torrent {
        return {
            id: t.hash,
            name: t.name,
            status: FloodAdapter.mapStatus(t.state),
            progress: t.progress * 100, // Flood is 0-1
            size: t.sizeBytes,
            downloadSpeed: t.dnRate,
            uploadSpeed: t.upRate,
            eta: t.eta,
            savePath: t.basePath || t.directory || '',
            addedDate: (t.added || t.dateAdded || 0) * 1000,
            tags: t.tags || [],
            category: t.tags && t.tags.length > 0 ? t.tags[0] : undefined,
        };
    }

    private static mapStatus(states: string[]): TorrentStatus {
        // Flood returns array of states: ['downloading', 'active']
        // Priority order: error > active states > passive states
        if (states.includes('error')) return 'error';
        if (states.includes('downloading')) return 'downloading';
        if (states.includes('seeding')) return 'seeding';
        // qBittorrent v5 uses 'stopped', legacy uses 'paused'
        if (states.includes('paused') || states.includes('stopped')) return 'paused';
        if (states.includes('checking') || states.includes('hashing')) return 'checking';
        if (states.includes('complete')) return 'completed';
        if (states.includes('queued')) return 'queued';
        return 'unknown';
    }
}
