import { z } from 'zod';

// uTorrent returns array of arrays
// [HASH, STATUS, NAME, SIZE, PERCENT, DOWNLOADED, UPLOADED, RATIO, UPLOAD_SPEED, DOWNLOAD_SPEED, ETA, LABEL, PEERS, PEERS_CONNECTED, SEEDS, SEEDS_CONNECTED, AVAILABILITY, QUEUE_ORDER, REMAINING, DOWNLOAD_URL, RSS_FEED_URL, STATUS_MESSAGE, STREAM_ID, DATE_ADDED, DATE_COMPLETED, APP_UPDATE_URL, SAVE_PATH]
// 0     1       2     3     4        5           6         7      8             9               10   11     12     13               14     15               16            17           18         19            20           21              22         23          24              25              26

/** Torrent array indices for parsing */
export const TORRENT_INDEX = {
    HASH: 0,
    STATUS: 1,
    NAME: 2,
    SIZE: 3,
    PERCENT: 4,        // Progress in permils (1000 = 100%)
    DOWNLOADED: 5,
    UPLOADED: 6,
    RATIO: 7,          // Share ratio in permils
    UPLOAD_SPEED: 8,
    DOWNLOAD_SPEED: 9,
    ETA: 10,           // Seconds, -1 = unknown
    LABEL: 11,
    PEERS_CONNECTED: 12,
    PEERS_IN_SWARM: 13,
    SEEDS_CONNECTED: 14,
    SEEDS_IN_SWARM: 15,
    AVAILABILITY: 16,  // In 1/65535ths
    QUEUE_ORDER: 17,
    REMAINING: 18,
    DOWNLOAD_URL: 19,
    RSS_FEED_URL: 20,
    STATUS_MESSAGE: 21,
    STREAM_ID: 22,
    DATE_ADDED: 23,    // Unix timestamp
    DATE_COMPLETED: 24,
    APP_UPDATE_URL: 25,
    SAVE_PATH: 26,
} as const;

/** Status bitmask flags */
export const STATUS_FLAG = {
    STARTED: 1,
    CHECKING: 2,
    START_AFTER_CHECK: 4,
    CHECKED: 8,
    ERROR: 16,
    PAUSED: 32,
    QUEUED: 64,
    LOADED: 128,
} as const;

export const UTorrentResponseSchema = z.object({
    build: z.number().optional(),           // Client build number
    torrents: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
    torrentp: z.array(z.array(z.union([z.string(), z.number()]))).optional(), // Delta patches
    torrents_removed: z.array(z.string()).optional(), // Removed torrent hashes
    label: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
    torrentc: z.string().optional(),        // Cache ID for delta sync
    rssfeeds: z.array(z.unknown()).optional(),
});

export type UTorrentResponse = z.infer<typeof UTorrentResponseSchema>;

// ========== File List Response ==========
// Files are returned as arrays: [FILENAME, SIZE, DOWNLOADED, PRIORITY]

/** File array indices for parsing */
export const FILE_INDEX = {
    NAME: 0,        // Relative file path
    SIZE: 1,        // File size in bytes
    DOWNLOADED: 2,  // Bytes downloaded
    PRIORITY: 3,    // Priority (0-3)
} as const;

/** File priority values */
export const FILE_PRIORITY = {
    SKIP: 0,        // Don't download
    LOW: 1,
    NORMAL: 2,
    HIGH: 3,
} as const;

export const UTorrentFilesResponseSchema = z.object({
    build: z.number().optional(),
    files: z.array(z.tuple([
        z.string(),  // Hash
        z.array(z.array(z.union([z.string(), z.number()]))),  // File arrays
    ])).optional(),
});

export type UTorrentFilesResponse = z.infer<typeof UTorrentFilesResponseSchema>;

// ========== Properties Response ==========

export const UTorrentPropsResponseSchema = z.object({
    build: z.number().optional(),
    props: z.array(z.object({
        hash: z.string(),
        trackers: z.string().optional(),
        ulrate: z.number().optional(),
        dlrate: z.number().optional(),
        superseed: z.number().optional(),
        dht: z.number().optional(),
        pex: z.number().optional(),
        seed_override: z.number().optional(),
        seed_ratio: z.number().optional(),
        seed_time: z.number().optional(),
        ulslots: z.number().optional(),
    })).optional(),
});

export type UTorrentPropsResponse = z.infer<typeof UTorrentPropsResponseSchema>;

// ========== Settings Response ==========

export const UTorrentSettingsResponseSchema = z.object({
    build: z.number().optional(),
    settings: z.array(z.tuple([
        z.string(),  // Setting key
        z.number(),  // Type (0=int, 1=bool, 2=string)
        z.union([z.string(), z.number()]),  // Value
    ])).optional(),
});

export type UTorrentSettingsResponse = z.infer<typeof UTorrentSettingsResponseSchema>;


