import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { UTorrentResponseSchema } from './UTorrentSchema';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';

@injectable()
export class UTorrentAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private token: string | null = null;
    private baseUrl: string;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.baseUrl = 'gui/';
    }

    async login(): Promise<void> {
        const headers = this.getAuthHeaders();
        const response = await this.httpClient.get<string>('gui/token.html', {
            headers
        });

        const parser = new DOMParser();
        const doc = parser.parseFromString(response, 'text/html');
        const tokenDiv = doc.getElementById('token');
        if (tokenDiv && tokenDiv.textContent) {
            this.token = tokenDiv.textContent;
        } else {
            throw new Error('Failed to retrieve uTorrent token');
        }
    }

    async logout(): Promise<void> {
        this.token = null;
    }

    async getTorrents(): Promise<Torrent[]> {
        const params = new URLSearchParams({ list: '1' });
        const response = await this.call(params);

        const parsed = UTorrentResponseSchema.parse(response);
        return parsed.torrents.map(this.mapToEntity);
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
        await this.call(new URLSearchParams({ action: 'stop', hash: id }));
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
        return this.getCategories();
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        if (tags.length > 0) {
            await this.setCategory(hash, tags[0]);
        }
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
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
        await this.login();
        return Date.now() - start;
    }

    private async call(params: URLSearchParams, method: 'GET' | 'POST' = 'GET', body?: BodyInit): Promise<unknown> {
        if (!this.token) await this.login();

        params.append('token', this.token || '');
        params.append('t', String(Date.now()));

        const url = `${this.baseUrl}?${params.toString()}`;
        const headers = this.getAuthHeaders();

        if (method === 'POST') {
            return this.httpClient.post(url, body, { headers });
        } else {
            return this.httpClient.get(url, { headers });
        }
    }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.username || this.config.password) {
            const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }

    private mapToEntity(r: (string | number)[]): Torrent {
        const hash = String(r[0]);
        const statusNum = Number(r[1]);
        const name = String(r[2]);
        const size = Number(r[3]);
        const percent = Number(r[4]);
        const downSpeed = Number(r[9]);
        const upSpeed = Number(r[8]);
        const eta = Number(r[10]);
        const label = String(r[11]);
        const added = 0;

        return {
            id: hash,
            name: name,
            status: UTorrentAdapter.mapStatus(statusNum),
            progress: percent / 10,
            size: size,
            downloadSpeed: downSpeed,
            uploadSpeed: upSpeed,
            eta: eta,
            savePath: '',
            addedDate: added,
            category: label,
            tags: [],
        };
    }

    private static mapStatus(status: number): TorrentStatus {
        if (status & 16) return 'error';
        if (status & 32) return 'paused';
        if (status & 2) return 'checking';
        if (status & 1) return 'downloading';
        return 'paused';
    }
}
