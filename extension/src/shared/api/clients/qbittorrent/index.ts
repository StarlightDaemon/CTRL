/**
 * QBittorrent Client Module
 * 
 * Exports all qBittorrent adapter components for easy importing.
 */

// Core adapter
export { QBittorrentAdapter } from './QBittorrentAdapter';

// Services
export { QBittorrentFileService, FilePriority } from './QBittorrentFileService';
export { QBittorrentTrackerService, TrackerStatus } from './QBittorrentTrackerService';
export { QBittorrentTransferService } from './QBittorrentTransferService';
export { QBittorrentSyncService } from './QBittorrentSyncService';
export { QBittorrentRssService } from './QBittorrentRssService';
export { QBittorrentSearchService } from './QBittorrentSearchService';


// Schemas and types
export {
    QBittorrentTorrentSchema,
    QBittorrentListSchema,
    QBittorrentFileSchema,
    QBittorrentFileListSchema,
    QBittorrentTrackerSchema,
    QBittorrentTrackerListSchema,
    QBittorrentTransferInfoSchema,
    type QBittorrentTorrent,
    type QBittorrentFile,
    type QBittorrentTracker,
    type QBittorrentTransferInfo,
} from './QBittorrentSchema';
