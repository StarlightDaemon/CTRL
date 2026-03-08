import { z } from 'zod';

/**
 * Comprehensive qBittorrent torrent schema based on API v2 research.
 * Includes all fields for full feature support.
 */
export const QBittorrentTorrentSchema = z.object({
    // Core identification
    hash: z.string(),
    name: z.string(),
    magnet_uri: z.string().optional(),

    // State and progress
    state: z.string(),
    progress: z.number(),
    size: z.number(),

    // Transfer speeds
    dlspeed: z.number(),
    upspeed: z.number(),

    // Time fields
    eta: z.number(),
    added_on: z.number(),
    completion_on: z.number().optional(), // -1 if incomplete

    // Paths
    save_path: z.string(),
    content_path: z.string().optional(),

    // Peer/seed counts
    num_seeds: z.number().optional(),
    num_leechs: z.number().optional(),
    total_seeds: z.number().optional(), // From tracker/DHT
    total_leechs: z.number().optional(),

    // Ratio and priority
    ratio: z.number().optional(),
    priority: z.number().optional(), // Queue position, -1 = not queued

    // Bandwidth limits (0 = unlimited)
    dl_limit: z.number().optional(),
    up_limit: z.number().optional(),

    // Download mode flags
    seq_dl: z.boolean().optional(),           // Sequential download enabled
    f_l_piece_prio: z.boolean().optional(),   // First/last piece priority
    super_seeding: z.boolean().optional(),
    force_start: z.boolean().optional(),

    // Organization
    category: z.string().optional(),
    tags: z.string().optional(), // Comma-separated

    // Error info
    error: z.string().optional(),
});

export const QBittorrentListSchema = z.array(QBittorrentTorrentSchema);

export type QBittorrentTorrent = z.infer<typeof QBittorrentTorrentSchema>;

/**
 * File within a torrent
 */
export const QBittorrentFileSchema = z.object({
    index: z.number(),
    name: z.string(),
    size: z.number(),
    progress: z.number(),
    priority: z.number(), // 0=skip, 1=normal, 6=high, 7=max
    is_seed: z.boolean().optional(),
    availability: z.number().optional(),
});

export const QBittorrentFileListSchema = z.array(QBittorrentFileSchema);
export type QBittorrentFile = z.infer<typeof QBittorrentFileSchema>;

/**
 * Tracker info
 */
export const QBittorrentTrackerSchema = z.object({
    url: z.string(),
    status: z.number(), // 0=disabled, 1=not contacted, 2=working, 3=updating, 4=error
    tier: z.number(),
    num_peers: z.number(),
    num_seeds: z.number(),
    num_leeches: z.number(),
    num_downloaded: z.number(),
    msg: z.string().optional(), // Error message if status=4
});

export const QBittorrentTrackerListSchema = z.array(QBittorrentTrackerSchema);
export type QBittorrentTracker = z.infer<typeof QBittorrentTrackerSchema>;

/**
 * Global transfer info
 */
export const QBittorrentTransferInfoSchema = z.object({
    dl_info_speed: z.number(),
    dl_info_data: z.number(),
    up_info_speed: z.number(),
    up_info_data: z.number(),
    dl_rate_limit: z.number(),
    up_rate_limit: z.number(),
    dht_nodes: z.number().optional(),
    connection_status: z.string().optional(),
});

export type QBittorrentTransferInfo = z.infer<typeof QBittorrentTransferInfoSchema>;

/**
 * Sync Protocol Data (Phase 3)
 */
export const QBittorrentSyncDataSchema = z.object({
    rid: z.number(),
    full_update: z.boolean().optional(),
    torrents: z.record(QBittorrentTorrentSchema.partial()).optional(),
    torrents_removed: z.array(z.string()).optional(),
    categories: z.record(z.object({ name: z.string(), savePath: z.string() })).optional(),
    categories_removed: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    tags_removed: z.array(z.string()).optional(),
    server_state: QBittorrentTransferInfoSchema.partial().optional(),
});
export type QBittorrentSyncData = z.infer<typeof QBittorrentSyncDataSchema>;

/**
 * RSS Feed & Rule Schemas (Phase 3)
 */
export const QBittorrentRssFeedSchema = z.object({
    uid: z.string().optional(),
    url: z.string(),
    name: z.string().optional(),
    hasError: z.boolean().optional(),
    isLoading: z.boolean().optional(),
    articles: z.array(z.any()).optional(), // We typically don't need full article details
});

export const QBittorrentRssRuleSchema = z.object({
    enabled: z.boolean(),
    mustContain: z.string(),
    mustNotContain: z.string(),
    useRegex: z.boolean(),
    episodeFilter: z.string(),
    smartFilter: z.boolean(),
    affectedFeeds: z.array(z.string()), // Feed URLs
    savePath: z.string().optional(),
    assignedCategory: z.string().optional(),
    addPaused: z.boolean().optional(),
});
export type QBittorrentRssRule = z.infer<typeof QBittorrentRssRuleSchema>;

/**
 * Search Plugin & Result Schemas (Phase 3)
 */
export const QBittorrentSearchPluginSchema = z.object({
    enabled: z.boolean(),
    name: z.string(),
    fullName: z.string(),
    url: z.string().optional(),
    version: z.string(),
    supportedCategories: z.array(z.string()).optional(),
});

export const QBittorrentSearchResultSchema = z.object({
    descrLink: z.string().optional(),
    fileName: z.string(),
    fileSize: z.number(),
    fileUrl: z.string(),
    nbLeechers: z.number(),
    nbSeeders: z.number(),
    siteUrl: z.string(),
});

export const QBittorrentSearchStatusSchema = z.object({
    id: z.number(),
    status: z.string(), // "Running", "Stopped"
    total: z.number(),
});
export type QBittorrentSearchResult = z.infer<typeof QBittorrentSearchResultSchema>;

