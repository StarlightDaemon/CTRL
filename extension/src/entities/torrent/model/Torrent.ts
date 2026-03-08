export type TorrentStatus =
    | 'downloading'
    | 'seeding'
    | 'paused'
    | 'completed'
    | 'error'
    | 'checking'
    | 'queued'
    | 'stalled'
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

    // Phase 1.3: Error reporting
    /** Error level: 0=OK, 1=Warning, 2=Tracker Error, 3=Local Error */
    errorLevel?: number;
    /** Human-readable error message */
    errorMessage?: string;

    // Phase 1.4: Queue and priority
    /** Position in download queue (0 = top), undefined if not queued */
    queuePosition?: number;
    /** Bandwidth priority: -1 (Low), 0 (Normal), 1 (High) */
    priority?: number;

    // Phase 1.4: Persistent identifier
    /** SHA1 hash (persistent across sessions, unlike ephemeral id) */
    hash?: string;

    // Phase 1.4: Statistics
    /** Upload/download ratio */
    ratio?: number;
    /** Total bytes uploaded across all sessions */
    uploadedTotal?: number;
    /** Total bytes downloaded across all sessions */
    downloadedTotal?: number;

    // Peer/seed counts
    /** Number of connected seeds */
    seeds?: number;
    /** Number of connected peers/leeches */
    peers?: number;

    // Download mode flags
    /** Sequential download enabled */
    sequentialDownload?: boolean;
    /** First/last piece priority enabled */
    firstLastPiecePrio?: boolean;

    // Error message (from client)
    error?: string;
}

