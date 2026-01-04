import { z } from 'zod';

export const Aria2TorrentSchema = z.object({
    gid: z.string(),
    status: z.string(),
    totalLength: z.string(), // Aria2 returns strings for large numbers
    completedLength: z.string(),
    uploadLength: z.string(),
    downloadSpeed: z.string(),
    uploadSpeed: z.string(),
    dir: z.string(),
    files: z.array(z.object({
        path: z.string(),
        length: z.string(),
        completedLength: z.string(),
        selected: z.string(), // "true" or "false"
    })).optional(),
});

export const Aria2GlobalStatSchema = z.object({
    downloadSpeed: z.string(),
    uploadSpeed: z.string(),
    numActive: z.string(),
    numWaiting: z.string(),
    numStopped: z.string(),
});

export type Aria2Torrent = z.infer<typeof Aria2TorrentSchema>;
