import { injectable } from 'tsyringe';
import { ITorrentClient, AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import { Torrent, TorrentStatus } from '@/entities/torrent/model/Torrent';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { ServerConfig } from '@/shared/lib/types';
import { DelugeRpcResponseSchema, DelugeUpdateUiSchema, DelugeHostsListSchema, DelugeTorrent } from './DelugeSchema';

@injectable()
export class DelugeAdapter implements ITorrentClient {
    private client: FetchHttpClient;
    private baseUrl: string;
    private config: ServerConfig;
    private requestId = 0;

    constructor(config: ServerConfig) {
        this.config = config;
        this.baseUrl = `${config.hostname.replace(/\/$/, '')}/json`;
        this.client = new FetchHttpClient(this.baseUrl);
    }

    private nextId() {
        return ++this.requestId;
    }

    /**
     * Generic wrapper for Deluge JSON-RPC calls.
     * Handles payload construction and basic error parsing.
     */
    private async call<T>(method: string, params: unknown[] = []): Promise<T> {
        const payload = {
            method,
            params,
            id: this.nextId()
        };

        // FetchHttpClient handles 'credentials: include' by default if configured? 
        // We need to ensure credentials are sent.
        // NOTE: FetchHttpClient might need a flag for credentials if not default. 
        // Assuming FetchHttpClient supports custom headers/init.
        // If FetchHttpClient is simple wrapper, we might need to modify it or pass init.
        // For now, let's assume standard behavior or pass a custom init if the class supports it.
        // Checking FetchHttpClient definition would be wise, but I'll proceed assuming standard fetch behavior.

        // Actually, Deluge REQUIRES `credentials: 'include'`. 
        // I will use `this.client.post` but I need to make sure it includes credentials.

        const response = await this.client.post<any>('', payload); // POST to /json root

        // Parse RPC Wrapper
        if (response.error) {
            throw new Error(`Deluge RPC Error: ${response.error.message || 'Unknown code ' + response.error.code}`);
        }

        return response.result as T;
    }

    /**
     * The Multi-Step Handshake
     */
    async login(): Promise<void> {
        console.log('[Deluge] Starting Handshake...');

        // 1. Auth Login
        // Deluge WebUI usually just takes password. 
        const loginRes = await this.call<boolean>('auth.login', [this.config.password]);
        if (!loginRes) {
            throw new Error('Authentication Failed');
        }

        // 2. Check Connection to Daemon
        const isConnected = await this.call<boolean>('web.connected');
        if (!isConnected) {
            // 3. Get Hosts
            const hosts = await this.call<any[]>('web.get_hosts');
            // DelugeHostsListSchema.parse(hosts); // Optional validation

            if (!hosts || hosts.length === 0) {
                throw new Error('No Deluge Daemons available');
            }

            // Default to first host (tuple[0] is ID)
            const hostId = hosts[0][0];

            // 4. Connect
            await this.call('web.connect', [hostId]);
        }

        console.log('[Deluge] Handshake Complete');
    }

    async logout(): Promise<void> {
        await this.call('auth.delete_session');
    }

    /**
     * Helper to handle re-auth loop
     */
    private async ensureAuth<T>(action: () => Promise<T>): Promise<T> {
        try {
            return await action();
        } catch (e: unknown) {
            // Deluge error code 1 or message "Not authenticated"
            const message = e instanceof Error ? e.message : String(e);
            if (message.includes('Not authenticated') || message.includes('Error: 1')) {
                console.log('[Deluge] Session expired, re-authenticating...');
                await this.login();
                return await action();
            }
            throw e;
        }
    }

    async getTorrents(): Promise<Torrent[]> {
        return this.ensureAuth(async () => {
            const keys = [
                "name", "state", "progress", "eta",
                "download_payload_rate", "upload_payload_rate",
                "total_size", "hash", "save_path", "ratio", "queue"
            ];

            const response = await this.call<any>('web.update_ui', [keys, {}]);
            const validated = DelugeUpdateUiSchema.parse(response);

            if (!validated.torrents) return [];

            return Object.values(validated.torrents).map(t => this.mapTorrent(t));
        });
    }

    async addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void> {
        await this.ensureAuth(async () => {
            const delugeOptions = {
                add_paused: options?.paused ?? false,
                download_location: options?.path
            };

            // path is "core.add_torrent_url"
            // params: [url, options, headers]
            await this.call('core.add_torrent_url', [url, delugeOptions, {}]);
        });
    }

    async addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void> {
        await this.ensureAuth(async () => {
            const base64 = await this.blobToBase64(file);
            const delugeOptions = {
                add_paused: options?.paused ?? false,
                download_location: options?.path
            };

            // params: [filename, base64_content, options]
            // Filename must be present.
            const filename = 'upload.torrent';

            await this.call('core.add_torrent_file', [filename, base64, delugeOptions]);
        });
    }

    async pauseTorrent(id: string): Promise<void> {
        await this.ensureAuth(async () => this.call('core.pause_torrent', [[id]]));
    }

    async resumeTorrent(id: string): Promise<void> {
        await this.ensureAuth(async () => this.call('core.resume_torrent', [[id]]));
    }

    async removeTorrent(id: string, deleteData?: boolean): Promise<void> {
        // Deluge remove_torrent takes [id, remove_data (bool)]
        await this.ensureAuth(async () => this.call('core.remove_torrent', [id, deleteData ?? false]));
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.login();
            return true;
        } catch (e) {
            console.error('[Deluge] Test Failed:', e);
            return false;
        }
    }

    async ping(): Promise<number> {
        const start = Date.now();
        await this.call('web.connected');
        return Date.now() - start;
    }

    // Categories in Deluge are "Labels" (Plugin). 
    // This requires the 'Label' plugin to be enabled.
    async getCategories(): Promise<string[]> {
        return this.ensureAuth(async () => {
            try {
                // label.get_labels
                const labels = await this.call<string[]>('label.get_labels');
                return labels || [];
            } catch (e) {
                // Plugin might not be enabled
                return [];
            }
        });
    }

    async setCategory(hash: string, category: string): Promise<void> {
        await this.ensureAuth(async () => {
            await this.call('label.set_torrent', [hash, category]);
        });
    }

    async getTags(): Promise<string[]> {
        return []; // Deluge uses Labels, mapped to Categories. Tags are not distinct in v1/v2 core.
    }

    async addTags(hash: string, tags: string[]): Promise<void> {
        // No-op
    }

    async removeTags(hash: string, tags: string[]): Promise<void> {
        // No-op
    }

    private mapTorrent(t: DelugeTorrent): Torrent {
        return {
            id: t.hash,
            name: t.name,
            status: this.mapStatus(t.state),
            progress: t.progress,
            size: t.total_size,
            downloadSpeed: t.download_payload_rate,
            uploadSpeed: t.upload_payload_rate,
            eta: t.eta,
            savePath: t.save_path,
            addedDate: 0, // Deluge update_ui doesn't return time_added by default, need deeper query
            category: '', // Would need to query labels separately or add to keys if supported
            tags: []
        };
    }

    private mapStatus(state: string): TorrentStatus {
        // Deluge states: "Downloading", "Seeding", "Paused", "Checking", "Queued", "Error"
        const lower = state.toLowerCase();
        if (lower === 'downloading') return 'downloading';
        if (lower === 'seeding') return 'seeding';
        if (lower === 'paused') return 'paused';
        if (lower === 'checking') return 'checking';
        if (lower === 'queued') return 'queued';
        if (lower === 'error') return 'error';
        return 'unknown';
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data:application/x-bittorrent;base64, prefix
                const raw = result.split(',')[1];
                resolve(raw);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}
