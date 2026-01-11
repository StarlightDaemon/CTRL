export type TorrentStatus =
    | 'downloading'
    | 'seeding'
    | 'paused'
    | 'completed'
    | 'error'
    | 'checking'
    | 'queued'
    | 'unknown';

export interface Torrent {
    id: string;
    name: string;
    status: TorrentStatus;
    progress: number; // 0-100
    size: number; // Bytes
    downloadSpeed: number; // Bytes/sec
    uploadSpeed: number; // Bytes/sec
    eta: number; // Seconds
    savePath: string;
    addedDate: number; // Timestamp
    category?: string;
    tags?: string[];
}
