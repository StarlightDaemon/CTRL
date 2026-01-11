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

            // Stats
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

            // Optional
            labels: z.array(z.string()).optional()
        })).optional()
    }).optional()
});

// Get the type of the torrents array element from the response
type TransmissionResponse = z.infer<typeof TransmissionResponseSchema>;
type TransmissionArguments = NonNullable<TransmissionResponse['arguments']>;
type TransmissionTorrents = NonNullable<TransmissionArguments['torrents']>;
export type TransmissionTorrent = TransmissionTorrents[number];
