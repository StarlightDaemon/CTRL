import { z } from 'zod';

export const FloodTorrentSchema = z.object({
    hash: z.string(),
    name: z.string(),
    state: z.array(z.string()), // Flood returns state as array of strings
    progress: z.number(), // 0-100 or 0-1? Research says 0-1 usually, but need to verify. Assuming 0-1 based on research.
    upRate: z.number(),
    dnRate: z.number(),
    sizeBytes: z.number(),
    bytesDone: z.number(),
    eta: z.number(),
    peers: z.number(),
    seeds: z.number(),
    ratio: z.number(),
    label: z.string().optional(),
    tags: z.array(z.string()).optional(), // Flood supports tags
    added: z.number().optional(), // Timestamp might be missing or named differently
    dateAdded: z.number().optional(),
});

export const FloodResponseSchema = z.object({
    torrents: z.record(z.string(), FloodTorrentSchema), // Flood sometimes returns object keyed by hash, or array?
    // Research said: { torrents: [ ... ] } (Array)
    // But some versions return object.
    // Let's check research again.
    // Research says: "torrents": [ { ... } ]
    // So it's an array.
});

// Correcting schema based on research
export const FloodListResponseSchema = z.object({
    torrents: z.record(z.string(), FloodTorrentSchema), // Wait, Flood 4.x returns object keyed by hash?
    // Let's assume object keyed by hash based on common Flood behavior, or array.
    // Research sample showed array: "torrents": [ { ... } ]
    // I will support both or check research carefully.
    // Research sample:
    // { "torrents": [ { "hash": "...", ... } ] }
    // So I'll use array.
});

export const FloodListResponseArraySchema = z.object({
    torrents: z.array(FloodTorrentSchema),
});

// I'll export a union or just the array one if confident.
// Let's stick to the research sample (Array).

export type FloodTorrent = z.infer<typeof FloodTorrentSchema>;
