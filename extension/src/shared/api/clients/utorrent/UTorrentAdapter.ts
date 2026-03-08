import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { extractUTorrentToken } from './UTorrentParsingUtils';
import { UTorrentResponseSchema, TORRENT_INDEX, STATUS_FLAG } from './UTorrentSchema';
import { ServerConfig } from '@/shared/lib/types';

/** File information returned by getFiles */
export interface TorrentFile {
    index: number;
    name: string;
    size: number;
    downloaded: number;
    priority: 0 | 1 | 2 | 3;
    progress: number;
}

/** Maximum retry attempts for session recovery */
const MAX_RETRY_ATTEMPTS = 2;

@injectable()
export class UTorrentAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private token: string | null = null;
    private cacheId: string | null = null;
    private torrentCache: Map<string, (string | number)[]> = new Map();
    private baseUrl: string;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.baseUrl = 'gui/';
    }

    async login(): Promise<void> {
        const headers = this.getAuthHeaders();
        const response = await this.httpClient.get<string>('gui/token.html', {
            headers,
        });

        this.token = extractUTorrentToken(response);
    }

    async logout(): Promise<void> {
        this.token = null;
        this.cacheId = null;
        this.torrentCache.clear();
    }

    async getTorrents(): Promise<Torrent[]> {
        const params = new URLSearchParams({ list: '1' });

        // Use delta sync if we have a cache ID
        if (this.cacheId) {
            params.append('cid', this.cacheId);
        }

        const response = await this.call(params);
        const parsed = UTorrentResponseSchema.parse(response);

        // Update cache ID for next delta fetch
        if (parsed.torrentc) {
            this.cacheId = parsed.torrentc;
        }

        // Handle full list response (initial or cache invalidated)
        if (parsed.torrents && parsed.torrents.length > 0) {
            this.torrentCache.clear();
            for (const torrent of parsed.torrents) {
                const hash = String(torrent[TORRENT_INDEX.HASH]);
                this.torrentCache.set(hash, torrent);
            }
        }

        // Apply delta patches
        if (parsed.torrentp) {
            for (const torrent of parsed.torrentp) {
                const hash = String(torrent[TORRENT_INDEX.HASH]);
                this.torrentCache.set(hash, torrent);
            }
        }

        // Remove deleted torrents
        if (parsed.torrents_removed) {
            for (const hash of parsed.torrents_removed) {
                this.torrentCache.delete(hash);
            }
        }

        return Array.from(this.torrentCache.values()).map(this.mapToEntity.bind(this));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const params = new URLSearchParams({ action: 'add-url', s: url });
        if (options?.path) params.append('path', options.path);
        await this.call(params);
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const formData = new FormData();
        formData.append('torrent_file', file, 'torrent.torrent');
        if (options?.path) formData.append('path', options.path);

        const queryParams = new URLSearchParams({ action: 'add-file' });
        await this.call(queryParams, 'POST', formData);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call(new URLSearchParams({ action: 'pause', hash: id }));
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call(new URLSearchParams({ action: 'start', hash: id }));
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        const action = deleteData ? 'removedata' : 'remove';
        await this.call(new URLSearchParams({ action, hash: id }));
    }

    async getCategories(): Promise<string[]> {
        const params = new URLSearchParams({ list: '1' });
        const response = await this.call(params);
        const parsed = UTorrentResponseSchema.parse(response);

        if (parsed.label) {
            return parsed.label.map(l => String(l[0]));
        }
        return [];
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'label',
            v: category
        }));
    }

    async getTags(): Promise<string[]> {
        // uTorrent uses labels as the only categorization - no separate tags
        return this.getCategories();
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // uTorrent only supports a single label, use the first tag
        if (tags.length > 0) {
            await this.setCategory(hash, tags[0]);
        }
    }

    async removeTags(_hash: string, _tags: string[]): Promise<void> {
        // uTorrent doesn't support tag removal - labels are single-value
        // Clear by setting empty label would remove all categorization
    }

    async testConnection(): Promise<boolean> {
        await this.login();
        return true;
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.login();
        return Date.now() - start;
    }

    // ========== Extended Operations ==========

    /**
     * Force start a torrent, bypassing queue limits
     */
    async forceStartTorrent(id: string): Promise<void> {
        await this.call(new URLSearchParams({ action: 'forcestart', hash: id }));
    }

    /**
     * Force recheck (verify) torrent data
     */
    async recheckTorrent(id: string): Promise<void> {
        await this.call(new URLSearchParams({ action: 'recheck', hash: id }));
    }

    /**
     * Stop a torrent (different from pause - fully stops activity)
     */
    async stopTorrent(id: string): Promise<void> {
        await this.call(new URLSearchParams({ action: 'stop', hash: id }));
    }

    /**
     * Set per-torrent upload speed limit
     * @param bytesPerSecond - Upload limit in bytes/second (0 = unlimited)
     */
    async setUploadLimit(hash: string, bytesPerSecond: number): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'ulrate',
            v: String(bytesPerSecond)
        }));
    }

    /**
     * Set per-torrent download speed limit
     * @param bytesPerSecond - Download limit in bytes/second (0 = unlimited)
     */
    async setDownloadLimit(hash: string, bytesPerSecond: number): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'dlrate',
            v: String(bytesPerSecond)
        }));
    }

    // ========== File Management ==========

    /**
     * Get the list of files in a torrent
     * @returns Array of file objects with name, size, downloaded, and priority
     */
    async getFiles(hash: string): Promise<TorrentFile[]> {
        const params = new URLSearchParams({ action: 'getfiles', hash });
        const response = await this.call(params);

        // Response format: { files: [[hash, [[name, size, downloaded, priority], ...]]] }
        const data = response as { files?: [string, (string | number)[][]][] };

        if (!data.files || data.files.length === 0) {
            return [];
        }

        const torrentFiles = data.files.find(f => f[0] === hash);
        if (!torrentFiles || !torrentFiles[1]) {
            return [];
        }

        return torrentFiles[1].map((file, index) => ({
            index,
            name: String(file[0]),
            size: Number(file[1]),
            downloaded: Number(file[2]),
            priority: Number(file[3]) as 0 | 1 | 2 | 3,
            progress: Number(file[1]) > 0 ? (Number(file[2]) / Number(file[1])) * 100 : 0,
        }));
    }

    /**
     * Set the download priority for a specific file
     * @param fileIndex - 0-based file index
     * @param priority - 0=Skip, 1=Low, 2=Normal, 3=High
     */
    async setFilePriority(hash: string, fileIndex: number, priority: 0 | 1 | 2 | 3): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'setprio',
            hash,
            f: String(fileIndex),
            p: String(priority)
        }));
    }

    /**
     * Skip downloading a file (set priority to 0)
     */
    async skipFile(hash: string, fileIndex: number): Promise<void> {
        await this.setFilePriority(hash, fileIndex, 0);
    }

    // ========== Tracker Management ==========

    /**
     * Get the list of trackers for a torrent
     * @returns Array of tracker URLs
     */
    async getTrackers(hash: string): Promise<string[]> {
        const params = new URLSearchParams({ action: 'getprops', hash });
        const response = await this.call(params);

        const data = response as { props?: { hash: string; trackers?: string }[] };

        if (!data.props || data.props.length === 0) {
            return [];
        }

        const props = data.props.find(p => p.hash === hash);
        if (!props?.trackers) {
            return [];
        }

        // Trackers are newline-separated
        return props.trackers
            .split(/\r?\n/)
            .map(t => t.trim())
            .filter(t => t.length > 0);
    }

    /**
     * Add a tracker to a torrent
     */
    async addTracker(hash: string, trackerUrl: string): Promise<void> {
        const currentTrackers = await this.getTrackers(hash);

        // Avoid duplicates
        if (currentTrackers.includes(trackerUrl)) {
            return;
        }

        const newTrackers = [...currentTrackers, trackerUrl].join('\r\n');
        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'trackers',
            v: newTrackers
        }));
    }

    /**
     * Remove a tracker from a torrent
     */
    async removeTracker(hash: string, trackerUrl: string): Promise<void> {
        const currentTrackers = await this.getTrackers(hash);
        const filteredTrackers = currentTrackers.filter(t => t !== trackerUrl);

        if (filteredTrackers.length === currentTrackers.length) {
            return; // Tracker wasn't present
        }

        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'trackers',
            v: filteredTrackers.join('\r\n')
        }));
    }

    /**
     * Replace all trackers for a torrent
     */
    async setTrackers(hash: string, trackerUrls: string[]): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'setprops',
            hash,
            s: 'trackers',
            v: trackerUrls.join('\r\n')
        }));
    }

    // ========== Private Methods ==========

    /**
     * Execute an API call with automatic session recovery
     */
    private async call(
        params: URLSearchParams,
        method: 'GET' | 'POST' = 'GET',
        body?: BodyInit,
        retryCount: number = 0
    ): Promise<unknown> {
        // Ensure we have a valid session
        if (!this.token) {
            await this.login();
        }

        params.append('token', this.token || '');
        params.append('t', String(Date.now())); // Cache buster

        const url = `${this.baseUrl}?${params.toString()}`;
        const headers = this.getAuthHeaders();

        try {
            if (method === 'POST') {
                return await this.httpClient.post(url, body, { headers });
            } else {
                return await this.httpClient.get(url, { headers });
            }
        } catch (error) {
            // Session recovery: retry on auth failures
            if (this.isAuthError(error) && retryCount < MAX_RETRY_ATTEMPTS) {
                this.token = null; // Invalidate token
                await this.login();

                // Remove old token params and retry
                params.delete('token');
                params.delete('t');
                return this.call(params, method, body, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Check if error indicates authentication failure
     */
    private isAuthError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return message.includes('400') ||
                message.includes('401') ||
                message.includes('unauthorized') ||
                message.includes('token');
        }
        return false;
    }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.username || this.config.password) {
            const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }

    /**
     * Map raw torrent array to normalized Torrent entity
     */
    private mapToEntity(r: (string | number)[]): Torrent {
        const hash = String(r[TORRENT_INDEX.HASH]);
        const statusNum = Number(r[TORRENT_INDEX.STATUS]);
        const name = String(r[TORRENT_INDEX.NAME]);
        const size = Number(r[TORRENT_INDEX.SIZE]);
        const percent = Number(r[TORRENT_INDEX.PERCENT]);
        const downSpeed = Number(r[TORRENT_INDEX.DOWNLOAD_SPEED]);
        const upSpeed = Number(r[TORRENT_INDEX.UPLOAD_SPEED]);
        const eta = Number(r[TORRENT_INDEX.ETA]);
        const label = String(r[TORRENT_INDEX.LABEL] || '');

        // Extract extended metadata with bounds checking
        const dateAdded = r.length > TORRENT_INDEX.DATE_ADDED
            ? Number(r[TORRENT_INDEX.DATE_ADDED])
            : 0;
        const savePath = r.length > TORRENT_INDEX.SAVE_PATH
            ? String(r[TORRENT_INDEX.SAVE_PATH] || '')
            : '';

        return {
            id: hash,
            name: name,
            status: this.mapStatus(statusNum, percent),
            progress: percent / 10, // Convert permils to percentage
            size: size,
            downloadSpeed: downSpeed,
            uploadSpeed: upSpeed,
            eta: eta,
            savePath: savePath,
            addedDate: dateAdded,
            category: label,
            tags: [],
        };
    }

    /**
     * Map uTorrent status bitmask to normalized TorrentStatus
     * Uses priority-based evaluation with progress differentiation
     */
    private mapStatus(status: number, progress: number): TorrentStatus {
        // Priority 1: Error state (highest)
        if (status & STATUS_FLAG.ERROR) {
            return 'error';
        }

        // Priority 2: Checking/verifying
        if (status & STATUS_FLAG.CHECKING) {
            return 'checking';
        }

        // Priority 3: Paused
        if (status & STATUS_FLAG.PAUSED) {
            return 'paused';
        }

        // Priority 4: Queued (differentiate by progress)
        if (status & STATUS_FLAG.QUEUED) {
            return progress >= 1000 ? 'seeding' : 'downloading';
        }

        // Priority 5: Active (differentiate by progress)
        if (status & STATUS_FLAG.STARTED) {
            return progress >= 1000 ? 'seeding' : 'downloading';
        }

        // Fallback: Stopped/completed
        return 'paused';
    }
}
