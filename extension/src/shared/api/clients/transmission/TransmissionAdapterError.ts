import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { HttpError } from '@/shared/api/network/HttpError';
import {
    AuthenticationError,
    WhitelistError,
    DaemonError,
    RpcError,
    DuplicateTorrentError,
} from './TransmissionErrors';

/**
 * Failure modes of the Transmission RPC adapter (also used for Vuze, which speaks
 * Transmission RPC and inherits this adapter).
 */
export type TransmissionErrorType =
    | 'CONNECTION_REFUSED'   // Daemon unreachable (host/port wrong, not running)
    | 'TIMEOUT'              // Request exceeded the timeout
    | 'AUTH_FAILED'          // 401 — wrong username/password
    | 'WHITELIST_BLOCKED'    // 403 — host not in rpc-host-whitelist
    | 'HANDSHAKE_FAILED'     // 409 session handshake could not complete
    | 'ENDPOINT_NOT_FOUND'   // 404/3xx — wrong RPC URL or port
    | 'DAEMON_ERROR'         // 5xx — daemon overloaded or crashed
    | 'RPC_ERROR'            // result !== 'success'
    | 'DUPLICATE_TORRENT'    // torrent already present
    | 'NETWORK_ERROR'        // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for Transmission. All Transmission-specific user-facing strings and
 * the classification of raw failures into {@link TransmissionErrorType} live here.
 */
export class TransmissionAdapterError extends AdapterError<TransmissionErrorType> {
    constructor(type: TransmissionErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach Transmission. Verify the host and port, and that the daemon is running.';
            case 'TIMEOUT':
                return 'Transmission did not respond in time. The daemon may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your Transmission username and password.';
            case 'WHITELIST_BLOCKED':
                return 'Transmission refused this host. Add it to rpc-host-whitelist in the daemon settings.';
            case 'HANDSHAKE_FAILED':
                return 'Transmission handshake failed. Verify that RPC is enabled and reachable.';
            case 'ENDPOINT_NOT_FOUND':
                return 'Transmission RPC endpoint not found. Verify the RPC URL (expected /transmission/rpc) and port.';
            case 'DAEMON_ERROR':
                return 'Transmission reported a server error. The daemon may be overloaded or have crashed.';
            case 'RPC_ERROR':
                return 'Transmission rejected the request. The operation could not be completed.';
            case 'DUPLICATE_TORRENT':
                return 'That torrent is already present in Transmission.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting Transmission. Check your connection.';
            default:
                return 'An unexpected Transmission error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a TransmissionAdapterError.
     * Unwraps RetryExhaustedError so the underlying cause is classified.
     */
    static from(error: unknown): TransmissionAdapterError {
        if (error instanceof TransmissionAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof TransmissionAdapterError) return cause;

        if (cause instanceof AuthenticationError) return new TransmissionAdapterError('AUTH_FAILED', cause.message);
        if (cause instanceof WhitelistError) return new TransmissionAdapterError('WHITELIST_BLOCKED', cause.message);
        if (cause instanceof DaemonError) return new TransmissionAdapterError('DAEMON_ERROR', cause.message);
        if (cause instanceof DuplicateTorrentError) return new TransmissionAdapterError('DUPLICATE_TORRENT', cause.message);
        if (cause instanceof RpcError) return new TransmissionAdapterError('RPC_ERROR', cause.message);

        if (cause instanceof HttpError) {
            const { status } = cause;
            if (status === 401) return new TransmissionAdapterError('AUTH_FAILED', cause.message);
            if (status === 403) return new TransmissionAdapterError('WHITELIST_BLOCKED', cause.message);
            if (status === 409) return new TransmissionAdapterError('HANDSHAKE_FAILED', cause.message);
            if (status === 404 || (status >= 300 && status < 400)) {
                return new TransmissionAdapterError('ENDPOINT_NOT_FOUND', cause.message);
            }
            if (status >= 500) return new TransmissionAdapterError('DAEMON_ERROR', cause.message);
        }

        if (cause instanceof Error) {
            const msg = cause.message.toLowerCase();
            if (msg.includes('handshake')) return new TransmissionAdapterError('HANDSHAKE_FAILED', cause.message);
            if (msg.includes('endpoint not found') || msg.includes('rpc endpoint')) {
                return new TransmissionAdapterError('ENDPOINT_NOT_FOUND', cause.message);
            }
            if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted')) {
                return new TransmissionAdapterError('TIMEOUT', cause.message);
            }
            if (cause.name === 'TypeError' || msg.includes('cannot reach') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
                return new TransmissionAdapterError('CONNECTION_REFUSED', cause.message);
            }
            if (msg.includes('network')) return new TransmissionAdapterError('NETWORK_ERROR', cause.message);
            return new TransmissionAdapterError('UNKNOWN', cause.message);
        }

        return new TransmissionAdapterError('UNKNOWN', String(cause));
    }
}
