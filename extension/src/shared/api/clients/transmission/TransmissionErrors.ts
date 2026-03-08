/**
 * Transmission-specific error classes for enhanced error handling
 */

/**
 * Base class for Transmission RPC errors
 */
export class TransmissionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TransmissionError';
    }
}

/**
 * HTTP 401 - Authentication failed (wrong username/password)
 */
export class AuthenticationError extends TransmissionError {
    constructor(message: string = 'Authentication failed. Check username and password.') {
        super(message);
        this.name = 'AuthenticationError';
    }
}

/**
 * HTTP 403 - Host not in rpc-host-whitelist (DNS rebinding protection)
 */
export class WhitelistError extends TransmissionError {
    constructor(hostname: string) {
        super(
            `Host "${hostname}" not in rpc-host-whitelist. ` +
            `Add this hostname to the daemon's settings.json under rpc-host-whitelist.`
        );
        this.name = 'WhitelistError';
    }
}

/**
 * HTTP 409 - Session ID expired (normal handshake flow, internal use only)
 */
export class SessionExpiredError extends TransmissionError {
    constructor(public newSessionId?: string) {
        super('Session ID expired. Refreshing...');
        this.name = 'SessionExpiredError';
    }
}

/**
 * HTTP 5xx - Daemon error or crash
 */
export class DaemonError extends TransmissionError {
    constructor(public status: number, message?: string) {
        super(message || `Daemon error: HTTP ${status}. The Transmission daemon may be overloaded or crashed.`);
        this.name = 'DaemonError';
    }
}

/**
 * RPC logic error (result !== 'success')
 */
export class RpcError extends TransmissionError {
    constructor(public result: string, public rpcMethod?: string) {
        super(`RPC call failed: ${result}${rpcMethod ? ` (method: ${rpcMethod})` : ''}`);
        this.name = 'RpcError';
    }
}

/**
 * Torrent already exists (duplicate)
 */
export class DuplicateTorrentError extends TransmissionError {
    constructor(public torrentName?: string) {
        super(`Torrent already exists${torrentName ? `: ${torrentName}` : ''}`);
        this.name = 'DuplicateTorrentError';
    }
}
