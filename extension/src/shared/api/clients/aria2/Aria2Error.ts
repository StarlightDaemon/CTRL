/**
 * Aria2-specific error class with error code taxonomy
 * 
 * Maps Aria2 JSON-RPC error codes to meaningful error types:
 * - JSON-RPC Protocol Errors: -32700, -32600, -32601, -32602
 * - Aria2 Application Errors: 1 (multi-purpose), 18 (file system)
 */

export type Aria2ErrorCode =
    | 'PARSE_ERROR'           // -32700: Invalid JSON
    | 'INVALID_REQUEST'       // -32600: Schema violation
    | 'METHOD_NOT_FOUND'      // -32601: Unknown method
    | 'INVALID_PARAMS'        // -32602: Often auth-related
    | 'UNAUTHORIZED'          // 1 in auth context
    | 'GID_NOT_FOUND'         // 1 in status context
    | 'FILE_SYSTEM_ERROR'     // 18: Permissions/disk space
    | 'NETWORK_ERROR'         // Connection failures
    | 'TIMEOUT'               // Request timeout
    | 'UNKNOWN';              // Fallback

export interface Aria2ErrorDetails {
    code: Aria2ErrorCode;
    rpcCode?: number;
    message: string;
    context: string;
    retryable: boolean;
}

export class Aria2Error extends Error {
    public readonly code: Aria2ErrorCode;
    public readonly rpcCode?: number;
    public readonly context: string;
    public readonly retryable: boolean;

    constructor(details: Aria2ErrorDetails) {
        super(details.message);
        this.name = 'Aria2Error';
        this.code = details.code;
        this.rpcCode = details.rpcCode;
        this.context = details.context;
        this.retryable = details.retryable;
    }

    /**
     * Parse a JSON-RPC error response into a typed Aria2Error
     */
    static fromRpcError(error: { code: number; message: string }, context: string): Aria2Error {
        const mapping = Aria2Error.mapRpcCode(error.code, error.message, context);
        return new Aria2Error({
            ...mapping,
            rpcCode: error.code,
            context,
        });
    }

    /**
     * Create an error from a network/fetch failure
     */
    static fromNetworkError(error: Error, context: string): Aria2Error {
        const isTimeout = error.message.toLowerCase().includes('timeout') ||
            error.name === 'AbortError';

        return new Aria2Error({
            code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
            message: error.message,
            context,
            retryable: true, // Network errors are always retryable
        });
    }

    private static mapRpcCode(
        code: number,
        message: string,
        context: string
    ): Omit<Aria2ErrorDetails, 'rpcCode' | 'context'> {
        switch (code) {
            case -32700:
                return {
                    code: 'PARSE_ERROR',
                    message: 'Invalid JSON in request',
                    retryable: false,
                };
            case -32600:
                return {
                    code: 'INVALID_REQUEST',
                    message: 'Malformed JSON-RPC request',
                    retryable: false,
                };
            case -32601:
                return {
                    code: 'METHOD_NOT_FOUND',
                    message: `Method not found: ${message}`,
                    retryable: false,
                };
            case -32602:
                // Often auth-related (missing token: prefix)
                return {
                    code: 'INVALID_PARAMS',
                    message: message.includes('Unauthorized')
                        ? 'Invalid RPC secret token'
                        : `Invalid parameters: ${message}`,
                    retryable: false,
                };
            case 1:
                // Context-dependent: auth failure vs GID not found
                if (context.includes('login') || context.includes('Version')) {
                    return {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication failed - check RPC secret',
                        retryable: false,
                    };
                }
                return {
                    code: 'GID_NOT_FOUND',
                    message: `Download not found: ${message}`,
                    retryable: false,
                };
            case 18:
                return {
                    code: 'FILE_SYSTEM_ERROR',
                    message: `File system error: ${message}. Check permissions and disk space.`,
                    retryable: false,
                };
            default:
                return {
                    code: 'UNKNOWN',
                    message: message || `Unknown error (code ${code})`,
                    retryable: false,
                };
        }
    }

    /**
     * Check if this error indicates the daemon is unreachable
     */
    isConnectionError(): boolean {
        return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
    }

    /**
     * Check if this error is an authentication failure
     */
    isAuthError(): boolean {
        return this.code === 'UNAUTHORIZED' ||
            (this.code === 'INVALID_PARAMS' && this.message.includes('token'));
    }
}
