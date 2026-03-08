import { z } from 'zod';

// ============================================================================
// Session & Authentication Schemas
// ============================================================================

/**
 * Response from GET /api/auth/verify
 * Validates session and provides backend connection status
 */
export const FloodSessionVerifySchema = z.object({
    username: z.string(),
    level: z.enum(['admin', 'user']).optional().default('user'),
    clientConnected: z.boolean(),
});

export type FloodSessionVerify = z.infer<typeof FloodSessionVerifySchema>;

/**
 * Response from GET /api/client/connection-test
 * Checks if Flood can reach the torrent daemon
 */
export const FloodConnectionTestSchema = z.object({
    isConnected: z.boolean(),
});

export type FloodConnectionTest = z.infer<typeof FloodConnectionTestSchema>;

// ============================================================================
// Error Handling Schemas
// ============================================================================

/**
 * Zod validation error issue format (422 responses)
 */
export const FloodZodIssueSchema = z.object({
    code: z.string(),
    expected: z.string().optional(),
    received: z.string().optional(),
    path: z.array(z.union([z.string(), z.number()])),
    message: z.string(),
});

export const FloodValidationErrorSchema = z.object({
    code: z.literal('validation_error'),
    message: z.string(),
    issues: z.array(FloodZodIssueSchema),
});

export type FloodValidationError = z.infer<typeof FloodValidationErrorSchema>;

// ============================================================================
// Torrent Schemas
// ============================================================================

/**
 * Extended torrent schema with all fields from research
 * Flood returns state as array of strings: ['downloading', 'active']
 * Progress is 0-1 scale (multiply by 100 for percentage)
 */
export const FloodTorrentSchema = z.object({
    hash: z.string(),
    name: z.string(),
    state: z.array(z.string()),
    progress: z.number(), // 0-1 scale
    upRate: z.number(),
    dnRate: z.number(),
    sizeBytes: z.number(),
    bytesDone: z.number(),
    eta: z.number(),
    peers: z.number(),
    seeds: z.number(),
    ratio: z.number(),
    // Optional fields - may vary by Flood version/backend
    label: z.string().optional(),
    tags: z.array(z.string()).optional(),
    added: z.number().optional(),
    dateAdded: z.number().optional(),
    // Extended fields from research
    basePath: z.string().optional(),
    directory: z.string().optional(),
    isComplete: z.boolean().optional(),
    isHalted: z.boolean().optional(),
    isHashing: z.boolean().optional(),
    priority: z.number().optional(), // 0-3 priority levels
    percentComplete: z.number().optional(), // 0-100 scale (redundant with progress)
    dateCreated: z.number().optional(),
    dateFinished: z.number().optional(),
    trackerURIs: z.array(z.string()).optional(),
    isSequential: z.boolean().optional(),
    isInitialSeeding: z.boolean().optional(),
});

export type FloodTorrent = z.infer<typeof FloodTorrentSchema>;

/**
 * Torrents list response - array format (jesec/flood standard)
 */
export const FloodListResponseArraySchema = z.object({
    torrents: z.array(FloodTorrentSchema),
});

/**
 * Torrents list response - object format (keyed by hash, some Flood versions)
 */
export const FloodListResponseObjectSchema = z.object({
    torrents: z.record(z.string(), FloodTorrentSchema),
});

// ============================================================================
// System Schemas
// ============================================================================

/**
 * Response from GET /api/system/disk-usage
 */
export const FloodDiskUsageSchema = z.object({
    path: z.string(),
    free: z.number(),
    total: z.number(),
    used: z.number(),
    percent: z.number(), // 0-100
});

export const FloodDiskUsageResponseSchema = z.array(FloodDiskUsageSchema);

export type FloodDiskUsage = z.infer<typeof FloodDiskUsageSchema>;

/**
 * Response from GET /api/client/settings
 * Used for backend type detection
 */
export const FloodClientSettingsSchema = z.object({
    // Common fields
    directoryDefault: z.string().optional(),
    // rTorrent-specific indicators
    scgiPath: z.string().optional(),
    socketPath: z.string().optional(),
    // qBittorrent-specific indicators
    webApiUrl: z.string().optional(),
    // Transmission-specific
    rpcUrl: z.string().optional(),
}).passthrough(); // Allow additional unknown fields

export type FloodClientSettings = z.infer<typeof FloodClientSettingsSchema>;

// ============================================================================
// Rate Limit Types (from response headers, not body)
// ============================================================================

export interface FloodRateLimitInfo {
    limit: number;
    remaining: number;
    reset: number; // Unix timestamp
}

// ============================================================================
// Torrent Contents (File List)
// ============================================================================

/**
 * Individual file within a torrent
 * Response from GET /api/torrents/{hash}/contents
 */
export const FloodTorrentContentSchema = z.object({
    index: z.number(),
    path: z.string(),
    filename: z.string(),
    sizeBytes: z.number(),
    percentComplete: z.number(),
    priority: z.number(), // 0=Skip, 1=Low, 2=Normal, 3=High
});

export const FloodTorrentContentsResponseSchema = z.array(FloodTorrentContentSchema);

export type FloodTorrentContent = z.infer<typeof FloodTorrentContentSchema>;

// ============================================================================
// Capabilities (Feature Detection)
// ============================================================================

/**
 * Client feature capabilities based on backend type.
 * Used by UI to show/hide features.
 */
export interface FloodCapabilities {
    supportsSequentialDownload: boolean;
    supportsInitialSeeding: boolean;
    supportsTags: boolean;
    supportsFilePriority: boolean;
    supportsMove: boolean;
    supportsRecheck: boolean;
    backendType: 'rtorrent' | 'qbittorrent' | 'transmission' | 'unknown';
}
