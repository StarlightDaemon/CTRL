import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';
import { QBittorrentListSchema, QBittorrentTorrent } from './QBittorrentSchema';
import { ServerConfig } from '@/shared/lib/types';

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
 * Implements full session management with:
 * - Automatic re-authentication on session expiry
 * - Exponential backoff for failed logins
 * - IP ban detection to prevent lockout
 * - CSRF header injection for browser extension compatibility
 * - Request timeout handling
 */
@injectable()
export class QBittorrentAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;

    // Session management state
    private isAuthenticated = false;
    private loginAttempts = 0;
    private lastLoginAttempt = 0;
    private apiVersion: string | null = null;

    // Configuration
    private readonly MAX_LOGIN_ATTEMPTS = 3;
    private readonly LOGIN_BACKOFF_BASE_MS = 2000;
    private readonly REQUEST_TIMEOUT_MS = 30000;

    constructor(config: ServerConfig) {
        this.config = config;
        // Ensure trailing slash for URL constructor to work as "directory"
        this.baseUrl = `${config.hostname.replace(/\/$/, '')}/api/v2/`;
        this.client = new FetchHttpClient(this.baseUrl);
    }

    /**
     * Authenticates with qBittorrent using cookie-based sessions.
     * Implements exponential backoff and IP ban detection.
     */
    async login(): Promise<void> {
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

        console.log(`[QBit] Logging in to ${this.baseUrl} as ${this.config.username}`);
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

            console.log(`[QBit] Login Response: ${responseText}`);

            // Check for explicit failure responses
            if (typeof responseText === 'string') {
                if (responseText.includes(QB_ERROR_MESSAGES.IP_BANNED)) {
                    throw new Error('IP has been banned by qBittorrent. Server must be restarted or wait for ban expiration.');
                }
                if (responseText.includes(QB_ERROR_MESSAGES.AUTH_FAILED)) {
                    this.loginAttempts++;
                    const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - this.loginAttempts;
                    throw new Error(
                        `Authentication Failed (Invalid Credentials). ` +
                        `${remainingAttempts} attempts remaining before lockout protection.`
                    );
                }
            }

            // Success
            this.isAuthenticated = true;
            this.loginAttempts = 0;
            console.log('[QBit] Login successful');

        } catch (error) {
            if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
                // 401 or 403 can mean either wrong password or IP ban - check response body
                const body = await error.response?.text?.() || '';
                if (body.includes(QB_ERROR_MESSAGES.IP_BANNED)) {
                    throw new Error('IP has been banned by qBittorrent.');
                }
                this.loginAttempts++;
                const remainingAttempts = this.MAX_LOGIN_ATTEMPTS - this.loginAttempts;
                const statusText = error.status === 401 ? '401 Unauthorized' : '403 Forbidden';
                throw new Error(
                    `Authentication Failed (${statusText}). ` +
                    `${remainingAttempts} attempts remaining before lockout protection.`
                );
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
        this.apiVersion = await this.makeAuthenticatedRequest<string>('app/webapiVersion');
        console.log(`[QBit] API Version: ${this.apiVersion}`);
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

        if (options?.paused) form.append('paused', 'true');
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

        if (options?.paused) form.append('paused', 'true');
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
        await this.makeAuthenticatedRequest('torrents/pause', {
            method: 'POST',
            body: new URLSearchParams({ hashes: id }),
        });
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.makeAuthenticatedRequest('torrents/resume', {
            method: 'POST',
            body: new URLSearchParams({ hashes: id }),
        });
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

    async testConnection(): Promise<boolean> {
        console.log('[QBit] Testing Connection...');
        await this.login();
        console.log('[QBit] Login passed, checking version...');
        const v = await this.getAppVersion();
        console.log(`[QBit] Version response: ${v}`);
        return true;
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.makeAuthenticatedRequest('app/version');
        return Date.now() - start;
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
     * Makes a request with CSRF headers injected for browser extension compatibility.
     * qBittorrent validates Origin/Referer headers to prevent CSRF attacks.
     */
    private async makeRequest<T>(
        endpoint: string,
        init: RequestInit = {}
    ): Promise<T> {
        const url = new URL(endpoint, this.baseUrl);

        // Inject CSRF bypass headers - critical for browser extensions
        const headers = new Headers(init.headers);
        const origin = new URL(this.baseUrl).origin;
        headers.set('Origin', origin);
        headers.set('Referer', origin + '/');

        // Setup timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url.toString(), {
                ...init,
                headers,
                credentials: 'include',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new HttpError(response.status, response.statusText, response);
            }

            const text = await response.text();
            if (!text) return {} as T;

            try {
                return JSON.parse(text);
            } catch {
                return text as unknown as T;
            }
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.REQUEST_TIMEOUT_MS}ms`);
            }
            throw error;
        }
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
                console.log('[QBit] Session expired, re-authenticating...');
                this.isAuthenticated = false;
                await this.login();
                return await this.makeRequest<T>(endpoint, init);
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
                if (state.includes('paused')) return 'paused';
                return 'unknown';
        }
    }
}
