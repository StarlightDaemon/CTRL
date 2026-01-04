import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { QBittorrentListSchema, QBittorrentTorrent } from './QBittorrentSchema';
import { ServerConfig } from '@/shared/lib/types';

@injectable()
export class QBittorrentAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;

    constructor(config: ServerConfig) {
        this.config = config;
        // Ensure trailing slash for URL constructor to work as "directory"
        this.baseUrl = `${config.hostname.replace(/\/$/, '')}/api/v2/`;
        this.client = new FetchHttpClient(this.baseUrl);
    }

    async login(): Promise<void> {
        console.log(`[QBit] Logging in to ${this.baseUrl} as ${this.config.username}`);

        // qBittorrent requires Origin/Referer for CSRF protection
        // However, browsers might block setting Origin. Let's try standard request first.
        // URLSearchParams automatically sets Content-Type.
        const body = new URLSearchParams({
            username: this.config.username || '',
            password: this.config.password || '',
        });

        const responseText = await this.client.post<string>('auth/login', body);

        console.log(`[QBit] Login Response: ${responseText}`);

        if (typeof responseText === 'string' && responseText.includes('Fails.')) {
            throw new Error('Authentication Failed (Invalid Credentials)');
        }
    }

    async logout(): Promise<void> {
        await this.client.post('auth/logout');
    }

    async getTorrents(): Promise<Torrent[]> {
        const data = await this.client.get('torrents/info');
        const validated = QBittorrentListSchema.parse(data);

        return validated.map(t => this.mapTorrent(t));
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const form = new FormData();
        form.append('urls', url);
        if (options?.paused) form.append('paused', 'true');
        if (options?.label) form.append('category', options.label);
        if (options?.path) form.append('savepath', options.path);

        await this.client.post('torrents/add', form);
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const form = new FormData();
        form.append('torrents', file);
        if (options?.paused) form.append('paused', 'true');
        if (options?.label) form.append('category', options.label);
        if (options?.path) form.append('savepath', options.path);

        await this.client.post('torrents/add', form);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.client.post('torrents/pause', new URLSearchParams({ hashes: id }));
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.client.post('torrents/resume', new URLSearchParams({ hashes: id }));
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        await this.client.post('torrents/delete', new URLSearchParams({
            hashes: id,
            deleteFiles: deleteData ? 'true' : 'false'
        }));
    }

    async testConnection(): Promise<boolean> {
        try {
            console.log('[QBit] Testing Connection...');
            await this.login();
            console.log('[QBit] Login passed, checking version...');
            const v = await this.client.get('app/version');
            console.log(`[QBit] Version response: ${v}`);
            return true;
        } catch (e) {
            console.error('[QBit] Connection Test Failed:', e);
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.client.get('app/version');
        return Date.now() - start;
    }

    async getCategories(): Promise<string[]> {
        const data = await this.client.get<object>('torrents/categories');
        return Object.keys(data);
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.client.post('torrents/setCategory', new URLSearchParams({ hashes: hash, category }));
    }

    async getTags(): Promise<string[]> {
        const data = await this.client.get<string[]>('torrents/tags');
        return data;
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        await this.client.post('torrents/addTags', new URLSearchParams({ hashes: hash, tags: tags.join(',') }));
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        await this.client.post('torrents/removeTags', new URLSearchParams({ hashes: hash, tags: tags.join(',') }));
    }

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
            tags: q.tags ? q.tags.split(',').map(s => s.trim()).filter(Boolean) : []
        };
    }

    private mapStatus(state: string): TorrentStatus {
        switch (state) {
            case 'metaDL':
            case 'allocating':
            case 'downloading':
            case 'forcedDL':
                return 'downloading';
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
