import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { Aria2Error } from './Aria2Error';

/**
 * Failure modes of the Aria2 JSON-RPC adapter. Mirrors the {@link Aria2Error} code
 * taxonomy so a classified Aria2Error maps straight onto a discriminant.
 */
export type Aria2ErrorType =
    | 'PARSE_ERROR'         // -32700: invalid JSON
    | 'INVALID_REQUEST'     // -32600: malformed JSON-RPC request
    | 'METHOD_NOT_FOUND'    // -32601: unknown method
    | 'INVALID_PARAMS'      // -32602: bad params (often auth)
    | 'UNAUTHORIZED'        // wrong / missing RPC secret
    | 'GID_NOT_FOUND'       // download GID does not exist
    | 'FILE_SYSTEM_ERROR'   // 18: permissions / disk space
    | 'NETWORK_ERROR'       // connection failure
    | 'TIMEOUT'             // request timed out
    | 'UNKNOWN';

/**
 * Adapter error for Aria2. All Aria2-specific user-facing strings and the
 * classification of raw failures into {@link Aria2ErrorType} live here.
 */
export class Aria2AdapterError extends AdapterError<Aria2ErrorType> {
    constructor(type: Aria2ErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'PARSE_ERROR':
                return 'Aria2 returned an invalid response. The endpoint may not be an Aria2 JSON-RPC server.';
            case 'INVALID_REQUEST':
                return 'Aria2 rejected the request as malformed.';
            case 'METHOD_NOT_FOUND':
                return 'This action is not supported by the Aria2 daemon.';
            case 'INVALID_PARAMS':
                return 'Aria2 rejected the request parameters. Check the RPC secret token.';
            case 'UNAUTHORIZED':
                return 'Authentication failed. Check the Aria2 RPC secret token.';
            case 'GID_NOT_FOUND':
                return 'That download was not found in Aria2.';
            case 'FILE_SYSTEM_ERROR':
                return 'Aria2 reported a file-system error. Check permissions and available disk space.';
            case 'NETWORK_ERROR':
                return 'Cannot reach the Aria2 daemon. Verify the host, port, and that aria2c --enable-rpc is running.';
            case 'TIMEOUT':
                return 'Aria2 did not respond in time. The daemon may be busy or unreachable.';
            default:
                return 'An unexpected Aria2 error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into an Aria2AdapterError.
     * Unwraps RetryExhaustedError and reuses Aria2Error's code taxonomy.
     */
    static from(error: unknown): Aria2AdapterError {
        if (error instanceof Aria2AdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof Aria2AdapterError) return cause;

        if (cause instanceof Aria2Error) {
            return new Aria2AdapterError(cause.code, cause.message);
        }

        if (cause instanceof Error) {
            const msg = cause.message.toLowerCase();
            if (msg.includes('timeout') || msg.includes('timed out') || cause.name === 'AbortError') {
                return new Aria2AdapterError('TIMEOUT', cause.message);
            }
            if (cause.name === 'TypeError' || msg.includes('fetch') || msg.includes('network') || msg.includes('econnrefused')) {
                return new Aria2AdapterError('NETWORK_ERROR', cause.message);
            }
            return new Aria2AdapterError('UNKNOWN', cause.message);
        }

        return new Aria2AdapterError('UNKNOWN', String(cause));
    }
}
