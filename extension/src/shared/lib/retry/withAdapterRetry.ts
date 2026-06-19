import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

/**
 * Shared retry infrastructure for torrent-client adapters.
 *
 * This is the adapter-layer retry utility. It is intentionally separate from the
 * generic, HTTP-status-focused `withRetry` in `./withRetry.ts` (used by
 * `FetchHttpClient`): this one is driven by `RetryConfig` and throws an
 * `AdapterError` on exhaustion.
 *
 * `RetryConfig`, `DEFAULT_RETRY_CONFIG`, `calculateBackoffDelay`, and `sleep` are the
 * canonical definitions for the whole adapter layer. They were lifted out of
 * `biglybt/BiglyBTSchema.ts` (which now re-exports them from here) so that every
 * adapter shares one exponential-backoff implementation.
 */

/**
 * Configuration for exponential-backoff retry.
 */
export interface RetryConfig {
    /** Maximum number of attempts (initial attempt included). */
    maxAttempts: number;
    /** Initial delay in milliseconds. */
    initialDelayMs: number;
    /** Maximum delay in milliseconds (caps the exponential growth). */
    maxDelayMs: number;
    /** Multiplier applied to the delay for each subsequent attempt. */
    backoffMultiplier: number;
}

/**
 * Default retry configuration for startup/connection.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxAttempts: 5,
    initialDelayMs: 1000,   // 1s, then 2s, 4s, 8s, 16s
    maxDelayMs: 16000,
    backoffMultiplier: 2,
};

/**
 * Calculate the delay for a given (zero-based) attempt using exponential backoff,
 * capped at `config.maxDelayMs`.
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Concrete fallback error thrown when retries are exhausted and the last failure was
 * not itself an `AdapterError`.
 *
 * `AdapterError` is abstract and cannot be instantiated, so `withAdapterRetry` needs a
 * concrete, adapter-agnostic error to wrap raw failures (e.g. a bare `TypeError`
 * from `fetch`) while still honouring the "throws an `AdapterError`" contract.
 */
export class RetryExhaustedError extends AdapterError<'RETRY_EXHAUSTED'> {
    /** The last error caught before retries were exhausted. */
    public readonly lastError: unknown;

    constructor(lastError: unknown) {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        super('RETRY_EXHAUSTED', message);
        this.lastError = lastError;
    }

    toUserMessage(): string {
        return 'The operation failed after multiple attempts. Check that the client is running and reachable, then try again.';
    }
}

/**
 * Run an async callable with exponential-backoff retry.
 *
 * The callable is attempted up to `config.maxAttempts` times. Between attempts the
 * caller sleeps for `calculateBackoffDelay(attempt, config)` milliseconds. When every
 * attempt has failed, the last caught error is thrown as an `AdapterError`: if it is
 * already an `AdapterError` it is rethrown unchanged, otherwise it is wrapped in a
 * `RetryExhaustedError`.
 *
 * @param fn     The async operation to run.
 * @param config Retry configuration (defaults to `DEFAULT_RETRY_CONFIG`).
 */
export async function withAdapterRetry<T>(
    fn: () => Promise<T>,
    config: RetryConfig = DEFAULT_RETRY_CONFIG,
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const hasMoreAttempts = attempt < config.maxAttempts - 1;
            if (hasMoreAttempts) {
                await sleep(calculateBackoffDelay(attempt, config));
            }
        }
    }

    throw lastError instanceof AdapterError
        ? lastError
        : new RetryExhaustedError(lastError);
}
