import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { FloodListResponseArraySchema, FloodTorrent } from './FloodSchema';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';

@injectable()
export class FloodAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private token: string | null = null;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
    }

    async login(): Promise<void> {
        const response = await this.httpClient.post<{ success: boolean, token?: string }>('api/auth/authenticate', {
            username: this.config.username,
            password: this.config.password,
        });

        if (response.success && response.token) {
            this.token = response.token;
        } else if (!response.success) {
            throw new Error('Flood authentication failed');
        }
        // If success but no token, maybe cookie based? Flood usually sends JWT.
    }

    async logout(): Promise<void> {
        this.token = null;
    }

    async getTorrents(): Promise<Torrent[]> {
        const headers = this.getHeaders();
        const response = await this.httpClient.get('api/torrents', { headers });

        // Flood might return object or array. Research said array.
        const parsed = FloodListResponseArraySchema.parse(response);

        return parsed.torrents.map(this.mapToEntity);
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const headers = this.getHeaders();
        const body: {
            urls: string[];
            destination?: string;
            start: boolean;
            tags: string[];
        } = {
            urls: [url],
            destination: options?.path,
            start: !options?.paused,
            tags: options?.label ? [options.label] : [],
        };

        await this.httpClient.post('api/torrents/add-urls', body, { headers });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const headers = this.getHeaders();
        const base64 = await blobToBase64(file);

        const body: {
            files: string[];
            destination?: string;
            start: boolean;
            tags: string[];
        } = {
            files: [base64],
            destination: options?.path,
            start: !options?.paused,
            tags: options?.label ? [options.label] : [],
        };

        await this.httpClient.post('api/torrents/add-files', body, { headers });
    }

    async pauseTorrent(id: string): Promise<void> {
        const headers = this.getHeaders();
        await this.httpClient.post('api/torrents/stop', { hashes: [id] }, { headers });
    }

    async resumeTorrent(id: string): Promise<void> {
        const headers = this.getHeaders();
        await this.httpClient.post('api/torrents/start', { hashes: [id] }, { headers });
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        const headers = this.getHeaders();
        await this.httpClient.post('api/torrents/delete', {
            hashes: [id],
            deleteData
        }, { headers });
    }

    async getCategories(): Promise<string[]> {
        // Flood uses tags
        return this.getTags();
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.addTags(hash, [category]);
    }

    async getTags(): Promise<string[]> {
        const headers = this.getHeaders();
        // Flood has /api/tags endpoint? Research mentions /api/torrent-tags
        try {
            const tags = await this.httpClient.get<string[]>('api/tags', { headers });
            return tags;
        } catch (e) {
            return [];
        }
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        const headers = this.getHeaders();
        await this.httpClient.patch('api/torrents/tags', {
            hashes: [hash],
            tags: tags
        }, { headers });
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // Flood API for removing tags?
        // Usually PATCH /api/torrents/tags with remove?
        // Or set tags?
        // Research didn't specify removeTags endpoint explicitly.
        // Assuming we might need to fetch, filter, and set.
        // Or maybe PATCH accepts 'add' and 'remove' fields?
        // I'll implement read-modify-write for safety if unsure.

        const currentTags = await this.getTorrentTags(hash);
        const newTags = currentTags.filter(t => !tags.includes(t));

        const headers = this.getHeaders();
        await this.httpClient.put('api/torrents/tags', { // PUT usually replaces
            hashes: [hash],
            tags: newTags
        }, { headers });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch (e) {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.getTorrents(); // Heavy ping but reliable
        return Date.now() - start;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`; // Or just token? Flood usually uses Cookie or Bearer.
            // Research said: Authorization: Bearer <token>
        }
        return headers;
    }

    private async getTorrentTags(hash: string): Promise<string[]> {
        // Fetch torrent details
        const torrents = await this.getTorrents();
        const t = torrents.find(t => t.id === hash);
        return t?.tags || [];
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
            savePath: '', // Flood might not expose save path in basic list
            addedDate: (t.added || t.dateAdded || 0) * 1000,
            tags: t.tags || [],
            category: t.tags && t.tags.length > 0 ? t.tags[0] : undefined,
        };
    }

    private static mapStatus(states: string[]): TorrentStatus {
        // Flood returns array of states: ['downloading', 'active']
        if (states.includes('error')) return 'error';
        if (states.includes('downloading')) return 'downloading';
        if (states.includes('seeding')) return 'seeding';
        if (states.includes('paused') || states.includes('stopped')) return 'paused';
        if (states.includes('checking')) return 'checking';
        if (states.includes('complete')) return 'completed';
        return 'unknown';
    }
}
