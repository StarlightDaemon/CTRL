import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';
import { QBittorrentListSchema, QBittorrentTorrent } from './QBittorrentSchema';
import { ServerConfig } from '@/shared/lib/types';
import { QBittorrentAdapterError } from './QBittorrentAdapterError';
import { AdapterConnectionResult } from '@/shared/api/clients/shared/AdapterConnectionResult';
import { withAdapterRetry, RetryConfig, DEFAULT_RETRY_CONFIG } from '@/shared/lib/retry/withAdapterRetry';
import { resolveClientEndpoint } from '@/shared/lib/endpoint';

/** Web API version from which torrents/pause|resume were renamed to stop|start. */
const STOP_START_MIN_API = [2, 11, 0] as const;

function compareApiVersion(version: string, min: readonly [number, number, number]): number {
    const parts = version.split('.').map((p) => parseInt(p, 10) || 0);
    for (let i = 0; i < 3; i++) {
        const a = parts[i] ?? 0;
        const b = min[i];
        if (a !== b) return a - b;
    }
    return 0;
}

/**
 * Error messages from qBittorrent that require special handling
 */
const QB_ERROR_MESSAGES = {
    IP_BANNED: 'Your IP address has been banned',
    AUTH_FAILED: 'Fails.',
    UNAUTHORIZED: 'Unauthorized',
} as const;

/**
 * qBittorrent Web API v2 Adapter
 * 
 * Session handling: qBittorrent issues an HttpOnly SID cookie on login. The
 * browser owns that cookie, so requests run with `credentials: 'include'`
 * and the adapter never reads or writes it. CSRF protection on the server
 * compares the browser-controlled Origin/Referer with the request host; an
 * extension cannot influence those headers, so the documented server-side
 * setting is the supported path (see docs/CLIENTS.md).
 *
 * Versioning: qBittorrent 5.0 (Web API 2.11) renamed pause/resume to
 * stop/start and introduced the stoppedDL/stoppedUP states. The adapter
 * reads the Web API version after login and picks the matching endpoints.
 */
export class QBittorrentAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;

    // Session management state
    private isAuthenticated = false;
    private loginAttempts = 0;
    private lastLoginAttempt = 0;
    /**
     * Set once qBittorrent has rejected the configured credentials. qBittorrent
     * bans the client's IP after a handful of failed logins (5 by default, for
     * an hour), and the background polls every few seconds, so a wrong password
     * must fail exactly once per configuration. The controller creates a new
     * adapter instance when the server settings change, which clears this.
     */
    private credentialsRejected: Error | null = null;
    private apiVersion: string | null = null;

    // Configuration
    private readonly MAX_LOGIN_ATTEMPTS = 3;
    private readonly LOGIN_BACKOFF_BASE_MS = 2000;
    private readonly REQUEST_TIMEOUT_MS = 30000;

    private retryConfig: RetryConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        this.baseUrl = resolveClientEndpoint('qbittorrent', config.hostname);
        this.client = new FetchHttpClient(this.baseUrl, {
            credentials: 'include',
            timeoutMs: this.REQUEST_TIMEOUT_MS,
        });
        // Allow per-server retry overrides (defaults to the shared DEFAULT_RETRY_CONFIG)
        this.retryConfig = {
            ...DEFAULT_RETRY_CONFIG,
            ...(config.clientOptions?.retryConfig as Partial<RetryConfig> || {}),
        };
    }

    /**
     * Authenticates with qBittorrent using cookie-based sessions.
     * Implements exponential backoff and IP ban detection.
     */
    async login(): Promise<void> {
        if (this.credentialsRejected) throw this.credentialsRejected;

        // Check if we've hit the login attempt limit (prevents IP ban)
        if (this.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
            const timeSinceLastAttempt = Date.now() - this.lastLoginAttempt;
            const cooldownMs = this.LOGIN_BACKOFF_BASE_MS * Math.pow(2, this.MAX_LOGIN_ATTEMPTS);

            if (timeSinceLastAttempt < cooldownMs) {
                throw new Error(
                    `Login attempts exhausted. Wait ${Math.ceil((cooldownMs - timeSinceLastAttempt) / 1000)}s ` +
                    `before retrying to avoid IP ban.`
                );
            }
            // Reset after cooldown period
            this.loginAttempts = 0;
        }

        this.lastLoginAttempt = Date.now();

        // qBittorrent requires form-urlencoded, NOT JSON
        const body = new URLSearchParams({
            username: this.config.username || '',
            password: this.config.password || '',
        });

        try {
            const responseText = await this.makeRequest<string>('auth/login', {
                method: 'POST',
                body,
            });

            // Check for explicit failure responses
            if (typeof responseText === 'string') {
                if (responseText.includes(QB_ERROR_MESSAGES.IP_BANNED)) {
                    throw new Error('IP has been banned by qBittorrent. Server must be restarted or wait for ban expiration.');
                }
                if (responseText.includes(QB_ERROR_MESSAGES.AUTH_FAILED)) {
                    this.loginAttempts++;
                    this.credentialsRejected = new Error(
                        'Authentication Failed (Invalid Credentials). ' +
                        'CTRL will not retry with these settings, so qBittorrent does not ban this browser.'
                    );
                    throw this.credentialsRejected;
                }
            }

            // Success
            this.isAuthenticated = true;
            this.loginAttempts = 0;

        } catch (error) {
            if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
                // 401 or 403 can mean either wrong password or IP ban - check response body
                const body = error.bodyText || '';
                if (body.includes(QB_ERROR_MESSAGES.IP_BANNED)) {
                    throw new Error('IP has been banned by qBittorrent.');
                }
                this.loginAttempts++;
                const statusText = error.status === 401 ? '401 Unauthorized' : '403 Forbidden';
                this.credentialsRejected = new Error(
                    `Authentication Failed (${statusText}). ` +
                    'CTRL will not retry with these settings, so qBittorrent does not ban this browser.'
                );
                throw this.credentialsRejected;
            }
            throw error;
        }
    }

    async logout(): Promise<void> {
        try {
            await this.makeRequest('auth/logout', { method: 'POST' });
        } finally {
            this.isAuthenticated = false;
        }
    }

    /**
     * Gets the qBittorrent API version for feature detection.
     * Returns version string like "2.8.3"
     */
    async getApiVersion(): Promise<string> {
        if (this.apiVersion) {
            return this.apiVersion;
        }
        const version = await this.makeAuthenticatedRequest<string>('app/webapiVersion');
        this.apiVersion = typeof version === 'string' ? version.trim() : String(version);
        return this.apiVersion;
    }

    /**
     * Gets the qBittorrent application version.
     * Returns version string like "v4.6.0"
     */
    async getAppVersion(): Promise<string> {
        return await this.makeAuthenticatedRequest<string>('app/version');
    }

    async getTorrents(): Promise<Torrent[]> {
        const data = await this.makeAuthenticatedRequest('torrents/info');
        const validated = QBittorrentListSchema.parse(data);
        return validated.map(t => this.mapTorrent(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const form = new FormData();
        form.append('urls', url);

        if (options?.paused) {
            form.append('paused', 'true');   // Web API < 2.11 (qBittorrent 4.x)
            form.append('stopped', 'true');  // Web API 2.11+ (qBittorrent 5.x ignores `paused`; live-verified on 5.2.3)
        }
        if (options?.label) form.append('category', options.label);
        if (options?.path) form.append('savepath', options.path);

        // Phase 1: Support sequential download options from interface
        if (options?.sequentialDownload) form.append('sequentialDownload', 'true');
        if (options?.firstLastPiecePrio) form.append('firstLastPiecePrio', 'true');

        await this.makeAuthenticatedRequest('torrents/add', {
            method: 'POST',
            body: form,
        });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const form = new FormData();
        form.append('torrents', file);

        if (options?.paused) {
            form.append('paused', 'true');
            form.append('stopped', 'true');
        }
        if (options?.label) form.append('category', options.label);
        if (options?.path) form.append('savepath', options.path);

        // Phase 1: Support sequential download options from interface
        if (options?.sequentialDownload) form.append('sequentialDownload', 'true');
        if (options?.firstLastPiecePrio) form.append('firstLastPiecePrio', 'true');

        await this.makeAuthenticatedRequest('torrents/add', {
            method: 'POST',
            body: form,
        });
    }

    async pauseTorrent(id: string): Promise<void> {
        const endpoint = (await this.supportsStopStart()) ? 'torrents/stop' : 'torrents/pause';
        await this.makeAuthenticatedRequest(endpoint, {
            method: 'POST',
            body: new URLSearchParams({ hashes: id }),
        });
    }

    async resumeTorrent(id: string): Promise<void> {
        const endpoint = (await this.supportsStopStart()) ? 'torrents/start' : 'torrents/resume';
        await this.makeAuthenticatedRequest(endpoint, {
            method: 'POST',
            body: new URLSearchParams({ hashes: id }),
        });
    }

    /** True for Web API >= 2.11 (qBittorrent 5.0+), where pause/resume became stop/start. */
    private async supportsStopStart(): Promise<boolean> {
        const version = await this.getApiVersion();
        return compareApiVersion(version, STOP_START_MIN_API) >= 0;
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/delete', {
            method: 'POST',
            body: new URLSearchParams({
                hashes: id,
                deleteFiles: deleteData ? 'true' : 'false'
            }),
        });
    }

    async testConnection(): Promise<AdapterConnectionResult> {
        try {
            // The browser may already hold a valid session cookie for this origin, and
            // qBittorrent answers auth/login with "Ok." for an authenticated session
            // without looking at the credentials (live-verified on 5.2.3). End that
            // session first so the test really validates what the user typed.
            await this.logout().catch(() => { /* no session to end */ });
            this.credentialsRejected = null;
            // login() is intentionally NOT wrapped in retry: qBittorrent bans the IP
            // after repeated failed logins, and login() already enforces a backoff
            // cooldown. Only the (idempotent) version probe is retried.
            await this.login();
            await withAdapterRetry(() => this.getApiVersion(), this.retryConfig);
            return { connected: true };
        } catch (error) {
            return { connected: false, error: QBittorrentAdapterError.from(error) };
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.makeAuthenticatedRequest('app/version');
        return Date.now() - start;
    }

    classifyError(error: unknown): QBittorrentAdapterError {
        return QBittorrentAdapterError.from(error);
    }

    async getCategories(): Promise<string[]> {
        const data = await this.makeAuthenticatedRequest<object>('torrents/categories');
        return Object.keys(data);
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/setCategory', {
            method: 'POST',
            body: new URLSearchParams({ hashes: hash, category }),
        });
    }

    async getTags(): Promise<string[]> {
        const data = await this.makeAuthenticatedRequest<string[]>('torrents/tags');
        return data;
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/addTags', {
            method: 'POST',
            body: new URLSearchParams({ hashes: hash, tags: tags.join(',') }),
        });
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/removeTags', {
            method: 'POST',
            body: new URLSearchParams({ hashes: hash, tags: tags.join(',') }),
        });
    }

    // ============================================
    // Sequential Download Control (Phase 1)
    // ============================================

    /**
     * Toggles sequential download mode for the specified torrents.
     * Note: This is a toggle, not a set operation.
     */
    async toggleSequentialDownload(hashes: string[]): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/toggleSequentialDownload', {
            method: 'POST',
            body: new URLSearchParams({ hashes: hashes.join('|') }),
        });
    }

    /**
     * Toggles first/last piece priority for the specified torrents.
     * Note: This is a toggle, not a set operation.
     */
    async toggleFirstLastPiecePrio(hashes: string[]): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/toggleFirstLastPiecePrio', {
            method: 'POST',
            body: new URLSearchParams({ hashes: hashes.join('|') }),
        });
    }

    // ============================================
    // Private Request Helpers
    // ============================================

    /**
     * Sends a request through the shared transport. Cookies are managed by the
     * browser (`credentials: 'include'`); read-only GETs are marked idempotent.
     */
    private async makeRequest<T>(
        endpoint: string,
        init: RequestInit = {}
    ): Promise<T> {
        const method = (init.method ?? 'GET').toUpperCase();
        return this.client.request<T>(endpoint, {
            method,
            headers: init.headers,
            body: (init.body ?? undefined) as BodyInit | undefined,
            idempotent: method === 'GET',
        });
    }

    /**
     * Makes an authenticated request, automatically re-authenticating if session expired.
     */
    private async makeAuthenticatedRequest<T>(
        endpoint: string,
        init: RequestInit = {}
    ): Promise<T> {
        // Ensure we're logged in
        if (!this.isAuthenticated) {
            await this.login();
        }

        try {
            return await this.makeRequest<T>(endpoint, init);
        } catch (error) {
            // Handle session expiry - re-authenticate and retry once
            if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
                this.isAuthenticated = false;
                await this.login();
                return await this.makeRequest<T>(endpoint, init);
            }
            if (error instanceof HttpError) {
                if (error.status === 409) throw new Error('All torrents failed to add');
                if (error.status === 415) throw new Error('Invalid torrent file');
                if (error.status === 405) throw new Error('Method not allowed — update adapter');
            }
            throw error;
        }
    }

    // ============================================
    // Mapping Helpers
    // ============================================

    private mapTorrent(q: QBittorrentTorrent): Torrent {
        return {
            id: q.hash,
            name: q.name,
            status: this.mapStatus(q.state),
            progress: q.progress * 100,
            size: q.size,
            downloadSpeed: q.dlspeed,
            uploadSpeed: q.upspeed,
            eta: q.eta,
            savePath: q.save_path,
            addedDate: q.added_on * 1000,
            category: q.category,
            tags: q.tags ? q.tags.split(',').map(s => s.trim()).filter(Boolean) : [],
            // Extended fields from expanded schema
            ratio: q.ratio,
            seeds: q.num_seeds,
            peers: q.num_leechs,
            sequentialDownload: q.seq_dl,
            firstLastPiecePrio: q.f_l_piece_prio,
            error: q.error,
        };
    }

    private mapStatus(state: string): TorrentStatus {
        switch (state) {
            case 'metaDL':
            case 'allocating':
            case 'downloading':
            case 'forcedDL':
                return 'downloading';
            case 'stalledDL':
                return 'stalled'; // More specific than 'downloading'
            case 'uploading':
            case 'forcedUP':
            case 'stalledUP':
                return 'seeding';
            case 'pausedDL':
            case 'pausedUP':
            case 'stoppedDL': // qBittorrent 5.x
            case 'stoppedUP':
                return 'paused';
            case 'queuedDL':
            case 'queuedUP':
                return 'queued';
            case 'checkingDL':
            case 'checkingUP':
            case 'checkingResumeData':
                return 'checking';
            case 'error':
            case 'missingFiles':
            case 'unknown':
                return 'error';
            default:
                if (state.includes('paused') || state.includes('stopped')) return 'paused';
                return 'unknown';
        }
    }
}
