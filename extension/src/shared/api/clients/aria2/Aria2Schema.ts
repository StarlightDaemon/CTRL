import { z } from 'zod';

/**
 * BitTorrent metadata info schema
 * Contains the display name from .torrent file
 */
export const Aria2BitTorrentInfoSchema = z.object({
    name: z.string(),
}).optional();

/**
 * BitTorrent metadata schema
 * Only present for BitTorrent downloads (not HTTP/FTP)
 */
export const Aria2BitTorrentSchema = z.object({
    announceList: z.array(z.array(z.string())).optional(),
    comment: z.string().optional(),
    creationDate: z.string().optional(),
    mode: z.enum(['single', 'multi']).optional(),
    info: Aria2BitTorrentInfoSchema,
}).optional();

/**
 * File URI schema for multi-source downloads
 */
export const Aria2FileUriSchema = z.object({
    uri: z.string(),
    status: z.string(), // "used" or "waiting"
});

/**
 * Individual file schema within a download
 * Note: index is 1-based in Aria2
 */
export const Aria2FileSchema = z.object({
    index: z.string().optional(),
    path: z.string(),
    length: z.string(),
    completedLength: z.string(),
    selected: z.string(), // "true" or "false"
    uris: z.array(Aria2FileUriSchema).optional(),
});

/**
 * Main torrent/download schema
 * All numeric values are strings in Aria2 JSON-RPC responses
 */
export const Aria2TorrentSchema = z.object({
    // Core identifiers
    gid: z.string(),
    status: z.string(), // active, waiting, paused, error, complete, removed

    // Size and progress (strings for large number precision)
    totalLength: z.string(),
    completedLength: z.string(),
    uploadLength: z.string(),

    // Speed (bytes/second as strings)
    downloadSpeed: z.string(),
    uploadSpeed: z.string(),

    // Location
    dir: z.string(),

    // BitTorrent-specific (optional for HTTP/FTP downloads)
    infoHash: z.string().optional(),
    bittorrent: Aria2BitTorrentSchema,

    // Peer information
    numSeeders: z.string().optional(),
    connections: z.string().optional(),
    seeder: z.string().optional(), // "true" if seeding

    // Piece information (for advanced progress visualization)
    bitfield: z.string().optional(),
    pieceLength: z.string().optional(),
    numPieces: z.string().optional(),

    // Error information
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),

    // GID tracking for multi-phase downloads (magnet -> torrent)
    // Aria2 wire format: followedBy and following are arrays of GID strings
    followedBy: z.array(z.string()).optional(),
    following: z.array(z.string()).optional(),
    belongsTo: z.string().optional(),

    // File list
    files: z.array(Aria2FileSchema).optional(),
});

/**
 * Global statistics schema from aria2.getGlobalStat
 */
export const Aria2GlobalStatSchema = z.object({
    downloadSpeed: z.string(),
    uploadSpeed: z.string(),
    numActive: z.string(),
    numWaiting: z.string(),
    numStopped: z.string(),
    numStoppedTotal: z.string().optional(),
});

/**
 * Version info schema from aria2.getVersion
 */
export const Aria2VersionSchema = z.object({
    version: z.string(),
    enabledFeatures: z.array(z.string()),
});

// Type exports
export type Aria2Torrent = z.infer<typeof Aria2TorrentSchema>;
export type Aria2File = z.infer<typeof Aria2FileSchema>;
export type Aria2BitTorrent = z.infer<typeof Aria2BitTorrentSchema>;
export type Aria2GlobalStat = z.infer<typeof Aria2GlobalStatSchema>;
export type Aria2Version = z.infer<typeof Aria2VersionSchema>;
