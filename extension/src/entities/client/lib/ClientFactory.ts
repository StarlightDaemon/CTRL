import { ITorrentClient } from '../model/ITorrentClient';
import { ServerConfig } from '@/shared/lib/types';

/**
 * Factory for creating torrent client adapters.
 * Uses dynamic imports to ensure code for unused clients is not loaded.
 */
export class ClientFactory {
    /**
     * Validates the server configuration by shape/schema.
     * Prevents instantiation of clients with incomplete or obviously invalid data.
     */
    static validate(config: ServerConfig): boolean {
        if (!config) return false;

        // Core required fields for any client
        if (!config.hostname || !config.type) {
            return false;
        }

        // Hostname must be a valid URL (at least starts with http/https/ws/wss)
        try {
            new URL(config.hostname);
        } catch (e) {
            return false;
        }

        // Additional type-specific validation could go here if needed.
        // For now, presence of hostname and type is the primary requirement.

        return true;
    }

    async create(config: ServerConfig): Promise<ITorrentClient> {
        // Final guard: Ensure config is valid before proceeding
        if (!ClientFactory.validate(config)) {
            console.error('[ClientFactory] Refusing to create client for invalid config:', config);
            throw new Error('Invalid server configuration. Please configure a server in options.');
        }

        switch (config.type) {
            case 'qbittorrent': {
                const { QBittorrentAdapter } = await import('@/shared/api/clients/qbittorrent/QBittorrentAdapter');
                return new QBittorrentAdapter(config);
            }
            case 'deluge': {
                // Ensure the path matches the actual file structure later
                const { DelugeAdapter } = await import('@/shared/api/clients/deluge/DelugeAdapter');
                return new DelugeAdapter(config);
            }
            case 'transmission': {
                const { TransmissionAdapter } = await import('@/shared/api/clients/transmission/TransmissionAdapter');
                return new TransmissionAdapter(config);
            }
            case 'rutorrent': {
                const { RuTorrentAdapter } = await import('@/shared/api/clients/rutorrent/RuTorrentAdapter');
                return new RuTorrentAdapter(config);
            }
            case 'flood': {
                const { FloodAdapter } = await import('@/shared/api/clients/flood/FloodAdapter');
                return new FloodAdapter(config);
            }
            case 'aria2': {
                const { Aria2Adapter } = await import('@/shared/api/clients/aria2/Aria2Adapter');
                return new Aria2Adapter(config);
            }
            case 'biglybt': {
                const { BiglyBTAdapter } = await import('@/shared/api/clients/biglybt/BiglyBTAdapter');
                return new BiglyBTAdapter(config);
            }
            case 'utorrent': {
                const { UTorrentAdapter } = await import('@/shared/api/clients/utorrent/UTorrentAdapter');
                return new UTorrentAdapter(config);
            }
            case 'vuze_remoteui': {
                const { VuzeAdapter } = await import('@/shared/api/clients/vuze/VuzeAdapter');
                return new VuzeAdapter(config);
            }
            default:
                throw new Error(`Unsupported client type: ${config.type}`);
        }
    }
}
