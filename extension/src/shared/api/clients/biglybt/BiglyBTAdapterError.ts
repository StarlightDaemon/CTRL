import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { BiglyBTErrorType, classifyError, getErrorMessage } from './BiglyBTSchema';

export type { BiglyBTErrorType };

/**
 * Adapter error for BiglyBT.
 *
 * BiglyBT already ships a complete error taxonomy in BiglyBTSchema: `classifyError`
 * maps raw failures to a {@link BiglyBTErrorType}, and `getErrorMessage` maps each
 * type to a human-readable string. This subclass adapts that taxonomy onto the shared
 * AdapterError contract rather than duplicating the strings — `toUserMessage` delegates
 * to BiglyBT's own `getErrorMessage`, so all adapter-specific text remains in BiglyBT's
 * module (nothing leaks into the base class).
 */
export class BiglyBTAdapterError extends AdapterError<BiglyBTErrorType> {
    constructor(type: BiglyBTErrorType, message: string) {
        super(type, message);
    }

    toUserMessage(): string {
        return getErrorMessage(this.type);
    }

    /**
     * Classify an arbitrary thrown value into a BiglyBTAdapterError using BiglyBT's
     * existing classifyError. Unwraps RetryExhaustedError first.
     */
    static from(error: unknown): BiglyBTAdapterError {
        if (error instanceof BiglyBTAdapterError) return error;

        const cause = error instanceof RetryExhaustedError ? error.lastError : error;
        if (cause instanceof BiglyBTAdapterError) return cause;

        const message = cause instanceof Error ? cause.message : String(cause);
        return new BiglyBTAdapterError(classifyError(cause), message);
    }
}
