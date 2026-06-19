import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { HttpError } from '@/shared/api/network/HttpError';

/**
 * Failure modes of the Flood adapter.
 */
export type FloodErrorType =
    | 'CONNECTION_REFUSED'     // Flood server unreachable
    | 'TIMEOUT'                // Request exceeded the timeout
    | 'AUTH_FAILED'            // 401/403 — wrong Flood username/password
    | 'RATE_LIMITED'           // 429 — too many requests
    | 'BACKEND_DISCONNECTED'   // Flood up but its torrent daemon is not connected
    | 'VALIDATION_ERROR'       // Flood rejected the request payload
    | 'NETWORK_ERROR'          // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for Flood. All Flood-specific user-facing strings and the
 * classification of raw failures into {@link FloodErrorType} live here.
 *
 * Flood's bespoke error classes (FloodAuthError, …) live in FloodAdapter.ts, so they
 * are matched here by their `name` to avoid a circular import.
 */
export class FloodAdapterError extends AdapterError<FloodErrorType> {
    constructor(type: FloodErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach Flood. Verify the host and port, and that the Flood server is running.';
            case 'TIMEOUT':
                return 'Flood did not respond in time. The server or its backend may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your Flood username and password.';
            case 'RATE_LIMITED':
                return 'Flood is rate-limiting requests. Wait a moment and try again.';
            case 'BACKEND_DISCONNECTED':
                return 'Flood is running but not connected to its torrent client. Check the Flood backend configuration.';
            case 'VALIDATION_ERROR':
                return 'Flood rejected the request. The parameters were not accepted.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting Flood. Check your connection.';
            default:
                return 'An unexpected Flood error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a FloodAdapterError.
     * Unwraps RetryExhaustedError and matches Flood's bespoke errors by name.
     */
    static from(error: unknown): FloodAdapterError {
        if (error instanceof FloodAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof FloodAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const name = cause instanceof Error ? cause.name : '';

        switch (name) {
            case 'FloodAuthError': return new FloodAdapterError('AUTH_FAILED', message);
            case 'FloodRateLimitError': return new FloodAdapterError('RATE_LIMITED', message);
            case 'FloodBackendDisconnectedError': return new FloodAdapterError('BACKEND_DISCONNECTED', message);
            case 'FloodValidationError': return new FloodAdapterError('VALIDATION_ERROR', message);
            case 'FloodTimeoutError': return new FloodAdapterError('TIMEOUT', message);
        }

        if (cause instanceof HttpError) {
            if (cause.status === 401 || cause.status === 403) return new FloodAdapterError('AUTH_FAILED', message);
            if (cause.status === 429) return new FloodAdapterError('RATE_LIMITED', message);
        }

        const msg = message.toLowerCase();
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return new FloodAdapterError('TIMEOUT', message);
        }
        if (msg.includes('not connected') || msg.includes('backend is not')) {
            return new FloodAdapterError('BACKEND_DISCONNECTED', message);
        }
        if (name === 'TypeError' || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return new FloodAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new FloodAdapterError('NETWORK_ERROR', message);
        }

        return new FloodAdapterError('UNKNOWN', message);
    }
}
