import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';

/**
 * Failure modes of the Deluge Web JSON-RPC adapter.
 */
export type DelugeErrorType =
    | 'CONNECTION_REFUSED'   // Web UI unreachable
    | 'TIMEOUT'              // Request exceeded the timeout
    | 'AUTH_FAILED'          // Wrong Web UI password (code 1 / login returned false)
    | 'AUTH_LEVEL_LOW'       // Authenticated but insufficient privilege (code 5)
    | 'DAEMON_OFFLINE'       // Web UI reachable but no daemon connected/online
    | 'METHOD_NOT_FOUND'     // Unknown RPC method (code 2)
    | 'INTERNAL_ERROR'       // Daemon internal error (code 3)
    | 'RPC_FAILED'           // Generic RPC failure (code 4)
    | 'NETWORK_ERROR'        // General network failure
    | 'UNKNOWN';

/**
 * Adapter error for Deluge. All Deluge-specific user-facing strings and the
 * classification of raw failures into {@link DelugeErrorType} live here.
 */
export class DelugeAdapterError extends AdapterError<DelugeErrorType> {
    constructor(type: DelugeErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach the Deluge Web UI. Verify the host and port, and that deluge-web is running.';
            case 'TIMEOUT':
                return 'Deluge did not respond in time. The Web UI or daemon may be busy or unreachable.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your Deluge Web UI password.';
            case 'AUTH_LEVEL_LOW':
                return 'Your Deluge account does not have permission for this action.';
            case 'DAEMON_OFFLINE':
                return 'The Deluge Web UI is up but no daemon is connected. Start the daemon or connect a host.';
            case 'METHOD_NOT_FOUND':
                return 'This action is not supported by the connected Deluge daemon.';
            case 'INTERNAL_ERROR':
                return 'The Deluge daemon reported an internal error.';
            case 'RPC_FAILED':
                return 'Deluge rejected the request. The operation could not be completed.';
            case 'NETWORK_ERROR':
                return 'A network error occurred while contacting Deluge. Check your connection.';
            default:
                return 'An unexpected Deluge error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a DelugeAdapterError.
     * Unwraps RetryExhaustedError and reads the Deluge RPC error code when present.
     */
    static from(error: unknown): DelugeAdapterError {
        if (error instanceof DelugeAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof DelugeAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const code = (cause as { code?: unknown })?.code;

        // Deluge JSON-RPC error codes (NOT_AUTHENTICATED=1 … AUTH_LEVEL_LOW=5)
        if (typeof code === 'number') {
            switch (code) {
                case 1: return new DelugeAdapterError('AUTH_FAILED', message);
                case 2: return new DelugeAdapterError('METHOD_NOT_FOUND', message);
                case 3: return new DelugeAdapterError('INTERNAL_ERROR', message);
                case 4: return new DelugeAdapterError('RPC_FAILED', message);
                case 5: return new DelugeAdapterError('AUTH_LEVEL_LOW', message);
            }
        }

        const msg = message.toLowerCase();
        if (msg.includes('authentication failed') || msg.includes('not authenticated')) {
            return new DelugeAdapterError('AUTH_FAILED', message);
        }
        if (msg.includes('no deluge daemons') || msg.includes('daemon is offline')) {
            return new DelugeAdapterError('DAEMON_OFFLINE', message);
        }
        if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
            return new DelugeAdapterError('TIMEOUT', message);
        }
        if ((cause instanceof Error && cause.name === 'TypeError') || msg.includes('failed to fetch') || msg.includes('econnrefused')) {
            return new DelugeAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new DelugeAdapterError('NETWORK_ERROR', message);
        }

        return new DelugeAdapterError('UNKNOWN', message);
    }
}
