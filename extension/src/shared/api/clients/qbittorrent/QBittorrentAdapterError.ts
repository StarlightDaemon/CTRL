import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { HttpError } from '@/shared/api/network/HttpError';

/**
 * Failure modes of the qBittorrent Web API v2 adapter.
 */
export type QBittorrentErrorType =
    | 'CONNECTION_REFUSED'   // Web UI unreachable
    | 'TIMEOUT'              // Request exceeded the timeout
    | 'AUTH_FAILED'          // 401/403 or "Fails." — wrong username/password
    | 'IP_BANNED'            // Too many bad logins; qBittorrent banned this IP
    | 'ENDPOINT_NOT_FOUND'   // 404 — wrong base URL / API path
    | 'SERVER_ERROR'         // 5xx — qBittorrent internal error
    | 'NETWORK_ERROR'        // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for qBittorrent. All qBittorrent-specific user-facing strings and the
 * classification of raw failures into {@link QBittorrentErrorType} live here.
 */
export class QBittorrentAdapterError extends AdapterError<QBittorrentErrorType> {
    constructor(type: QBittorrentErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach qBittorrent. Verify the host and port, and that the Web UI is enabled.';
            case 'TIMEOUT':
                return 'qBittorrent did not respond in time. The Web UI may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your qBittorrent username and password.';
            case 'IP_BANNED':
                return 'qBittorrent has temporarily banned this IP after too many failed logins. Wait, or restart qBittorrent.';
            case 'ENDPOINT_NOT_FOUND':
                return 'qBittorrent Web API not found. Verify the host, port, and that the Web UI is enabled.';
            case 'SERVER_ERROR':
                return 'qBittorrent reported a server error. The Web UI may be overloaded or misconfigured.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting qBittorrent. Check your connection.';
            default:
                return 'An unexpected qBittorrent error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a QBittorrentAdapterError.
     * Unwraps RetryExhaustedError; matches qBittorrent's message strings and HTTP status.
     */
    static from(error: unknown): QBittorrentAdapterError {
        if (error instanceof QBittorrentAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof QBittorrentAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const msg = message.toLowerCase();

        // Message-based detection (qBittorrent reports these as plain Errors).
        if (msg.includes('banned') || msg.includes('login attempts exhausted')) {
            return new QBittorrentAdapterError('IP_BANNED', message);
        }
        if (msg.includes('authentication failed') || msg.includes('unauthorized') || msg.includes('fails.')) {
            return new QBittorrentAdapterError('AUTH_FAILED', message);
        }
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return new QBittorrentAdapterError('TIMEOUT', message);
        }

        if (cause instanceof HttpError) {
            const { status } = cause;
            if (status === 401 || status === 403) return new QBittorrentAdapterError('AUTH_FAILED', message);
            if (status === 404) return new QBittorrentAdapterError('ENDPOINT_NOT_FOUND', message);
            if (status >= 500) return new QBittorrentAdapterError('SERVER_ERROR', message);
        }

        if ((cause instanceof Error && cause.name === 'TypeError') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return new QBittorrentAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new QBittorrentAdapterError('NETWORK_ERROR', message);
        }

        return new QBittorrentAdapterError('UNKNOWN', message);
    }
}
