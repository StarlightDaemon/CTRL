import { z } from 'zod';

/**
 * BiglyBT-specific RPC Schema Extensions
 * 
 * BiglyBT exposes the standard Transmission RPC via the xmwebui plugin,
 * but injects additional fields and methods for advanced features.
 */

// =============================================================================
// Session Response Extensions
// =============================================================================

/**
 * Extended session-get response from BiglyBT
 * Contains standard Transmission fields plus BiglyBT-specific metadata
 */
export const BiglyBTSessionSchema = z.object({
    result: z.string(),
    arguments: z.object({
        // Standard Transmission fields
        'version': z.string().optional(),
        'rpc-version': z.number().optional(),

        // BiglyBT-specific fields (detection triggers)
        'biglybt-version': z.string().optional(),
        'az-rpc-version': z.string().optional(),

        // Network availability indicators
        'rpc-i2p-address': z.string().optional(),
        'rpc-tor-address': z.string().optional(),

        // Dynamic capability array (lists available methods)
        'rpc-supports': z.array(z.string()).optional(),
    }).passthrough() // Allow additional unknown fields
});

export type BiglyBTSessionResponse = z.infer<typeof BiglyBTSessionSchema>;

// =============================================================================
// Tag System
// =============================================================================

/**
 * BiglyBT Tag object from tags-get-list response
 */
export const BiglyBTTagSchema = z.object({
    uid: z.number(),
    name: z.string(),
    type: z.number(), // 1 = Manual, 2 = Automatic/System
    count: z.number()
});

export type BiglyBTTag = z.infer<typeof BiglyBTTagSchema>;

/**
 * Response from tags-get-list RPC method
 */
export const BiglyBTTagListResponseSchema = z.object({
    result: z.string(),
    arguments: z.object({
        tags: z.array(BiglyBTTagSchema).optional()
    }).optional()
});

export type BiglyBTTagListResponse = z.infer<typeof BiglyBTTagListResponseSchema>;

// =============================================================================
// Extended Torrent Schema
// =============================================================================

/**
 * BiglyBT-extended torrent fields for torrent-get response
 * These are additional fields beyond standard Transmission
 */
export const BiglyBTTorrentExtensionSchema = z.object({
    // Swarm Merging telemetry
    'swarm-merge-bytes': z.number().optional(),

    // Alternative field name used in some versions
    'swarm-bytes': z.number().optional(),

    // File hash code for change detection (optimization)
    // Field name includes torrent ID: files-hc-<id>
});

/**
 * Complete torrent response including BiglyBT extensions
 */
export const BiglyBTTorrentSchema = z.object({
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

    // Standard optional
    labels: z.array(z.string()).optional(),

    // BiglyBT extensions - Swarm Merging
    'swarm-merge-bytes': z.number().optional(),
    'swarm-bytes': z.number().optional(),

    // BiglyBT extensions - Force Start state
    isForced: z.boolean().optional(),

    // BiglyBT extensions - Per-torrent speed limits
    uploadLimit: z.number().optional(),
    uploadLimited: z.boolean().optional(),
    downloadLimit: z.number().optional(),
    downloadLimited: z.boolean().optional(),

    // BiglyBT extensions - Queue position
    queuePosition: z.number().optional(),

    // Torrent creation date (distinct from addedDate)
    dateCreated: z.number().optional(),
}).passthrough(); // Allow additional fields like trackerStats for network inference

export type BiglyBTTorrent = z.infer<typeof BiglyBTTorrentSchema>;

/**
 * BiglyBT torrent-get response wrapper
 */
export const BiglyBTTorrentResponseSchema = z.object({
    result: z.string(),
    arguments: z.object({
        torrents: z.array(BiglyBTTorrentSchema).optional()
    }).optional()
});

export type BiglyBTTorrentResponse = z.infer<typeof BiglyBTTorrentResponseSchema>;

// =============================================================================
// Capability Detection Helper
// =============================================================================

/**
 * Extracted capabilities from session response
 */
export interface BiglyBTCapabilities {
    isBiglyBT: boolean;
    version: string | null;
    pluginVersion: string | null;
    i2pAvailable: boolean;
    i2pAddress: string | null;
    torAvailable: boolean;
    torAddress: string | null;
    // Phase 2: Dynamic capability detection
    supportedMethods: string[];
    supportsForceStart: boolean;
    supportsTagsList: boolean;
}

/**
 * Parse session response and extract BiglyBT capabilities
 */
export function extractCapabilities(session: BiglyBTSessionResponse): BiglyBTCapabilities {
    const args = session.arguments;
    const biglyVersion = args['biglybt-version'];
    const supportedMethods = (args as Record<string, unknown>)['rpc-supports'] as string[] || [];

    return {
        isBiglyBT: !!biglyVersion,
        version: biglyVersion || null,
        pluginVersion: args['az-rpc-version'] || null,
        i2pAvailable: !!args['rpc-i2p-address'],
        i2pAddress: args['rpc-i2p-address'] || null,
        torAvailable: !!args['rpc-tor-address'],
        torAddress: args['rpc-tor-address'] || null,
        // Parse rpc-supports for method availability
        supportedMethods,
        supportsForceStart: supportedMethods.includes('method:torrent-start-now'),
        supportsTagsList: supportedMethods.includes('method:tags-get-list'),
    };
}

// =============================================================================
// Error Handling Utilities
// =============================================================================

/**
 * Maximum length for error messages (truncates Java stack traces)
 */
export const MAX_ERROR_LENGTH = 100;

/**
 * Truncate error message, handling Java stack traces gracefully
 */
export function truncateError(message: string): string {
    if (message.length <= MAX_ERROR_LENGTH) {
        return message;
    }

    // Check if it looks like a Java stack trace
    const isStackTrace = message.includes('Exception') ||
        message.includes('at ') ||
        message.includes('.java:');

    const truncated = message.substring(0, MAX_ERROR_LENGTH - 3) + '...';

    if (isStackTrace) {
        // Try to extract just the exception type/message
        const exceptionMatch = message.match(/^([A-Za-z.]+Exception:?\s*[^\n]*)/);
        if (exceptionMatch && exceptionMatch[1].length <= MAX_ERROR_LENGTH) {
            return exceptionMatch[1];
        }
    }

    return truncated;
}

// =============================================================================
// Network Inference (Phase 3)
// =============================================================================

/**
 * Inferred network status for a torrent based on tracker analysis
 */
export interface TorrentNetworkStatus {
    /** Torrent is using public trackers */
    isPublic: boolean;
    /** Torrent is using I2P network */
    isI2P: boolean;
    /** Torrent is using Tor network */
    isTor: boolean;
    /** Mixed mode warning - using both public and anonymous networks */
    isMixedMode: boolean;
    /** Tracker URLs that matched each network */
    publicTrackers: string[];
    i2pTrackers: string[];
    torTrackers: string[];
}

/**
 * Infer network status from tracker announce URLs
 * 
 * BiglyBT does not expose a direct 'networks' field in torrent-get.
 * Network status must be inferred from tracker URLs:
 * - .i2p addresses indicate I2P network
 * - .onion addresses indicate Tor network  
 * - Standard http/https/udp indicate Public network
 * 
 * @param trackerUrls - Array of tracker announce URLs
 * @returns Network status object
 */
export function inferNetworkFromTrackers(trackerUrls: string[]): TorrentNetworkStatus {
    const publicTrackers: string[] = [];
    const i2pTrackers: string[] = [];
    const torTrackers: string[] = [];

    for (const url of trackerUrls) {
        const lowerUrl = url.toLowerCase();

        if (lowerUrl.includes('.i2p')) {
            i2pTrackers.push(url);
        } else if (lowerUrl.includes('.onion')) {
            torTrackers.push(url);
        } else if (
            lowerUrl.startsWith('http://') ||
            lowerUrl.startsWith('https://') ||
            lowerUrl.startsWith('udp://')
        ) {
            publicTrackers.push(url);
        }
    }

    const isPublic = publicTrackers.length > 0;
    const isI2P = i2pTrackers.length > 0;
    const isTor = torTrackers.length > 0;

    // Mixed mode: using public AND anonymous networks simultaneously
    // This is a privacy risk as metadata can leak
    const isMixedMode = isPublic && (isI2P || isTor);

    return {
        isPublic,
        isI2P,
        isTor,
        isMixedMode,
        publicTrackers,
        i2pTrackers,
        torTrackers,
    };
}

/**
 * Get a human-readable network mode string
 */
export function getNetworkModeLabel(status: TorrentNetworkStatus): string {
    const modes: string[] = [];

    if (status.isI2P) modes.push('I2P');
    if (status.isTor) modes.push('Tor');
    if (status.isPublic) modes.push('Public');

    if (modes.length === 0) return 'Unknown';
    if (status.isMixedMode) return `Mixed (${modes.join(' + ')})`;
    return modes.join(' + ');
}

// =============================================================================
// Simple API Types (Port 6906)
// =============================================================================

/**
 * Network types available in BiglyBT for routing control
 * - Public: Standard internet (default)
 * - I2P: Anonymous I2P network
 * - Tor: Tor network routing
 */
export type BiglyBTNetwork = 'Public' | 'I2P' | 'Tor';

/**
 * Peer source types for controlling how peers are discovered
 */
export type BiglyBTPeerSource =
    | 'Tracker'      // Torrent trackers
    | 'DHT'          // Distributed Hash Table
    | 'PeerExchange' // PEX protocol
    | 'Plugin'       // Plugin-provided peers
    | 'Incoming';    // Accept incoming connections

/**
 * Simple API configuration stored in ServerConfig.clientOptions
 * 
 * Required for I2P/Tor network control features.
 * Users must copy the API key from BiglyBT:
 * Tools > Options > Plugins > Simple API
 */
export interface SimpleApiConfig {
    /** Port for Simple API (default: 6906) */
    port: number;
    /** API key from BiglyBT Simple API plugin settings */
    apiKey: string;
}

/**
 * Parse Simple API configuration from clientOptions
 */
export function parseSimpleApiConfig(
    clientOptions: Record<string, unknown>
): SimpleApiConfig | null {
    const port = clientOptions?.simpleApiPort;
    const key = clientOptions?.simpleApiKey;

    if (port && key) {
        return {
            port: Number(port),
            apiKey: String(key)
        };
    }
    return null;
}

/**
 * Build Simple API URL with method and parameters
 */
export function buildSimpleApiUrl(
    hostname: string,
    config: SimpleApiConfig,
    method: string,
    params: Record<string, string>
): string {
    // Extract base host without path
    const url = new URL(hostname);
    const baseHost = `${url.protocol}//${url.hostname}:${config.port}`;

    // Build query string
    const queryParams = new URLSearchParams({
        apikey: config.apiKey,
        method,
        ...params
    });

    return `${baseHost}/?${queryParams.toString()}`;
}

// =============================================================================
// Timeout Configuration
// =============================================================================

/**
 * BiglyBT-specific timeout values
 * 
 * BiglyBT runs on JVM which can have GC pauses, so we use longer
 * timeouts than typical Transmission clients.
 */
export interface BiglyBTTimeouts {
    /** Initial handshake timeout (ms) - fast fail for wrong IP */
    handshake: number;
    /** Standard RPC polling timeout (ms) - tolerates JVM GC */
    poll: number;
    /** Add torrent timeout (ms) - magnet resolution can be slow */
    addTorrent: number;
    /** Simple API timeout (ms) - lightweight GET requests */
    simpleApi: number;
}

/**
 * Default timeout values based on research recommendations
 */
export const DEFAULT_TIMEOUTS: BiglyBTTimeouts = {
    handshake: 5000,   // 5s - fast fail if IP is wrong
    poll: 10000,       // 10s - JVM GC tolerance
    addTorrent: 30000, // 30s - magnet resolution
    simpleApi: 5000,   // 5s - lightweight GET
};

// =============================================================================
// Error Classification
// =============================================================================

/**
 * BiglyBT error types for user-friendly messaging
 */
export type BiglyBTErrorType =
    | 'CONNECTION_REFUSED'    // BiglyBT not running or wrong IP
    | 'TIMEOUT'               // JVM GC pause or slow response
    | 'AUTH_FAILED'           // Wrong username/password
    | 'SESSION_EXPIRED'       // Session ID no longer valid
    | 'PLUGIN_MISSING'        // xmwebui or Simple API not installed
    | 'METHOD_NOT_FOUND'      // RPC method not supported
    | 'NETWORK_ERROR'         // General network failure
    | 'RPC_ERROR'             // BiglyBT returned an error result
    | 'UNKNOWN';

/**
 * Classify an error into a BiglyBTErrorType for user messaging
 */
export function classifyError(error: unknown): BiglyBTErrorType {
    if (error instanceof Error) {
        const msg = error.message.toLowerCase();

        // Connection issues
        if (msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return 'CONNECTION_REFUSED';
        }
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return 'TIMEOUT';
        }

        // Auth issues
        if (msg.includes('401') || msg.includes('unauthorized')) {
            return 'AUTH_FAILED';
        }
        if (msg.includes('409') || msg.includes('session')) {
            return 'SESSION_EXPIRED';
        }

        // Plugin issues
        // PLUGIN_MISSING: the xmwebui (or Simple API) plugin is not installed, so the
        // RPC endpoint itself is absent — typically a 404 on /transmission/rpc.
        if (msg.includes('plugin') || msg.includes('xmwebui') || msg.includes('404')) {
            return 'PLUGIN_MISSING';
        }
        if (msg.includes('method not found') || msg.includes('not supported')) {
            return 'METHOD_NOT_FOUND';
        }

        // RPC errors
        if (msg.includes('rpc error') || msg.includes('exception')) {
            return 'RPC_ERROR';
        }

        // Network errors
        if (msg.includes('network') || msg.includes('fetch')) {
            return 'NETWORK_ERROR';
        }
    }

    return 'UNKNOWN';
}

/**
 * Get user-friendly error message for a BiglyBTErrorType
 */
export function getErrorMessage(type: BiglyBTErrorType): string {
    switch (type) {
        case 'CONNECTION_REFUSED':
            return 'Cannot connect to BiglyBT. Ensure the client is running and the xmwebui plugin is enabled.';
        case 'TIMEOUT':
            return 'BiglyBT is not responding. The client may be busy or experiencing high load.';
        case 'AUTH_FAILED':
            return 'Authentication failed. Check your username and password in BiglyBT remote settings.';
        case 'SESSION_EXPIRED':
            return 'Session expired. Reconnecting...';
        case 'PLUGIN_MISSING':
            return 'Required plugin not installed. Ensure xmwebui is installed in BiglyBT.';
        case 'METHOD_NOT_FOUND':
            return 'This feature is not supported by your BiglyBT version.';
        case 'NETWORK_ERROR':
            return 'Network error. Check your connection to the BiglyBT server.';
        case 'RPC_ERROR':
            return 'BiglyBT reported an error processing the request.';
        default:
            return 'An unexpected error occurred.';
    }
}

// =============================================================================
// Retry Utilities
// =============================================================================

// RetryConfig, DEFAULT_RETRY_CONFIG, calculateBackoffDelay, and sleep now live in
// the shared adapter infrastructure as the canonical definitions. They are
// re-exported here so existing BiglyBT importers keep their import paths unchanged.
export type { RetryConfig } from '@/shared/lib/retry/withAdapterRetry';
export {
    DEFAULT_RETRY_CONFIG,
    calculateBackoffDelay,
    sleep,
} from '@/shared/lib/retry/withAdapterRetry';

