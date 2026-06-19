import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { HttpError } from '@/shared/api/network/HttpError';

/**
 * Failure modes of the ruTorrent / rTorrent XML-RPC adapter.
 */
export type RuTorrentErrorType =
    | 'CONNECTION_REFUSED'   // RPC endpoint unreachable
    | 'TIMEOUT'              // Request exceeded the timeout
    | 'AUTH_FAILED'          // 401 — wrong HTTP Basic Auth credentials
    | 'FORBIDDEN'            // 403 — access denied to the RPC endpoint
    | 'ENDPOINT_NOT_FOUND'   // 404 — wrong RPC path (httprpc/action.php or /RPC2)
    | 'RPC_FAULT'            // rTorrent returned an XML-RPC fault
    | 'NETWORK_ERROR'        // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for ruTorrent. All ruTorrent-specific user-facing strings and the
 * classification of raw failures into {@link RuTorrentErrorType} live here.
 */
export class RuTorrentAdapterError extends AdapterError<RuTorrentErrorType> {
    constructor(type: RuTorrentErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach ruTorrent. Verify the host, port, and RPC path, and that the server is running.';
            case 'TIMEOUT':
                return 'ruTorrent did not respond in time. The server may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your ruTorrent username and password.';
            case 'FORBIDDEN':
                return 'Access to the ruTorrent RPC endpoint was denied. Check the server permissions.';
            case 'ENDPOINT_NOT_FOUND':
                return 'ruTorrent RPC endpoint not found. Verify the RPC path (e.g. /plugins/httprpc/action.php or /RPC2).';
            case 'RPC_FAULT':
                return 'rTorrent rejected the request (XML-RPC fault). The method may be unavailable or disabled.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting ruTorrent. Check your connection.';
            default:
                return 'An unexpected ruTorrent error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a RuTorrentAdapterError.
     * Unwraps RetryExhaustedError; recognizes rTorrent faults and HTTP status.
     */
    static from(error: unknown): RuTorrentAdapterError {
        if (error instanceof RuTorrentAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof RuTorrentAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const msg = message.toLowerCase();

        if (msg.includes('rtorrent fault') || msg.includes('faultstring')) {
            return new RuTorrentAdapterError('RPC_FAULT', message);
        }

        if (cause instanceof HttpError) {
            const { status } = cause;
            if (status === 401) return new RuTorrentAdapterError('AUTH_FAILED', message);
            if (status === 403) return new RuTorrentAdapterError('FORBIDDEN', message);
            if (status === 404) return new RuTorrentAdapterError('ENDPOINT_NOT_FOUND', message);
        }

        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return new RuTorrentAdapterError('TIMEOUT', message);
        }
        if ((cause instanceof Error && cause.name === 'TypeError') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return new RuTorrentAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new RuTorrentAdapterError('NETWORK_ERROR', message);
        }

        return new RuTorrentAdapterError('UNKNOWN', message);
    }
}
