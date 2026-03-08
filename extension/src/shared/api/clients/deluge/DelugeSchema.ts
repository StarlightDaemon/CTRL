import { z } from 'zod';

/**
 * Deluge JSON-RPC Response Wrapper
 */
export const DelugeRpcResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) => z.object({
    result: dataSchema.nullable(),
    error: z.object({
        message: z.string(),
        code: z.number().optional()
    }).nullable(),
    id: z.number()
});

/**
 * Deluge 'web.update_ui' Torrent Object
 * Keys match the fields requested in the 'keys' parameter.
 * Extended with additional fields from research.
 */
export const DelugeTorrentSchema = z.object({
    hash: z.string(),
    name: z.string(),
    state: z.string(), // "Downloading", "Seeding", "Paused", "Error", "Queued", "Allocating", "Moving"
    progress: z.number(), // 0-100
    eta: z.number(), // Seconds
    save_path: z.string(),
    download_payload_rate: z.number(), // B/s
    upload_payload_rate: z.number(), // B/s
    total_size: z.number(), // Bytes
    ratio: z.number(),
    queue: z.number(),
    // Extended fields (optional for backward compatibility)
    time_added: z.number().optional(), // Unix timestamp
    active_time: z.number().optional(), // Seconds
    seeding_time: z.number().optional(), // Seconds
    total_done: z.number().optional(), // Bytes completed
    total_uploaded: z.number().optional(), // Bytes uploaded
    num_files: z.number().optional(),
    is_finished: z.boolean().optional(),
    paused: z.boolean().optional(),
    label: z.string().optional(), // Requires Label plugin
    comment: z.string().optional(),
    tracker_status: z.string().optional(),
    // Peer counts (version-dependent field names)
    num_peers: z.number().optional(), // Deluge 1.x
    num_seeds: z.number().optional(), // Deluge 1.x
    total_peers: z.number().optional(),
    total_seeds: z.number().optional(),
});

/**
 * Deluge 'web.update_ui' Response
 */
export const DelugeUpdateUiSchema = z.object({
    torrents: z.record(z.string(), DelugeTorrentSchema).optional(), // Hash -> Torrent
    filters: z.record(z.string(), z.any()).optional(),
    stats: z.object({
        max_download: z.number().optional(),
        max_upload: z.number().optional(),
        max_num_connections: z.number().optional()
    }).optional()
});

export const DelugeHostSchema = z.tuple([
    z.string(), // ID
    z.string(), // IP
    z.number(), // Port
    z.string(), // Status?
    z.any().optional()
]);

export const DelugeHostsListSchema = z.array(DelugeHostSchema);

/**
 * WebUI Plugin Information Response
 * From web.get_plugins
 */
export const DelugeWebPluginsSchema = z.object({
    available_plugins: z.array(z.string()),
    enabled_plugins: z.array(z.string())
});

/**
 * Methods List Response
 * From system.listMethods
 */
export const DelugeMethodsSchema = z.array(z.string());

/**
 * Torrent Options for core.set_torrent_options
 */
export const DelugeTorrentOptionsSchema = z.object({
    download_location: z.string().optional(),
    move_completed: z.boolean().optional(),
    move_completed_path: z.string().optional(),
    max_download_speed: z.number().optional(), // KiB/s
    max_upload_speed: z.number().optional(),   // KiB/s
    max_connections: z.number().optional(),
    max_upload_slots: z.number().optional(),
    prioritize_first_last_pieces: z.boolean().optional(),
    auto_managed: z.boolean().optional(),
    stop_at_ratio: z.boolean().optional(),
    stop_ratio: z.number().optional(),
    remove_at_ratio: z.boolean().optional(),
    sequential_download: z.boolean().optional(),
    super_seeding: z.boolean().optional(),
    file_priorities: z.array(z.number()).optional(), // Array of priority values
});

/**
 * File priority values
 * 0 = Skip/Do Not Download
 * 1 = Normal Priority
 * 5 = High Priority
 * 7 = Highest Priority
 */
export type DelugeFilePriority = 0 | 1 | 5 | 7;

/**
 * Deluge File Object
 * From core.get_torrent_status with 'files' key
 */
export const DelugeFileSchema = z.object({
    index: z.number(),
    path: z.string(),
    size: z.number(),
    offset: z.number().optional(),
});

/**
 * Deluge Peer Object
 * From core.get_torrent_status with 'peers' key
 */
export const DelugePeerSchema = z.object({
    ip: z.string(),
    client: z.string(),
    down_speed: z.number(),
    up_speed: z.number(),
    progress: z.number(),
    seed: z.boolean().optional(),
    country: z.string().optional(),
});

/**
 * Deluge Tracker Object
 * From core.get_torrent_status with 'trackers' key
 */
export const DelugeTrackerSchema = z.object({
    url: z.string(),
    tier: z.number(),
    fails: z.number().optional(),
    verified: z.boolean().optional(),
    updating: z.boolean().optional(),
    send_stats: z.boolean().optional(),
});

export type DelugeTorrent = z.infer<typeof DelugeTorrentSchema>;
export type DelugeWebPlugins = z.infer<typeof DelugeWebPluginsSchema>;
export type DelugeTorrentOptions = z.infer<typeof DelugeTorrentOptionsSchema>;
export type DelugeFile = z.infer<typeof DelugeFileSchema>;
export type DelugePeer = z.infer<typeof DelugePeerSchema>;
export type DelugeTracker = z.infer<typeof DelugeTrackerSchema>;
