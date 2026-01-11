import { z } from 'zod';

// uTorrent returns array of arrays
// [HASH, STATUS, NAME, SIZE, PERCENT, DOWNLOADED, UPLOADED, RATIO, UPLOAD_SPEED, DOWNLOAD_SPEED, ETA, LABEL, PEERS, PEERS_CONNECTED, SEEDS, SEEDS_CONNECTED, AVAILABILITY, QUEUE_ORDER, REMAINING]
// 0     1       2     3     4        5           6         7      8             9               10   11     12     13               14     15               16            17           18

export const UTorrentResponseSchema = z.object({
    torrents: z.array(z.array(z.union([z.string(), z.number()]))),
    label: z.array(z.array(z.union([z.string(), z.number()]))).optional(),
    torrentc: z.string().optional(), // Cache ID
});

export type UTorrentResponse = z.infer<typeof UTorrentResponseSchema>;
