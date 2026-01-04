import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { ServerConfig } from '@/shared/lib/types';
import {
    SynologyAuthData,
    SynologyTask,
    SynologyTaskListSchema,
    SynologyTaskStatus,
    SynologyResponseSchema,
    SynologyAuthDataSchema,
    SynologyAPIInfoSchema,
} from './SynologySchema';
import { z } from 'zod';

/**
 * Synology Download Station Adapter
 * 
 * Implements ITorrentClient for Synology NAS Download Station.
 * Uses session-based auth (sid token) and supports:
 * - Magnet links and .torrent file upload
 * - 2FA via OTP codes
 * - Device token for trusted device bypass
 */
@injectable()
export class SynologyAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;
    private sid: string | null = null;
    private synotoken: string | null = null;
    private apiPaths: Record<string, string> = {};

    // Default paths (may be overridden by discovery)
    private static readonly DEFAULT_PATHS = {
        auth: '/webapi/auth.cgi',
        task: '/webapi/DownloadStation/task.cgi',
        info: '/webapi/DownloadStation/info.cgi',
        statistic: '/webapi/DownloadStation/statistic.cgi',
        entry: '/webapi/entry.cgi',
    };

    constructor(config: ServerConfig) {
        this.config = config;
        this.baseUrl = config.hostname.replace(/\/$/, '');
        this.client = new FetchHttpClient(this.baseUrl);
    }

    /**
     * Discover API paths via SYNO.API.Info
     */
    private async discoverAPIs(): Promise<void> {
        try {
            const params = new URLSearchParams({
                api: 'SYNO.API.Info',
                version: '1',
                method: 'query',
                query: 'SYNO.API.Auth,SYNO.DownloadStation.Task,SYNO.DownloadStation.Info',
            });

            const response = await this.client.get<any>(`/webapi/query.cgi?${params}`);

            if (response?.success && response?.data) {
                const validated = SynologyAPIInfoSchema.parse(response.data);

                if (validated['SYNO.API.Auth']) {
                    this.apiPaths.auth = `/webapi/${validated['SYNO.API.Auth'].path}`;
                }
                if (validated['SYNO.DownloadStation.Task']) {
                    this.apiPaths.task = `/webapi/${validated['SYNO.DownloadStation.Task'].path}`;
                }

                console.log('[Synology] API Discovery successful:', this.apiPaths);
            }
        } catch (error) {
            console.warn('[Synology] API Discovery failed, using defaults:', error);
        }
    }

    /**
     * Get the path for an API, with fallback to defaults
     */
    private getPath(api: keyof typeof SynologyAdapter.DEFAULT_PATHS): string {
        return this.apiPaths[api] || SynologyAdapter.DEFAULT_PATHS[api];
    }

    async login(): Promise<void> {
        console.log(`[Synology] Logging in to ${this.baseUrl} as ${this.config.username}`);

        // First, discover API paths
        await this.discoverAPIs();

        const params = new URLSearchParams({
            api: 'SYNO.API.Auth',
            version: '6',
            method: 'login',
            account: this.config.username || '',
            passwd: this.config.password || '',
            session: 'DownloadStation',
            format: 'sid',
            enable_syno_token: 'yes',
            enable_device_token: 'yes',
        });

        // Add OTP code if provided (for 2FA)
        if (this.config.clientOptions?.otpCode) {
            params.append('otp_code', this.config.clientOptions.otpCode as string);
        }

        // Add device token if previously saved (bypasses 2FA)
        if (this.config.clientOptions?.deviceToken) {
            params.append('device_id', this.config.clientOptions.deviceToken as string);
        }

        const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

        if (!response?.success) {
            const errorCode = response?.error?.code || 0;
            throw new Error(this.getAuthError(errorCode));
        }

        const authData = SynologyAuthDataSchema.parse(response.data);
        this.sid = authData.sid;
        this.synotoken = authData.synotoken || null;

        console.log('[Synology] Login successful');

        // Return device token for storage (enables 2FA bypass)
        if (authData.did && !this.config.clientOptions?.deviceToken) {
            console.log('[Synology] Device token received for future 2FA bypass');
            // Note: Caller should store this in config.clientOptions.deviceToken
        }
    }

    /**
     * Get human-readable error message for auth error codes
     */
    private getAuthError(code: number): string {
        const errors: Record<number, string> = {
            400: 'No such account or incorrect password',
            401: 'Account disabled',
            402: 'Permission denied',
            403: '2-factor authentication code required',
            404: '2-factor authentication failed',
            406: 'Enforce 2FA required',
            407: 'Blocked IP source',
            408: 'Account is blocked due to too many failed attempts',
            409: 'Network failure',
            410: 'SID not found',
            411: 'Account expired',
        };
        return errors[code] || `Authentication failed (code: ${code})`;
    }

    async logout(): Promise<void> {
        if (!this.sid) return;

        const params = new URLSearchParams({
            api: 'SYNO.API.Auth',
            version: '6',
            method: 'logout',
            session: 'DownloadStation',
            _sid: this.sid,
        });

        try {
            await this.client.get(`${this.getPath('entry')}?${params}`);
        } catch {
            // Ignore logout errors
        }

        this.sid = null;
        this.synotoken = null;
    }

    async getTorrents(): Promise<Torrent[]> {
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Task',
            version: '1',
            method: 'list',
            additional: 'detail,transfer,file',
            _sid: this.sid!,
        });

        const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

        if (!response?.success) {
            throw new Error('Failed to get torrents');
        }

        const data = SynologyTaskListSchema.parse(response.data);
        return data.tasks.map(t => this.mapTorrent(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Task',
            version: '1',
            method: 'create',
            uri: url,
            _sid: this.sid!,
        });

        if (options?.path) {
            params.append('destination', options.path);
        }

        const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

        if (!response?.success) {
            const code = response?.error?.code || 0;
            throw new Error(this.getTaskError(code));
        }
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        await this.ensureSession();

        const form = new FormData();
        form.append('api', 'SYNO.DownloadStation.Task');
        form.append('version', '1');
        form.append('method', 'create');
        form.append('_sid', this.sid!);
        form.append('file', file, 'torrent.torrent');

        if (options?.path) {
            form.append('destination', options.path);
        }

        const response = await this.client.post<any>(this.getPath('entry'), form);

        if (!response?.success) {
            const code = response?.error?.code || 0;
            throw new Error(this.getTaskError(code));
        }
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Task',
            version: '1',
            method: 'pause',
            id: id,
            _sid: this.sid!,
        });

        await this.client.get(`${this.getPath('entry')}?${params}`);
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Task',
            version: '1',
            method: 'resume',
            id: id,
            _sid: this.sid!,
        });

        await this.client.get(`${this.getPath('entry')}?${params}`);
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Task',
            version: '1',
            method: 'delete',
            id: id,
            force_complete: deleteData ? 'true' : 'false',
            _sid: this.sid!,
        });

        await this.client.get(`${this.getPath('entry')}?${params}`);
    }

    async testConnection(): Promise<boolean> {
        try {
            console.log('[Synology] Testing Connection...');
            await this.login();

            // Try to get info to verify API access
            const params = new URLSearchParams({
                api: 'SYNO.DownloadStation.Info',
                version: '1',
                method: 'getinfo',
                _sid: this.sid!,
            });

            const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);
            console.log('[Synology] Info response:', response);

            return response?.success === true;
        } catch (e) {
            console.error('[Synology] Connection Test Failed:', e);
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.ensureSession();

        const params = new URLSearchParams({
            api: 'SYNO.DownloadStation.Info',
            version: '1',
            method: 'getinfo',
            _sid: this.sid!,
        });

        await this.client.get(`${this.getPath('entry')}?${params}`);
        return Date.now() - start;
    }

    async getCategories(): Promise<string[]> {
        // Synology uses destination folders, not categories
        // This would require querying shared folders via SYNO.FileStation.List
        // For now, return empty array
        return [];
    }

    async setCategory(hash: string, category: string): Promise<void> {
        // Not directly supported - categories are folder-based
        console.warn('[Synology] setCategory not supported (use destination path instead)');
    }

    async getTags(): Promise<string[]> {
        // Synology doesn't support tags for Download Station tasks
        return [];
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        console.warn('[Synology] addTags not supported');
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        console.warn('[Synology] removeTags not supported');
    }

    /**
     * Ensure we have a valid session, login if needed
     */
    private async ensureSession(): Promise<void> {
        if (!this.sid) {
            await this.login();
        }
    }

    /**
     * Map Synology task to standard Torrent format
     */
    private mapTorrent(task: SynologyTask): Torrent {
        const transfer = task.additional?.transfer;
        const detail = task.additional?.detail;

        // Calculate ETA
        let eta = -1;
        if (transfer && transfer.speed_download > 0) {
            const remaining = task.size - transfer.size_downloaded;
            eta = Math.floor(remaining / transfer.speed_download);
        }

        // Calculate progress
        const progress = task.size > 0
            ? (transfer?.size_downloaded || 0) / task.size * 100
            : 0;

        return {
            id: task.id,
            name: task.title,
            status: this.mapStatus(task.status),
            progress: Math.min(progress, 100),
            size: task.size,
            downloadSpeed: transfer?.speed_download || 0,
            uploadSpeed: transfer?.speed_upload || 0,
            eta: eta,
            savePath: detail?.destination || '',
            addedDate: (detail?.create_time || 0) * 1000,
        };
    }

    /**
     * Map Synology status code to standard TorrentStatus
     */
    private mapStatus(status: number): TorrentStatus {
        switch (status) {
            case SynologyTaskStatus.DOWNLOADING:
                return 'downloading';
            case SynologyTaskStatus.SEEDING:
                return 'seeding';
            case SynologyTaskStatus.PAUSED:
                return 'paused';
            case SynologyTaskStatus.WAITING:
            case SynologyTaskStatus.FILEHOSTING_WAITING:
                return 'queued';
            case SynologyTaskStatus.FINISHING:
            case SynologyTaskStatus.FINISHED:
                return 'completed';
            case SynologyTaskStatus.HASH_CHECKING:
                return 'checking';
            case SynologyTaskStatus.EXTRACTING:
                return 'checking'; // Use checking for post-processing
            case SynologyTaskStatus.ERROR:
                return 'error';
            default:
                return 'unknown';
        }
    }

    /**
     * Get human-readable error message for task error codes
     */
    private getTaskError(code: number): string {
        const errors: Record<number, string> = {
            400: 'File upload failed',
            401: 'Max number of tasks reached',
            402: 'Destination denied',
            403: 'Destination does not exist',
            404: 'Invalid task ID',
            405: 'Invalid task action',
            406: 'No default destination',
            407: 'Set destination failed',
            408: 'File does not exist',
        };
        return errors[code] || `Task operation failed (code: ${code})`;
    }
}
