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

    // Session recovery tracking
    private isRecovering: boolean = false;

    // Rate limiting for login attempts (prevents IP blocking)
    private loginAttempts: number = 0;
    private lastLoginAttempt: number = 0;
    private static readonly MAX_LOGIN_ATTEMPTS = 3;
    private static readonly LOGIN_COOLDOWN_MS = 60000; // 1 minute cooldown after failures

    // Default paths (may be overridden by discovery)
    private static readonly DEFAULT_PATHS = {
        auth: '/webapi/auth.cgi',
        task: '/webapi/DownloadStation/task.cgi',
        info: '/webapi/DownloadStation/info.cgi',
        statistic: '/webapi/DownloadStation/statistic.cgi',
        entry: '/webapi/entry.cgi',
    };

    // Q3: Longer timeout for hibernating NAS wake
    private static readonly DISCOVERY_TIMEOUT_MS = 15000; // 15 seconds

    constructor(config: ServerConfig) {
        this.config = config;
        this.baseUrl = config.hostname.replace(/\/$/, '');
        this.client = new FetchHttpClient(this.baseUrl);
    }

    /**
     * Discover API paths via SYNO.API.Info
     * Q1: Includes DownloadStation2 for DSM 7+ compatibility
     * Q3: Uses 15s timeout for hibernating NAS devices
     */
    private async discoverAPIs(): Promise<void> {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => controller.abort(),
            SynologyAdapter.DISCOVERY_TIMEOUT_MS
        );

        try {
            const params = new URLSearchParams({
                api: 'SYNO.API.Info',
                version: '1',
                method: 'query',
                // Q1: Added SYNO.DownloadStation2.Task for DSM 7+
                // Q2: Added SYNO.FileStation.List for folder enumeration
                query: 'SYNO.API.Auth,SYNO.DownloadStation.Task,SYNO.DownloadStation2.Task,SYNO.DownloadStation.Info,SYNO.FileStation.List',
            });

            const response = await this.client.get<any>(`/webapi/query.cgi?${params}`, {
                signal: controller.signal
            });

            if (response?.success && response?.data) {
                const validated = SynologyAPIInfoSchema.parse(response.data);

                if (validated['SYNO.API.Auth']) {
                    this.apiPaths.auth = `/webapi/${validated['SYNO.API.Auth'].path}`;
                }
                if (validated['SYNO.DownloadStation.Task']) {
                    this.apiPaths.task = `/webapi/${validated['SYNO.DownloadStation.Task'].path}`;
                }
                // Q1: Store DownloadStation2 path for DSM 7+ task creation
                if (validated['SYNO.DownloadStation2.Task']) {
                    this.apiPaths.task2 = `/webapi/${validated['SYNO.DownloadStation2.Task'].path}`;
                    console.log('[Synology] DownloadStation2 available (DSM 7+)');
                }

                console.log('[Synology] API Discovery successful:', this.apiPaths);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.warn('[Synology] API Discovery timed out (NAS may be hibernating)');
            } else {
                console.warn('[Synology] API Discovery failed, using defaults:', error);
            }
        } finally {
            clearTimeout(timeout);
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

        // C4: Rate limiting - check if we're in cooldown after too many failures
        const now = Date.now();
        if (this.loginAttempts >= SynologyAdapter.MAX_LOGIN_ATTEMPTS) {
            const timeSinceLastAttempt = now - this.lastLoginAttempt;
            if (timeSinceLastAttempt < SynologyAdapter.LOGIN_COOLDOWN_MS) {
                const waitSeconds = Math.ceil((SynologyAdapter.LOGIN_COOLDOWN_MS - timeSinceLastAttempt) / 1000);
                throw new Error(`Too many login attempts. Wait ${waitSeconds}s to avoid IP block (407).`);
            }
            // Cooldown expired, reset counter
            this.loginAttempts = 0;
        }

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

        this.lastLoginAttempt = Date.now();
        const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

        if (!response?.success) {
            const errorCode = response?.error?.code || 0;
            this.loginAttempts++;

            // Special handling for IP block - don't count further attempts
            if (errorCode === 407 || errorCode === 408) {
                this.loginAttempts = SynologyAdapter.MAX_LOGIN_ATTEMPTS;
                throw new Error(this.getAuthError(errorCode));
            }

            throw new Error(this.getAuthError(errorCode));
        }

        // Success - reset attempt counter
        this.loginAttempts = 0;

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
     * Includes universal DSM codes (100-119) and auth-specific codes (400+)
     */
    private getAuthError(code: number): string {
        const errors: Record<number, string> = {
            // Universal error codes (all DSM APIs)
            100: 'Unknown error (retry)',
            101: 'Invalid parameter',
            102: 'API does not exist (re-run discovery)',
            103: 'Method does not exist',
            104: 'This API version is not supported',
            105: 'Insufficient privilege',
            106: 'Session timeout',
            107: 'Session interrupted by duplicate login',
            119: 'Session expired (re-login required)',
            // Auth-specific error codes
            400: 'No such account or incorrect password',
            401: 'Account disabled',
            402: 'Permission denied',
            403: '2-factor authentication code required',
            404: '2-factor authentication failed',
            406: 'Enforce 2FA required',
            407: 'Blocked IP source - too many failed attempts',
            408: 'Account is blocked due to too many failed attempts',
            409: 'Network failure',
            410: 'SID not found (session expired)',
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

        return this.withSessionRecovery(async () => {
            const params = new URLSearchParams({
                api: 'SYNO.DownloadStation.Task',
                version: '1',
                method: 'list',
                additional: 'detail,transfer,file',
                _sid: this.sid!,
            });

            const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

            if (!response?.success) {
                const code = response?.error?.code || 0;
                throw new Error(this.getTaskError(code));
            }

            const data = SynologyTaskListSchema.parse(response.data);
            return data.tasks.map(t => this.mapTorrent(t));
        });
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.ensureSession();

        return this.withSessionRecovery(async () => {
            // Use DownloadStation2.Task v2 for proper destination support (DSM 7+)
            const form = new FormData();
            form.append('api', 'SYNO.DownloadStation2.Task');
            form.append('version', '2');
            form.append('method', 'create');
            form.append('type', 'url');
            // URL-encode to fix DSM 7 Error 117 with special characters
            form.append('url', encodeURIComponent(url));
            form.append('_sid', this.sid!);

            // CSRF protection (mandatory for DSM 7 write operations)
            if (this.synotoken) {
                form.append('SynoToken', this.synotoken);
            }

            if (options?.path) {
                form.append('destination', options.path);
            }

            const response = await this.client.post<any>(this.getPath('entry'), form);

            if (!response?.success) {
                const code = response?.error?.code || 0;
                throw new Error(this.getTaskError(code));
            }
        });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        await this.ensureSession();

        return this.withSessionRecovery(async () => {
            // Use DownloadStation2.Task v2 for proper destination support (DSM 7+)
            const form = new FormData();
            form.append('api', 'SYNO.DownloadStation2.Task');
            form.append('version', '2');
            form.append('method', 'create');
            form.append('type', 'file');
            form.append('_sid', this.sid!);
            form.append('file', file, 'torrent.torrent');

            // CSRF protection (mandatory for DSM 7 write operations)
            if (this.synotoken) {
                form.append('SynoToken', this.synotoken);
            }

            if (options?.path) {
                form.append('destination', options.path);
            }

            const response = await this.client.post<any>(this.getPath('entry'), form);

            if (!response?.success) {
                const code = response?.error?.code || 0;
                throw new Error(this.getTaskError(code));
            }
        });
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

        // CSRF protection for DSM 7
        if (this.synotoken) {
            params.append('SynoToken', this.synotoken);
        }

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

        // CSRF protection for DSM 7
        if (this.synotoken) {
            params.append('SynoToken', this.synotoken);
        }

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

        // CSRF protection for DSM 7
        if (this.synotoken) {
            params.append('SynoToken', this.synotoken);
        }

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

            // Q4: Detect certificate/network errors and provide actionable guidance
            if (this.isCertificateOrNetworkError(e)) {
                throw new Error(
                    'Connection failed. If using HTTPS with a self-signed certificate, ' +
                    'open your NAS web UI in a new browser tab and accept the certificate first, ' +
                    'then try connecting again.'
                );
            }

            // Re-throw other errors with context
            if (e instanceof Error) {
                throw e;
            }
            throw new Error('Connection failed - check hostname and credentials');
        }
    }

    /**
     * Q4: Detect SSL certificate or network connectivity errors
     * These require user action (accept cert in browser) rather than config changes
     */
    private isCertificateOrNetworkError(error: unknown): boolean {
        if (error instanceof Error) {
            const msg = error.message.toLowerCase();
            return msg.includes('failed to fetch') ||
                msg.includes('networkerror') ||
                msg.includes('network error') ||
                msg.includes('ssl') ||
                msg.includes('certificate') ||
                msg.includes('cert_') ||
                msg.includes('unable to connect');
        }
        return false;
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

    /**
     * Q2: Get available destination folders via FileStation API
     * Returns writable shared folders as "categories" for destination selection
     */
    async getCategories(): Promise<string[]> {
        await this.ensureSession();

        return this.withSessionRecovery(async () => {
            const params = new URLSearchParams({
                api: 'SYNO.FileStation.List',
                version: '2',
                method: 'list_share',
                onlywritable: 'true',
                _sid: this.sid!,
            });

            // CSRF protection
            if (this.synotoken) {
                params.append('SynoToken', this.synotoken);
            }

            try {
                const response = await this.client.get<any>(`${this.getPath('entry')}?${params}`);

                if (!response?.success || !response?.data?.shares) {
                    console.warn('[Synology] Failed to get shared folders');
                    return [];
                }

                // Return folder paths as category names
                return response.data.shares.map((share: { path: string; name: string }) => share.path);
            } catch (error) {
                console.warn('[Synology] FileStation query failed:', error);
                return [];
            }
        });
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
     * C3: Session recovery wrapper
     * Detects session expiry (119/410) and automatically re-authenticates
     */
    private async withSessionRecovery<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            // Check if this is a session expiry error
            if (this.isSessionExpiredError(error)) {
                // Prevent infinite recovery loops
                if (this.isRecovering) {
                    throw new Error('Session recovery failed - please try again');
                }

                console.log('[Synology] Session expired, attempting recovery...');
                this.isRecovering = true;

                try {
                    // Invalidate current session
                    this.sid = null;
                    this.synotoken = null;

                    // Re-authenticate
                    await this.login();

                    console.log('[Synology] Session recovered, retrying operation');

                    // Retry the original operation
                    return await operation();
                } finally {
                    this.isRecovering = false;
                }
            }

            throw error;
        }
    }

    /**
     * Check if an error indicates session expiry (codes 119 or 410)
     */
    private isSessionExpiredError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message;
            // Check for our error messages that indicate session expiry
            if (message.includes('119') || message.includes('410') ||
                message.includes('Session expired') || message.includes('SID not found')) {
                return true;
            }
        }
        return false;
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
     * Includes DownloadStation-specific and universal session codes
     */
    private getTaskError(code: number): string {
        const errors: Record<number, string> = {
            // Universal session codes (may occur on any operation)
            105: 'Insufficient privilege for this operation',
            119: 'Session expired - please reconnect',
            // DownloadStation task codes
            400: 'File upload failed - check file format',
            401: 'Max number of concurrent tasks reached',
            402: 'Destination folder not found - create it first',
            403: 'Destination access denied - check permissions',
            404: 'Invalid task ID',
            405: 'Invalid task action',
            406: 'No default destination configured',
            407: 'Failed to set destination',
            408: 'File does not exist',
        };
        return errors[code] || `Task operation failed (code: ${code})`;
    }
}
