import { z } from 'zod';

/**
 * Transmission RPC Response Wrapper
 */
export const TransmissionResponseSchema = z.object({
    result: z.string(), // "success" or error string
    arguments: z.object({
        torrents: z.array(z.object({
            id: z.number(),
            name: z.string(),
            status: z.number(),

            // Size & Progress
            totalSize: z.number(),
            percentDone: z.number(),
            rateDownload: z.number(),
            rateUpload: z.number(),
            eta: z.number(),

            // Metadata
            downloadDir: z.string(),
            addedDate: z.number(),
            error: z.number(),
            errorString: z.string(),

            // Phase 1.4: Critical metadata extensions
            // Queue management (Phase 2.1)
            queuePosition: z.number().optional(),
            bandwidthPriority: z.number().optional(), // -1 (Low), 0 (Normal), 1 (High)

            // Persistent identifier (better than ephemeral id)
            hashString: z.string().optional(),

            // Statistics
            uploadRatio: z.number().optional(),
            uploadedEver: z.number().optional(),
            downloadedEver: z.number().optional(),

            // Verification (Phase 2.3)
            recheckProgress: z.number().optional(), // 0.0-1.0 while status=2 (checking)

            // Optional features
            labels: z.array(z.string()).optional()
        })).optional(),

        // Phase 3.1: recently-active response includes removed torrent IDs
        removed: z.array(z.number()).optional()
    }).optional()
});

// Get the type of the torrents array element from the response
type TransmissionResponse = z.infer<typeof TransmissionResponseSchema>;
type TransmissionArguments = NonNullable<TransmissionResponse['arguments']>;
type TransmissionTorrents = NonNullable<TransmissionArguments['torrents']>;
export type TransmissionTorrent = TransmissionTorrents[number];
