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
 */
export const DelugeTorrentSchema = z.object({
    hash: z.string(),
    name: z.string(),
    state: z.string(), // "Downloading", "Seeding", "Paused", "Error", "Queued"
    progress: z.number(), // 0-100
    eta: z.number(), // Seconds
    save_path: z.string(),
    download_payload_rate: z.number(), // B/s
    upload_payload_rate: z.number(), // B/s
    total_size: z.number(), // Bytes
    ratio: z.number(),
    queue: z.number()
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

export type DelugeTorrent = z.infer<typeof DelugeTorrentSchema>;
