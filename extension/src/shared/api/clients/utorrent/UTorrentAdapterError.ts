import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { HttpError } from '@/shared/api/network/HttpError';

/**
 * Failure modes of the uTorrent (Web UI) adapter.
 */
export type UTorrentErrorType =
    | 'CONNECTION_REFUSED'   // Web UI unreachable
    | 'TIMEOUT'              // Request exceeded the timeout
    | 'AUTH_FAILED'          // 400/401 — wrong credentials or rejected handshake
    | 'TOKEN_ERROR'          // Could not extract the session token from token.html
    | 'ENDPOINT_NOT_FOUND'   // 404 — wrong host/port or Web UI disabled
    | 'NETWORK_ERROR'        // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for uTorrent. All uTorrent-specific user-facing strings and the
 * classification of raw failures into {@link UTorrentErrorType} live here.
 */
export class UTorrentAdapterError extends AdapterError<UTorrentErrorType> {
    constructor(type: UTorrentErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach uTorrent. Verify the host and port, and that the Web UI is enabled.';
            case 'TIMEOUT':
                return 'uTorrent did not respond in time. The Web UI may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your uTorrent username and password, and that the Web UI is enabled.';
            case 'TOKEN_ERROR':
                return 'Could not complete the uTorrent token handshake. Ensure the Web UI is enabled and reachable.';
            case 'ENDPOINT_NOT_FOUND':
                return 'uTorrent Web UI not found. Verify the host, port, and that the Web UI is enabled.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting uTorrent. Check your connection.';
            default:
                return 'An unexpected uTorrent error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a UTorrentAdapterError.
     * Unwraps RetryExhaustedError; recognizes the token-handshake failure and HTTP status.
     */
    static from(error: unknown): UTorrentAdapterError {
        if (error instanceof UTorrentAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof UTorrentAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const msg = message.toLowerCase();

        if (cause instanceof HttpError) {
            const { status } = cause;
            if (status === 400 || status === 401 || status === 403) return new UTorrentAdapterError('AUTH_FAILED', message);
            if (status === 404) return new UTorrentAdapterError('ENDPOINT_NOT_FOUND', message);
        }

        if (msg.includes('token')) return new UTorrentAdapterError('TOKEN_ERROR', message);
        if (msg.includes('unauthorized')) return new UTorrentAdapterError('AUTH_FAILED', message);
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return new UTorrentAdapterError('TIMEOUT', message);
        }
        if ((cause instanceof Error && cause.name === 'TypeError') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return new UTorrentAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new UTorrentAdapterError('NETWORK_ERROR', message);
        }

        return new UTorrentAdapterError('UNKNOWN', message);
    }
}
