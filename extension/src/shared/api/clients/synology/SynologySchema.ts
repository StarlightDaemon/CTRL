import { z } from 'zod';

/**
 * Synology Download Station API Response Schemas
 * Based on: Synology Download Station Web API v3.8
 */

// Generic Synology API response wrapper
export const SynologyResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
    z.object({
        success: z.boolean(),
        data: dataSchema.optional(),
        error: z.object({
            code: z.number(),
        }).optional(),
    });

// Auth login response
export const SynologyAuthDataSchema = z.object({
    sid: z.string(),
    synotoken: z.string().optional(),
    did: z.string().optional(), // Device ID for 2FA bypass
});

// Task status codes (numeric)
export const SynologyTaskStatus = {
    WAITING: 1,
    DOWNLOADING: 2,
    PAUSED: 3,
    FINISHING: 4,
    FINISHED: 5,
    HASH_CHECKING: 6,
    SEEDING: 7,
    FILEHOSTING_WAITING: 8,
    EXTRACTING: 9,
    ERROR: 10,
} as const;

// Task detail schema
export const SynologyTaskDetailSchema = z.object({
    destination: z.string().optional(),
    uri: z.string().optional(),
    create_time: z.number().optional(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
    total_peers: z.number().optional(),
    connected_peers: z.number().optional(),
});

// Task transfer schema
export const SynologyTaskTransferSchema = z.object({
    size_downloaded: z.number(),
    size_uploaded: z.number(),
    speed_download: z.number(),
    speed_upload: z.number(),
});

// Individual task schema
export const SynologyTaskSchema = z.object({
    id: z.string(),
    type: z.enum(['bt', 'http', 'ftp', 'nzb', 'emule']),
    username: z.string(),
    title: z.string(),
    size: z.number(),
    status: z.number(),
    status_extra: z.object({
        error_detail: z.string().optional(),
        unzip_progress: z.number().optional(),
    }).optional(),
    additional: z.object({
        detail: SynologyTaskDetailSchema.optional(),
        transfer: SynologyTaskTransferSchema.optional(),
        file: z.array(z.object({
            filename: z.string(),
            size: z.number(),
            size_downloaded: z.number(),
            priority: z.enum(['skip', 'low', 'normal', 'high']),
        })).optional(),
        tracker: z.array(z.object({
            url: z.string(),
            status: z.string(),
            update_timer: z.number(),
            seeds: z.number(),
            peers: z.number(),
        })).optional(),
    }).optional(),
});

// Task list response
export const SynologyTaskListSchema = z.object({
    total: z.number(),
    offset: z.number(),
    tasks: z.array(SynologyTaskSchema),
});

// API Info response for discovery
export const SynologyAPIInfoSchema = z.record(z.object({
    path: z.string(),
    minVersion: z.number(),
    maxVersion: z.number(),
}));

// Statistics response
export const SynologyStatisticSchema = z.object({
    speed_download: z.number(),
    speed_upload: z.number(),
});

// Config/Info response
export const SynologyInfoSchema = z.object({
    is_manager: z.boolean().optional(),
    version: z.number().optional(),
    version_string: z.string().optional(),
});

// Export types
export type SynologyAuthData = z.infer<typeof SynologyAuthDataSchema>;
export type SynologyTask = z.infer<typeof SynologyTaskSchema>;
export type SynologyTaskList = z.infer<typeof SynologyTaskListSchema>;
export type SynologyAPIInfo = z.infer<typeof SynologyAPIInfoSchema>;
