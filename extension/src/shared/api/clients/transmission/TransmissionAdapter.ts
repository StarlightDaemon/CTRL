import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { HttpError } from '@/shared/api/network/HttpError';
import { TransmissionResponseSchema, TransmissionTorrent } from './TransmissionSchema';
import { ServerConfig } from '@/shared/lib/types';
import { blobToBase64 } from '@/shared/lib/helpers';

@injectable()
export class TransmissionAdapter implements ITorrentClient {
    private httpClient: FetchHttpClient;
    private sessionId: string | null = null;
    private rpcUrl: string;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.rpcUrl = 'transmission/rpc';
    }

    async login(): Promise<void> {
        // Transmission uses Basic Auth (handled by browser or headers) + Session ID header.
        // We trigger a request to get the session ID.
        try {
            await this.call('session-get');
        } catch (e) {
            // Expected to fail if session ID is missing, but call() handles the retry logic.
            // If it still fails, it's a real error.
        }
    }

    async logout(): Promise<void> {
        this.sessionId = null;
    }

    async getTorrents(): Promise<Torrent[]> {
        const response = await this.call('torrent-get', {
            fields: [
                'id', 'name', 'status', 'totalSize', 'percentDone',
                'rateDownload', 'rateUpload', 'eta', 'downloadDir',
                'addedDate', 'error', 'errorString'
            ]
        });

        const parsed = TransmissionResponseSchema.parse(response);
        if (!parsed.arguments?.torrents) return [];

        return parsed.arguments.torrents.map(this.mapToEntity);
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const args: Record<string, unknown> = { filename: url };
        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        await this.call('torrent-add', args);
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        const args: Record<string, unknown> = { metainfo: base64 };
        if (options?.path) args['download-dir'] = options.path;
        if (options?.paused) args['paused'] = true;

        await this.call('torrent-add', args);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call('torrent-stop', { ids: [parseInt(id)] });
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call('torrent-start', { ids: [parseInt(id)] });
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        await this.call('torrent-remove', {
            ids: [parseInt(id)],
            'delete-local-data': deleteData
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.call('session-get');
            return true;
        } catch (e) {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        try {
            await this.call('session-get');
            return Date.now() - start;
        } catch (e) {
            throw e;
        }
    }

    private async call(method: string, args: Record<string, unknown> = {}): Promise<unknown> {
        const makeRequest = async () => {
            const headers: Record<string, string> = {};
            if (this.sessionId) {
                headers['X-Transmission-Session-Id'] = this.sessionId;
            }
            if (this.config.username || this.config.password) {
                const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
                headers['Authorization'] = `Basic ${auth}`;
            }

            return this.httpClient.post(this.rpcUrl, {
                method,
                arguments: args,
            }, { headers });
        };

        try {
            return await makeRequest();
        } catch (e) {
            if (e instanceof HttpError && e.status === 409) {
                const newSessionId = e.response.headers.get('X-Transmission-Session-Id');
                if (newSessionId) {
                    this.sessionId = newSessionId;
                    return await makeRequest();
                }
            }
            throw e;
        }
    }

    private mapToEntity(t: TransmissionTorrent): Torrent {
        return {
            id: t.id.toString(),
            name: t.name,
            status: TransmissionAdapter.mapStatus(t.status),
            progress: t.percentDone * 100,
            size: t.totalSize,
            downloadSpeed: t.rateDownload,
            uploadSpeed: t.rateUpload,
            eta: t.eta,
            savePath: t.downloadDir,
            addedDate: t.addedDate * 1000,
            tags: t.labels || [],
            category: t.labels && t.labels.length > 0 ? t.labels[0] : undefined,
        };
    }

    private static mapStatus(status: number): TorrentStatus {
        // 0: STOPPED, 1: CHECK_WAIT, 2: CHECK, 3: DOWNLOAD_WAIT, 4: DOWNLOAD, 5: SEED_WAIT, 6: SEED
        switch (status) {
            case 0: return 'paused';
            case 1: return 'queued'; // Queued for check
            case 2: return 'checking';
            case 3: return 'queued'; // Queued for download
            case 4: return 'downloading';
            case 5: return 'queued'; // Queued for seed
            case 6: return 'seeding';
            default: return 'unknown';
        }
    }
    async getCategories(): Promise<string[]> {
        // Transmission uses labels as categories/tags.
        // We fetch all torrents to get unique labels.
        const torrents = await this.getTorrents();
        const labels = new Set<string>();
        torrents.forEach(t => {
            if (t.tags) t.tags.forEach(tag => labels.add(tag));
        });
        return Array.from(labels).sort();
    }

    async setCategory(hash: string, category: string): Promise<void> {
        // Transmission doesn't have exclusive categories, so we just add it as a label.
        await this.addTags(hash, [category]);
    }

    async getTags(): Promise<string[]> {
        return this.getCategories();
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // 1. Get current tags
        const currentTags = await this.getTorrentTags(hash);
        // 2. Merge
        const newTags = Array.from(new Set([...currentTags, ...tags]));
        // 3. Set
        await this.call('torrent-set', {
            ids: [parseInt(hash)],
            labels: newTags
        });
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // 1. Get current tags
        const currentTags = await this.getTorrentTags(hash);
        // 2. Filter
        const newTags = currentTags.filter(t => !tags.includes(t));
        // 3. Set
        await this.call('torrent-set', {
            ids: [parseInt(hash)],
            labels: newTags
        });
    }

    private async getTorrentTags(hash: string): Promise<string[]> {
        const response = await this.call('torrent-get', {
            ids: [parseInt(hash)],
            fields: ['labels']
        });
        const parsed = TransmissionResponseSchema.parse(response);
        const torrent = parsed.arguments?.torrents?.[0];
        return torrent?.labels || [];
    }
}


