import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';

/**
 * Failure modes of the Synology Download Station adapter.
 */
export type SynologyErrorType =
    | 'CONNECTION_REFUSED'   // NAS unreachable (often a masked self-signed-cert failure)
    | 'TIMEOUT'              // Request exceeded the timeout (NAS may be hibernating)
    | 'AUTH_FAILED'          // Wrong account/password, disabled or expired account
    | 'OTP_REQUIRED'         // 2FA code required / enforced
    | 'OTP_FAILED'           // 2FA code incorrect
    | 'IP_BLOCKED'           // Too many failed logins (codes 407/408)
    | 'PERMISSION_DENIED'    // Insufficient privilege for the operation
    | 'SESSION_EXPIRED'      // SID not found / session expired (codes 119/410)
    | 'NETWORK_ERROR'        // DSM reported a network failure (code 409)
    | 'UNKNOWN';

/**
 * Adapter error for Synology Download Station. All Synology-specific user-facing
 * strings and the classification of raw failures into {@link SynologyErrorType}
 * live here. Synology surfaces failures as Error messages built from DSM error
 * codes, so classification is message-driven.
 */
export class SynologyAdapterError extends AdapterError<SynologyErrorType> {
    constructor(type: SynologyErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        switch (this.type) {
            case 'CONNECTION_REFUSED':
                return 'Cannot reach the Synology NAS. Verify the host and port. If using HTTPS with a self-signed certificate, open the NAS in a browser tab and accept the certificate first.';
            case 'TIMEOUT':
                return 'The Synology NAS did not respond in time. It may be hibernating — try again in a moment.';
            case 'AUTH_FAILED':
                return 'Authentication failed. Check your Synology account and password.';
            case 'OTP_REQUIRED':
                return 'This account requires a 2-factor authentication code. Add an OTP code and try again.';
            case 'OTP_FAILED':
                return 'The 2-factor authentication code was rejected. Check the code and try again.';
            case 'IP_BLOCKED':
                return 'Synology has blocked this IP after too many failed logins. Wait, or unblock it in DSM Security settings.';
            case 'PERMISSION_DENIED':
                return 'This Synology account lacks permission for Download Station. Check the user privileges in DSM.';
            case 'SESSION_EXPIRED':
                return 'The Synology session expired. Reconnect to continue.';
            case 'NETWORK_ERROR':
                return 'The Synology NAS reported a network failure. Check its network connection.';
            default:
                return 'An unexpected Synology error occurred.';
        }
    }

    /**
     * Classify an arbitrary thrown value into a SynologyAdapterError.
     * Unwraps RetryExhaustedError; classification is driven by DSM message text.
     */
    static from(error: unknown): SynologyAdapterError {
        if (error instanceof SynologyAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof SynologyAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        const msg = message.toLowerCase();
        const is2fa = msg.includes('2-factor') || msg.includes('two-factor') || msg.includes('2fa') || msg.includes('otp');

        if (is2fa && msg.includes('failed')) return new SynologyAdapterError('OTP_FAILED', message);
        if (is2fa) return new SynologyAdapterError('OTP_REQUIRED', message);

        if (msg.includes('blocked ip') || msg.includes('ip block') || msg.includes('too many') || msg.includes('account is blocked')) {
            return new SynologyAdapterError('IP_BLOCKED', message);
        }
        if (msg.includes('no such account') || msg.includes('incorrect password') || msg.includes('account disabled') || msg.includes('account expired')) {
            return new SynologyAdapterError('AUTH_FAILED', message);
        }
        if (msg.includes('permission denied') || msg.includes('insufficient privilege') || msg.includes('access denied')) {
            return new SynologyAdapterError('PERMISSION_DENIED', message);
        }
        if (msg.includes('session expired') || msg.includes('sid not found') || msg.includes('session timeout') || msg.includes('session interrupted')) {
            return new SynologyAdapterError('SESSION_EXPIRED', message);
        }
        if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('aborted')) {
            return new SynologyAdapterError('TIMEOUT', message);
        }
        if ((cause instanceof Error && cause.name === 'TypeError') || msg.includes('failed to fetch') || msg.includes('networkerror')
            || msg.includes('unable to connect') || msg.includes('certificate') || msg.includes('ssl') || msg.includes('econnrefused')) {
            return new SynologyAdapterError('CONNECTION_REFUSED', message);
        }
        if (msg.includes('network')) {
            return new SynologyAdapterError('NETWORK_ERROR', message);
        }

        return new SynologyAdapterError('UNKNOWN', message);
    }
}
