/**
 * Transmission RPC Capability Detection and Type Definitions
 */

/**
 * Detected client type based on version string analysis
 */
export type TransmissionClientType = 'transmission' | 'biglybt' | 'vuze';

/**
 * Capabilities detected from session handshake
 * Used to enable/disable features and workarounds based on RPC version
 */
export interface TransmissionCapabilities {
    /** RPC version (integer) - authoritative capability flag */
    rpcVersion: number;

    /** Detected client type */
    clientType: TransmissionClientType;

    /** Software version string (may be spoofed by emulators) */
    softwareVersion: string;

    /** v16+ supports labels (tags) as first-class citizen */
    supportsLabels: boolean;

    /** v17+ uses trackerList string instead of trackerAdd/Remove arrays */
    supportsTrackerList: boolean;

    /** v17+ uses snake_case, older versions use kebab-case/camelCase */
    usesSnakeCase: boolean;

    /** v15+ supports free-space method (Vuze may not) */
    supportsFreeSpace: boolean;

    /** v14+ supports queue-move-* atomic operations */
    supportsQueueMoves: boolean;

    /** Vuze has known path reporting bug (includes torrent name in downloadDir) */
    hasVuzePathBug: boolean;
}

/**
 * Session response from session-get RPC call
 */
export interface TransmissionSession {
    'rpc-version'?: number;
    'rpc-version-semver'?: string;
    'rpc-version-minimum'?: number;
    version?: string;

    // Global speed limits
    'speed-limit-down'?: number;
    'speed-limit-down-enabled'?: boolean;
    'speed-limit-up'?: number;
    'speed-limit-up-enabled'?: boolean;

    // Alternative speed limits (Turtle Mode)
    'alt-speed-enabled'?: boolean;
    'alt-speed-down'?: number;
    'alt-speed-up'?: number;
    'alt-speed-time-enabled'?: boolean;
    'alt-speed-time-begin'?: number;
    'alt-speed-time-end'?: number;
    'alt-speed-time-day'?: number;

    // Paths
    'download-dir'?: string;
    'incomplete-dir'?: string;
    'incomplete-dir-enabled'?: boolean;

    // Blocklist
    'blocklist-enabled'?: boolean;
    'blocklist-size'?: number;
    'blocklist-url'?: string;

    // Queue
    'download-queue-size'?: number;
    'download-queue-enabled'?: boolean;
    'seed-queue-size'?: number;
    'seed-queue-enabled'?: boolean;
    'queue-stalled-enabled'?: boolean;
    'queue-stalled-minutes'?: number;

    // Network
    'peer-port'?: number;
    'port-forwarding-enabled'?: boolean;
    'dht-enabled'?: boolean;
    'pex-enabled'?: boolean;
    'utp-enabled'?: boolean;
    encryption?: string;

    // Misc
    'seed-ratio-limit'?: number;
    'seed-ratio-limited'?: boolean;
    'idle-seeding-limit'?: number;
    'idle-seeding-limit-enabled'?: boolean;
}

/**
 * Torrent error severity levels
 */
export enum TorrentErrorLevel {
    /** No error */
    OK = 0,
    /** Tracker warning (non-critical, e.g., "tracker overloaded") */
    TRACKER_WARNING = 1,
    /** Tracker error (critical, e.g., "unregistered torrent") */
    TRACKER_ERROR = 2,
    /** Local error (critical, e.g., "disk full", "permission denied") */
    LOCAL_ERROR = 3,
}

// ============================================================================
// Phase 2: Feature Parity Types
// ============================================================================

/**
 * Bandwidth priority levels for torrents
 */
export type BandwidthPriority = -1 | 0 | 1; // Low, Normal, High

/**
 * File priority levels
 */
export type FilePriority = -1 | 0 | 1; // Low, Normal, High

/**
 * Task 2.3: Torrent file information
 */
export interface TorrentFile {
    /** File index within the torrent */
    index: number;
    /** File name (relative path within torrent) */
    name: string;
    /** Total size in bytes */
    size: number;
    /** Bytes completed */
    bytesCompleted: number;
    /** Whether file is wanted (selected for download) */
    wanted: boolean;
    /** Priority: -1 (Low), 0 (Normal), 1 (High) */
    priority: FilePriority;
}

/**
 * Task 2.2: Tracker information
 */
export interface TrackerInfo {
    /** Tracker ID (for removal in v3) */
    id: number;
    /** Announce URL */
    announce: string;
    /** Scrape URL */
    scrape: string;
    /** Tier (priority group) */
    tier: number;
}

/**
 * Task 2.2: Tracker status/statistics
 */
export interface TrackerStats {
    /** Tracker ID */
    id: number;
    /** Announce URL */
    announce: string;
    /** Tier */
    tier: number;
    /** Time of last announce (Unix timestamp) */
    lastAnnounceTime: number;
    /** Result of last announce */
    lastAnnounceResult: string;
    /** Whether last announce succeeded */
    lastAnnounceSucceeded: boolean;
    /** Time of next announce (Unix timestamp) */
    nextAnnounceTime: number;
    /** Number of seeders reported by tracker */
    seederCount: number;
    /** Number of leechers reported by tracker */
    leecherCount: number;
    /** Number of downloads reported by tracker */
    downloadCount: number;
}

/**
 * Task 2.4: Bandwidth schedule configuration
 */
export interface BandwidthScheduleConfig {
    /** Whether Turtle Mode is currently active */
    altSpeedEnabled: boolean;
    /** Download limit during Turtle Mode (KB/s) */
    altSpeedDown: number;
    /** Upload limit during Turtle Mode (KB/s) */
    altSpeedUp: number;
    /** Whether the scheduler is enabled */
    schedulerEnabled: boolean;
    /** Start time in minutes from midnight (0-1439) */
    timeBegin: number;
    /** End time in minutes from midnight (0-1439) */
    timeEnd: number;
    /** Days bitmask: Sun=1, Mon=2, Tue=4, Wed=8, Thu=16, Fri=32, Sat=64 */
    days: number;
}

/**
 * Task 2.6: Free space response
 */
export interface FreeSpaceInfo {
    /** Path that was checked */
    path: string;
    /** Free bytes available */
    freeBytes: number;
    /** Total size of volume (if available) */
    totalBytes?: number;
}

/**
 * Helper: Day bitmask values for bandwidth scheduling
 */
export const ScheduleDays = {
    SUNDAY: 1,
    MONDAY: 2,
    TUESDAY: 4,
    WEDNESDAY: 8,
    THURSDAY: 16,
    FRIDAY: 32,
    SATURDAY: 64,
    WEEKDAYS: 62,   // Mon-Fri
    WEEKENDS: 65,   // Sat+Sun
    EVERY_DAY: 127, // All days
} as const;

// ============================================================================
// Phase 3: Optimization & UX Types
// ============================================================================

/**
 * Task 3.1: View mode for adaptive field fetching
 */
export type TorrentViewMode = 'list' | 'detail' | 'minimal';

/**
 * Task 3.1: Field sets for different view modes
 */
export const TorrentFieldSets = {
    /** Minimal fields for checking changes (recently-active) */
    minimal: [
        'id', 'status', 'percentDone', 'rateDownload', 'rateUpload'
    ],

    /** Lightweight fields for list view - balanced performance */
    list: [
        'id', 'name', 'status', 'totalSize', 'percentDone',
        'rateDownload', 'rateUpload', 'eta', 'queuePosition',
        'error', 'errorString', 'labels'
    ],

    /** Comprehensive fields for detail view - full data */
    detail: [
        'id', 'name', 'hashString', 'status',
        'totalSize', 'percentDone', 'rateDownload', 'rateUpload', 'eta',
        'downloadDir', 'addedDate',
        'error', 'errorString',
        'queuePosition', 'bandwidthPriority',
        'uploadRatio', 'uploadedEver', 'downloadedEver',
        'labels',
        // Additional detail fields
        'activityDate', 'doneDate', 'startDate',
        'leftUntilDone', 'sizeWhenDone', 'desiredAvailable',
        'peersConnected', 'peersGettingFromUs', 'peersSendingToUs',
        'seedRatioLimit', 'seedRatioMode',
        'isStalled', 'isFinished', 'isPrivate',
        'metadataPercentComplete', 'recheckProgress',
        'pieceCount', 'pieceSize', 'comment', 'creator'
    ]
} as const;

/**
 * Task 3.3: Enhanced torrent status with more granularity
 */
export type EnhancedTorrentStatus =
    | 'downloading'
    | 'seeding'
    | 'paused'
    | 'completed'
    | 'checking'
    | 'queued'
    | 'queued-verify'
    | 'queued-download'
    | 'queued-seed'
    | 'stalled'
    | 'stalled-download'
    | 'stalled-seed'
    | 'metadata'
    | 'error'
    | 'error-tracker'
    | 'error-local'
    | 'unknown';

/**
 * Task 3.3: Status metadata for UI display
 */
export interface TorrentStatusInfo {
    /** Primary status */
    status: EnhancedTorrentStatus;
    /** Human-readable label */
    label: string;
    /** Whether torrent is actively transferring */
    isActive: boolean;
    /** Error severity (null if no error) */
    errorSeverity: 'warning' | 'error' | null;
    /** Progress value (0-100) for checking/metadata */
    progress?: number;
}

/**
 * Task 3.5: Security warning types
 */
export type SecurityWarning =
    | 'insecure-remote'      // HTTP to non-localhost
    | 'self-signed-cert'     // HTTPS with self-signed certificate
    | 'mixed-content';       // Some resources over HTTP

/**
 * Task 3.5: Connection security info
 */
export interface ConnectionSecurityInfo {
    /** Whether connection uses HTTPS */
    isSecure: boolean;
    /** Whether host is localhost/127.0.0.1/::1 */
    isLocal: boolean;
    /** Active security warnings */
    warnings: SecurityWarning[];
    /** Human-readable security status */
    statusText: string;
}

