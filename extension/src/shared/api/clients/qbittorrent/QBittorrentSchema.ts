import { z } from 'zod';

export const QBittorrentTorrentSchema = z.object({
    hash: z.string(),
    name: z.string(),
    state: z.string(),
    size: z.number(),
    progress: z.number(),
    dlspeed: z.number(),
    upspeed: z.number(),
    eta: z.number(),
    save_path: z.string(),
    added_on: z.number(),
    category: z.string().optional(),
    tags: z.string().optional(), // qBit returns comma separated tags
});

export const QBittorrentListSchema = z.array(QBittorrentTorrentSchema);

export type QBittorrentTorrent = z.infer<typeof QBittorrentTorrentSchema>;
