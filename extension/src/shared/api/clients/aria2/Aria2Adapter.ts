import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { JsonRpcClient } from '@/shared/api/network/JsonRpcClient';
import { Aria2TorrentSchema, Aria2Torrent } from './Aria2Schema';
import { Aria2Error } from './Aria2Error';
import { ServerConfig } from '@/shared/lib/types';
import { z } from 'zod';
import { blobToBase64 } from '@/shared/lib/helpers';

/** Version information from aria2.getVersion */
interface Aria2VersionInfo {
    version: string;
    enabledFeatures: string[];
}

/** Retry configuration */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 8000,
};

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Sleep helper for retry delays
 */
const sleep = (ms: number): Promise<void> =>
    new Promise(resolve => setTimeout(resolve, ms));

@injectable()
export class Aria2Adapter implements ITorrentClient {
    private rpcClient: JsonRpcClient;
    private secret: string;
    private daemonVersion: string | null = null;
    private enabledFeatures: string[] = [];

    constructor(config: ServerConfig) {
        // Aria2 usually runs on /jsonrpc
        this.rpcClient = new JsonRpcClient(config.hostname);
        // Aria2 uses 'token:secret' as the first param in methods if using --rpc-secret
        this.secret = config.password || '';
    }

    /**
     * Authenticate and verify daemon capabilities.
     * Validates RPC secret and checks for BitTorrent support.
     */
    async login(): Promise<void> {
        const versionInfo = await this.getVersionInfo();

        this.daemonVersion = versionInfo.version;
        this.enabledFeatures = versionInfo.enabledFeatures;

        // Warn if BitTorrent is not enabled (compile-time feature)
        if (!this.enabledFeatures.includes('BitTorrent')) {
            console.warn('Aria2 daemon does not have BitTorrent support enabled');
        }
    }

    async logout(): Promise<void> {
        // Aria2 is stateless - no-op
        this.daemonVersion = null;
        this.enabledFeatures = [];
    }

    async getTorrents(): Promise<Torrent[]> {
        // Use system.multicall to batch 3 requests into 1 HTTP call
        // This significantly reduces network overhead for dashboard updates
        const fields = this.getDefaultFields();

        const result = await this.multicall([
            { method: 'aria2.tellActive', params: [fields] },
            { method: 'aria2.tellWaiting', params: [0, 1000, fields] },
            { method: 'aria2.tellStopped', params: [0, 1000, fields] },
        ]);

        // Multicall returns array of results in order
        const [active, waiting, stopped] = result as [unknown[], unknown[], unknown[]];
        const all = [...active, ...waiting, ...stopped];

        // Validate with expanded schema
        const schema = z.array(Aria2TorrentSchema);
        const parsed = schema.parse(all);

        return parsed.map(t => this.mapToEntity(t));
    }

    /**
     * Get torrents with minimal fields for faster dashboard polling.
     * Use this for high-frequency updates where full metadata isn't needed.
     */
    async getTorrentsLight(): Promise<Torrent[]> {
        // Minimal fields for fast polling
        const fields = ['gid', 'status', 'totalLength', 'completedLength',
            'downloadSpeed', 'uploadSpeed', 'dir'];

        const result = await this.multicall([
            { method: 'aria2.tellActive', params: [fields] },
            { method: 'aria2.tellWaiting', params: [0, 1000, fields] },
            { method: 'aria2.tellStopped', params: [0, 1000, fields] },
        ]);

        const [active, waiting, stopped] = result as [unknown[], unknown[], unknown[]];
        const all = [...active, ...waiting, ...stopped];

        const schema = z.array(Aria2TorrentSchema);
        const parsed = schema.parse(all);

        return parsed.map(t => this.mapToEntity(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const opts = this.mapOptions(options);
        await this.call('aria2.addUri', [[url], opts]);
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        const opts = this.mapOptions(options);
        // Note: Empty array for web-seeding URIs is required before options
        await this.call('aria2.addTorrent', [base64, [], opts]);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call('aria2.pause', [id]);
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call('aria2.unpause', [id]);
    }

    async removeTorrent(id: string, _deleteData: boolean = false): Promise<void> {
        // Note: Aria2 doesn't support deleting files via RPC.
        // Standard remove just removes the task from the queue.
        await this.call('aria2.remove', [id]);

        // Also clean up from download results (history)
        try {
            await this.call('aria2.removeDownloadResult', [id]);
        } catch {
            // Ignore - GID may not exist in results
        }
    }

    /**
     * Test connection with diagnostic information.
     * Returns true if connection successful, false otherwise.
     */
    async testConnection(): Promise<boolean> {
        try {
            await this.getVersionInfo();
            return true;
        } catch (error) {
            if (error instanceof Aria2Error) {
                // Log specific error type for diagnostics
                console.error(`Aria2 connection test failed: ${error.code} - ${error.message}`);
            }
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('aria2.getVersion', []);
        return Date.now() - start;
    }

    // =====================
    // Aria2-Specific Methods
    // =====================

    /**
     * Get daemon version and enabled features
     */
    async getVersionInfo(): Promise<Aria2VersionInfo> {
        const result = await this.call('aria2.getVersion', []) as Aria2VersionInfo;
        return {
            version: result.version,
            enabledFeatures: result.enabledFeatures || [],
        };
    }

    /**
     * Get global download statistics
     */
    async getGlobalStats(): Promise<{
        downloadSpeed: number;
        uploadSpeed: number;
        activeCount: number;
        waitingCount: number;
        stoppedCount: number;
    }> {
        const stats = await this.call('aria2.getGlobalStat', []) as Record<string, string>;
        return {
            downloadSpeed: parseInt(stats.downloadSpeed) || 0,
            uploadSpeed: parseInt(stats.uploadSpeed) || 0,
            activeCount: parseInt(stats.numActive) || 0,
            waitingCount: parseInt(stats.numWaiting) || 0,
            stoppedCount: parseInt(stats.numStopped) || 0,
        };
    }

    /**
     * Save the current session (queue) to disk.
     * Useful for persistence across daemon restarts.
     */
    async saveSession(): Promise<void> {
        await this.call('aria2.saveSession', []);
    }

    /**
     * Get the current daemon version (after login)
     */
    getDaemonVersion(): string | null {
        return this.daemonVersion;
    }

    /**
     * Check if a specific feature is enabled
     */
    hasFeature(feature: string): boolean {
        return this.enabledFeatures.includes(feature);
    }

    // =====================
    // File Management
    // =====================

    /**
     * Get file list for a specific download.
     * Useful for multi-file torrents to show individual file progress.
     */
    async getFiles(gid: string): Promise<{
        index: number;
        path: string;
        size: number;
        completed: number;
        selected: boolean;
        progress: number;
    }[]> {
        const result = await this.call('aria2.getFiles', [gid]) as Array<{
            index: string;
            path: string;
            length: string;
            completedLength: string;
            selected: string;
        }>;

        return result.map(f => {
            const size = parseInt(f.length) || 0;
            const completed = parseInt(f.completedLength) || 0;
            return {
                index: parseInt(f.index) || 0,
                path: f.path,
                size,
                completed,
                selected: f.selected === 'true',
                progress: size > 0 ? (completed / size) * 100 : 0,
            };
        });
    }

    /**
     * Select which files to download in a multi-file torrent.
     * Uses 0-based indices (converts to Aria2's 1-based internally).
     * 
     * @param gid - Download GID
     * @param indices - Array of 0-based file indices to download
     * @param removeUnselected - If true, delete already downloaded but now unselected files
     */
    async selectFiles(gid: string, indices: number[], removeUnselected: boolean = false): Promise<void> {
        // Convert 0-based to 1-based indices for Aria2
        const selectFile = indices.map(i => i + 1).join(',');

        const options: Record<string, string> = {
            'select-file': selectFile,
        };

        if (removeUnselected) {
            options['bt-remove-unselected-file'] = 'true';
        }

        await this.call('aria2.changeOption', [gid, options]);
    }

    // =====================
    // Bandwidth Control
    // =====================

    /**
     * Set global speed limits for all downloads.
     * Pass 0 for unlimited.
     * 
     * @param downloadLimit - Max download speed in bytes/second
     * @param uploadLimit - Max upload speed in bytes/second
     */
    async setGlobalSpeedLimits(downloadLimit: number, uploadLimit: number): Promise<void> {
        await this.call('aria2.changeGlobalOption', [{
            'max-overall-download-limit': downloadLimit.toString(),
            'max-overall-upload-limit': uploadLimit.toString(),
        }]);
    }

    /**
     * Set speed limits for a specific download.
     * Pass 0 for unlimited.
     * 
     * @param gid - Download GID
     * @param downloadLimit - Max download speed in bytes/second
     * @param uploadLimit - Max upload speed in bytes/second
     */
    async setTorrentSpeedLimits(gid: string, downloadLimit: number, uploadLimit: number): Promise<void> {
        await this.call('aria2.changeOption', [gid, {
            'max-download-limit': downloadLimit.toString(),
            'max-upload-limit': uploadLimit.toString(),
        }]);
    }

    /**
     * Get current global options including speed limits
     */
    async getGlobalOptions(): Promise<{
        maxDownloadLimit: number;
        maxUploadLimit: number;
        maxConcurrentDownloads: number;
    }> {
        const opts = await this.call('aria2.getGlobalOption', []) as Record<string, string>;
        return {
            maxDownloadLimit: parseInt(opts['max-overall-download-limit']) || 0,
            maxUploadLimit: parseInt(opts['max-overall-upload-limit']) || 0,
            maxConcurrentDownloads: parseInt(opts['max-concurrent-downloads']) || 5,
        };
    }

    // =====================
    // Peer Information
    // =====================

    /**
     * Get connected peers for a BitTorrent download.
     * Only works for active BitTorrent downloads.
     */
    async getPeers(gid: string): Promise<{
        ip: string;
        port: number;
        downloadSpeed: number;
        uploadSpeed: number;
        isSeeder: boolean;
        isChoking: boolean;
        amChoking: boolean;
    }[]> {
        const result = await this.call('aria2.getPeers', [gid]) as Array<{
            ip: string;
            port: string;
            downloadSpeed: string;
            uploadSpeed: string;
            seeder: string;
            peerChoking: string;
            amChoking: string;
        }>;

        return result.map(p => ({
            ip: p.ip,
            port: parseInt(p.port) || 0,
            downloadSpeed: parseInt(p.downloadSpeed) || 0,
            uploadSpeed: parseInt(p.uploadSpeed) || 0,
            isSeeder: p.seeder === 'true',
            isChoking: p.peerChoking === 'true',
            amChoking: p.amChoking === 'true',
        }));
    }

    /**
     * Get detailed status for a single download.
     * Includes all available metadata.
     */
    async getDetailedStatus(gid: string): Promise<Aria2Torrent | null> {
        try {
            const result = await this.call('aria2.tellStatus', [gid]) as Aria2Torrent;
            return Aria2TorrentSchema.parse(result);
        } catch (error) {
            if (error instanceof Aria2Error && error.code === 'GID_NOT_FOUND') {
                return null;
            }
            throw error;
        }
    }

    /**
     * Force remove a download (skips tracker notification).
     * Use for stuck downloads or when normal remove hangs.
     */
    async forceRemoveTorrent(gid: string): Promise<void> {
        await this.call('aria2.forceRemove', [gid]);
    }

    /**
     * Force pause a download (skips graceful pause).
     */
    async forcePauseTorrent(gid: string): Promise<void> {
        await this.call('aria2.forcePause', [gid]);
    }

    // =====================
    // Private Helpers
    // =====================

    /**
     * Make an RPC call with retry logic and error handling
     */
    private async call(method: string, params: unknown[]): Promise<unknown> {
        const secureParams = this.secret ? [`token:${this.secret}`, ...params] : params;

        return this.callWithRetry(async () => {
            return this.rpcClient.call(method, secureParams);
        }, method);
    }

    /**
     * Execute multiple RPC calls in a single HTTP request using system.multicall.
     * This batches requests for significant performance improvement.
     * 
     * @param calls - Array of method/params pairs to execute
     * @returns Array of results in the same order as the calls
     */
    private async multicall(
        calls: Array<{ method: string; params: unknown[] }>
    ): Promise<unknown[]> {
        // Build the multicall payload
        // Note: Token must be inside each method call, not at the top level
        const multicallParams = calls.map(({ method, params }) => {
            const secureParams = this.secret
                ? [`token:${this.secret}`, ...params]
                : params;
            return {
                methodName: method,
                params: secureParams,
            };
        });

        const result = await this.callWithRetry(async () => {
            return this.rpcClient.call('system.multicall', [multicallParams]);
        }, 'system.multicall');

        // Multicall wraps each result in an array, unwrap them
        // Result format: [[result1], [result2], ...] or [{error: {...}}] for errors
        const results = result as Array<unknown[] | { error: unknown }>;

        return results.map((r, i) => {
            if (Array.isArray(r)) {
                return r[0]; // Unwrap the result
            }
            // Handle per-call errors
            const error = r as { error?: { code: number; message: string } };
            if (error.error) {
                throw Aria2Error.fromRpcError(error.error, calls[i].method);
            }
            return r;
        });
    }

    /**
     * Get the default fields for torrent status queries.
     * These are the fields needed for full dashboard display.
     */
    private getDefaultFields(): string[] {
        return [
            'gid', 'status', 'totalLength', 'completedLength', 'uploadLength',
            'downloadSpeed', 'uploadSpeed', 'dir', 'bittorrent', 'files',
            'infoHash', 'errorCode', 'errorMessage', 'numSeeders', 'connections'
        ];
    }

    /**
     * Execute a call with exponential backoff retry on retryable errors
     */
    private async callWithRetry(
        fn: () => Promise<unknown>,
        context: string,
        attempt: number = 0
    ): Promise<unknown> {
        try {
            return await this.withTimeout(fn(), REQUEST_TIMEOUT_MS);
        } catch (error) {
            const aria2Error = this.wrapError(error, context);

            // Only retry on network errors, not auth or logic errors
            if (aria2Error.retryable && attempt < RETRY_CONFIG.maxRetries) {
                const delay = Math.min(
                    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
                    RETRY_CONFIG.maxDelayMs
                );
                await sleep(delay);
                return this.callWithRetry(fn, context, attempt + 1);
            }

            throw aria2Error;
        }
    }

    /**
     * Wrap errors in typed Aria2Error
     */
    private wrapError(error: unknown, context: string): Aria2Error {
        // Already an Aria2Error
        if (error instanceof Aria2Error) {
            return error;
        }

        // JSON-RPC error response
        if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
            return Aria2Error.fromRpcError(
                error as { code: number; message: string },
                context
            );
        }

        // Network/fetch error
        if (error instanceof Error) {
            return Aria2Error.fromNetworkError(error, context);
        }

        // Unknown error
        return new Aria2Error({
            code: 'UNKNOWN',
            message: String(error),
            context,
            retryable: false,
        });
    }

    /**
     * Add timeout to a promise
     */
    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Request timeout after ${ms}ms`));
                }, ms);
            }),
        ]);
    }

    /**
     * Map AddTorrentOptions to Aria2 option format
     */
    private mapOptions(options?: AddTorrentOptions): Record<string, string> {
        if (!options) return {};
        const opts: Record<string, string> = {};
        if (options.path) opts['dir'] = options.path;
        if (options.paused) opts['pause'] = 'true';
        return opts;
    }

    /**
     * Map Aria2 torrent data to unified Torrent entity
     */
    private mapToEntity(t: Aria2Torrent): Torrent {
        // Extract display name with fallback chain
        const name = this.extractName(t);

        // Calculate ETA client-side
        const eta = this.calculateEta(t);

        return {
            id: t.gid,
            name,
            status: Aria2Adapter.mapStatus(t.status, t.errorCode),
            progress: this.calculateProgress(t),
            size: parseInt(t.totalLength) || 0,
            downloadSpeed: parseInt(t.downloadSpeed) || 0,
            uploadSpeed: parseInt(t.uploadSpeed) || 0,
            eta,
            savePath: t.dir,
            addedDate: 0, // Aria2 doesn't provide this
        };
    }

    /**
     * Extract display name from torrent data
     * Priority: bittorrent.info.name > files[0].path > gid
     */
    private extractName(t: Aria2Torrent): string {
        // 1. Try BitTorrent metadata name
        if (t.bittorrent?.info?.name) {
            return t.bittorrent.info.name;
        }

        // 2. Try first file path (basename)
        if (t.files && t.files.length > 0 && t.files[0].path) {
            const path = t.files[0].path;
            const parts = path.split(/[/\\]/);
            return parts[parts.length - 1] || path;
        }

        // 3. Fallback to GID
        return `Download ${t.gid}`;
    }

    /**
     * Calculate ETA in seconds from remaining bytes and speed
     */
    private calculateEta(t: Aria2Torrent): number {
        const total = parseInt(t.totalLength) || 0;
        const completed = parseInt(t.completedLength) || 0;
        const speed = parseInt(t.downloadSpeed) || 0;

        if (speed <= 0 || completed >= total) {
            return 0;
        }

        const remaining = total - completed;
        return Math.floor(remaining / speed);
    }

    /**
     * Calculate progress percentage
     */
    private calculateProgress(t: Aria2Torrent): number {
        const total = parseInt(t.totalLength) || 0;
        const completed = parseInt(t.completedLength) || 0;

        if (total <= 0) return 0;
        return (completed / total) * 100;
    }

    /**
     * Map Aria2 status to unified TorrentStatus
     */
    private static mapStatus(status: string, errorCode?: string): TorrentStatus {
        // Check for error first
        if (errorCode && errorCode !== '0') {
            return 'error';
        }

        switch (status) {
            case 'active':
                return 'downloading';
            case 'waiting':
                return 'queued';
            case 'paused':
                return 'paused';
            case 'error':
                return 'error';
            case 'complete':
                return 'completed';
            case 'removed':
                return 'unknown';
            default:
                return 'unknown';
        }
    }

    // =====================
    // Interface Stubs (Unsupported Features)
    // =====================

    async getCategories(): Promise<string[]> {
        // Aria2 doesn't support categories
        return [];
    }

    async setCategory(_hash: string, _category: string): Promise<void> {
        // Aria2 doesn't support categories - no-op
    }

    async getTags(): Promise<string[]> {
        // Aria2 doesn't support tags
        return [];
    }

    async addTags(_hash: string, _tags: string[]): Promise<void> {
        // Aria2 doesn't support tags - no-op
    }

    async removeTags(_hash: string, _tags: string[]): Promise<void> {
        // Aria2 doesn't support tags - no-op
    }
}
