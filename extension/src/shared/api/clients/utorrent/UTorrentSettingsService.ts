import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { UTorrentSettingsResponseSchema } from './UTorrentSchema';
import { extractUTorrentToken } from './UTorrentParsingUtils';
import { ServerConfig } from '@/shared/lib/types';

/**
 * Parsed setting value with type information
 */
export interface UTorrentSetting {
    key: string;
    type: 'int' | 'bool' | 'string';
    value: string | number | boolean;
}

/**
 * Common settings keys for µTorrent
 */
export const SETTINGS_KEYS = {
    // Bandwidth
    MAX_UL_RATE: 'max_ul_rate',
    MAX_DL_RATE: 'max_dl_rate',
    MAX_ACTIVE_TORRENT: 'max_active_torrent',
    MAX_ACTIVE_DOWNLOADS: 'max_active_downloads',
    CONNS_GLOBALLY: 'conns_globally',
    CONNS_PER_TORRENT: 'conns_per_torrent',
    UL_SLOTS_PER_TORRENT: 'ul_slots_per_torrent',

    // Connectivity
    BIND_PORT: 'bind_port',
    UPNP: 'upnp',
    NATPMP: 'natpmp',
    RANDOM_PORT: 'random_port',

    // Privacy & Protocol
    ENCRYPTION_MODE: 'encryption_mode',
    DHT: 'dht',
    PEX: 'pex',
    LSD: 'lsd',

    // Directories
    DIR_ACTIVE_DOWNLOAD: 'dir_active_download',
    DIR_ACTIVE_DOWNLOAD_FLAG: 'dir_active_download_flag',
    DIR_COMPLETED_DOWNLOAD: 'dir_completed_download',
    DIR_COMPLETED_DOWNLOAD_FLAG: 'dir_completed_download_flag',
    DIR_AUTOLOAD: 'dir_autoload',
    DIR_AUTOLOAD_FLAG: 'dir_autoload_flag',

    // Scheduler
    SCHEDULER_ENABLE: 'scheduler_enable',
    SCHEDULER_TABLE: 'scheduler_table',
    SCHEDULER_UL_RATE: 'scheduler_ul_rate',
    SCHEDULER_DL_RATE: 'scheduler_dl_rate',
} as const;

/**
 * Service for managing µTorrent global settings
 * Separate from adapter to isolate complexity
 */
export class UTorrentSettingsService {
    private httpClient: FetchHttpClient;
    private token: string | null = null;
    private baseUrl: string;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.baseUrl = 'gui/';
    }

    /**
     * Authenticate and get token
     */
    async login(): Promise<void> {
        const headers = this.getAuthHeaders();
        const response = await this.httpClient.get<string>('gui/token.html', { headers });

        this.token = extractUTorrentToken(response);
    }

    /**
     * Get all settings from the client
     */
    async getSettings(): Promise<UTorrentSetting[]> {
        const response = await this.call(new URLSearchParams({ action: 'getsettings' }));
        const parsed = UTorrentSettingsResponseSchema.parse(response);

        if (!parsed.settings) {
            return [];
        }

        return parsed.settings.map(([key, typeNum, value]) => {
            let type: 'int' | 'bool' | 'string';
            let parsedValue: string | number | boolean;

            switch (typeNum) {
                case 0:
                    type = 'int';
                    parsedValue = Number(value);
                    break;
                case 1:
                    type = 'bool';
                    parsedValue = value === '1' || value === 1 || value === 'true';
                    break;
                default:
                    type = 'string';
                    parsedValue = String(value);
            }

            return { key, type, value: parsedValue };
        });
    }

    /**
     * Get a specific setting by key
     */
    async getSetting(key: string): Promise<UTorrentSetting | undefined> {
        const settings = await this.getSettings();
        return settings.find(s => s.key === key);
    }

    /**
     * Set a setting value
     * Note: Booleans must be sent as 0/1, not true/false
     */
    async setSetting(key: string, value: string | number | boolean): Promise<void> {
        let stringValue: string;

        if (typeof value === 'boolean') {
            stringValue = value ? '1' : '0';
        } else {
            stringValue = String(value);
        }

        await this.call(new URLSearchParams({
            action: 'setsetting',
            s: key,
            v: stringValue
        }));
    }

    /**
     * Set global upload limit
     * @param bytesPerSecond - 0 for unlimited
     */
    async setGlobalUploadLimit(bytesPerSecond: number): Promise<void> {
        await this.setSetting(SETTINGS_KEYS.MAX_UL_RATE, bytesPerSecond);
    }

    /**
     * Set global download limit
     * @param bytesPerSecond - 0 for unlimited
     */
    async setGlobalDownloadLimit(bytesPerSecond: number): Promise<void> {
        await this.setSetting(SETTINGS_KEYS.MAX_DL_RATE, bytesPerSecond);
    }

    /**
     * Enable or disable DHT
     */
    async setDHT(enabled: boolean): Promise<void> {
        await this.setSetting(SETTINGS_KEYS.DHT, enabled);
    }

    /**
     * Enable or disable Peer Exchange
     */
    async setPEX(enabled: boolean): Promise<void> {
        await this.setSetting(SETTINGS_KEYS.PEX, enabled);
    }

    // ========== Private Methods ==========

    private async call(params: URLSearchParams): Promise<unknown> {
        if (!this.token) {
            await this.login();
        }

        params.append('token', this.token || '');
        params.append('t', String(Date.now()));

        const url = `${this.baseUrl}?${params.toString()}`;
        const headers = this.getAuthHeaders();

        return this.httpClient.get(url, { headers });
    }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.username || this.config.password) {
            const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }
}
