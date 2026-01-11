import { ITorrentClient } from '../model/ITorrentClient';
import { ServerConfig } from '@/shared/lib/types';

/**
 * Factory for creating torrent client adapters.
 * Uses dynamic imports to ensure code for unused clients is not loaded.
 */
export class ClientFactory {
    async create(config: ServerConfig): Promise<ITorrentClient> {
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
            case 'synology': {
                const { SynologyAdapter } = await import('@/shared/api/clients/synology/SynologyAdapter');
                return new SynologyAdapter(config);
            }
            default:
                throw new Error(`Unsupported client type: ${config.type}`);
        }
    }
}
