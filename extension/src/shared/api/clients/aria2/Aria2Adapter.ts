import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { JsonRpcClient } from '@/shared/api/network/JsonRpcClient';
import { Aria2TorrentSchema, Aria2Torrent } from './Aria2Schema';
import { ServerConfig } from '@/shared/lib/types';
import { z } from 'zod';
import { blobToBase64 } from '@/shared/lib/helpers';

@injectable()
export class Aria2Adapter implements ITorrentClient {
    private rpcClient: JsonRpcClient;
    private secret: string;

    constructor(config: ServerConfig) {
        // Aria2 usually runs on /jsonrpc
        this.rpcClient = new JsonRpcClient(config.hostname);
        // Aria2 uses 'token:secret' as the first param in methods if using --rpc-secret
        // Or we can just store it to prepend to params
        this.secret = config.password || '';
    }

    async login(): Promise<void> {
        // Aria2 is stateless/token-based per request, no login session needed.
        // We verify connection here.
        await this.getVersion();
    }

    async logout(): Promise<void> {
        // No-op
    }

    async getTorrents(): Promise<Torrent[]> {
        // Aria2 requires separate calls for active, waiting, stopped.
        // Multicall would be better, but keeping it simple for SRP first.

        const params = [
            ['gid', 'status', 'totalLength', 'completedLength', 'uploadLength', 'downloadSpeed', 'uploadSpeed', 'dir']
        ];

        const [active, waiting, stopped] = await Promise.all([
            this.call('aria2.tellActive', params),
            this.call('aria2.tellWaiting', [0, 1000, ...params]),
            this.call('aria2.tellStopped', [0, 1000, ...params]),
        ]) as [unknown[], unknown[], unknown[]];

        const all = [...active, ...waiting, ...stopped];

        // Validate
        const schema = z.array(Aria2TorrentSchema);
        const parsed = schema.parse(all);

        return parsed.map(this.mapToEntity);
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        const opts = this.mapOptions(options);
        await this.call('aria2.addUri', [[url], opts]);
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        const base64 = await blobToBase64(file);
        const opts = this.mapOptions(options);
        await this.call('aria2.addTorrent', [base64, [], opts]);
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.call('aria2.pause', [id]);
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.call('aria2.unpause', [id]);
    }

    async removeTorrent(id: string, deleteData: boolean = false): Promise<void> {
        // Aria2 doesn't support deleting data via RPC easily without --rpc-allow-origin-all and specific flags,
        // or using aria2.removeDownloadResult.
        // Standard remove just removes the task.
        await this.call('aria2.remove', [id]);
        // If we really want to delete result/data, we might need 'aria2.removeDownloadResult' too
        try {
            await this.call('aria2.removeDownloadResult', [id]);
        } catch (e) {
            // Ignore
        }
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.getVersion();
            return true;
        } catch (e) {
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.getVersion();
        return Date.now() - start;
    }

    private async getVersion(): Promise<unknown> {
        return this.call('aria2.getVersion', []);
    }

    private async call(method: string, params: unknown[]): Promise<unknown> {
        const secureParams = this.secret ? [`token:${this.secret}`, ...params] : params;
        return this.rpcClient.call(method, secureParams);
    }

    private mapOptions(options?: AddTorrentOptions): Record<string, string> {
        if (!options) return {};
        const opts: Record<string, string> = {};
        if (options.path) opts['dir'] = options.path;
        if (options.paused) opts['pause'] = 'true';
        return opts;
    }

    private mapToEntity(t: Aria2Torrent): Torrent {
        return {
            id: t.gid,
            name: 'Unknown', // Aria2 doesn't give name in basic status, might need 'bittorrent' field or files[0].path
            status: Aria2Adapter.mapStatus(t.status),
            progress: (parseInt(t.completedLength) / parseInt(t.totalLength)) * 100 || 0,
            size: parseInt(t.totalLength),
            downloadSpeed: parseInt(t.downloadSpeed),
            uploadSpeed: parseInt(t.uploadSpeed),
            eta: 0, // Aria2 doesn't provide ETA directly
            savePath: t.dir,
            addedDate: 0, // Not provided
        };
    }

    private static mapStatus(status: string): TorrentStatus {
        switch (status) {
            case 'active': return 'downloading';
            case 'waiting': return 'queued'; // 'checking' or 'queued'
            case 'paused': return 'paused';
            case 'error': return 'error';
            case 'complete': return 'completed';
            case 'removed': return 'unknown';
            default: return 'unknown';
        }
    }
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
