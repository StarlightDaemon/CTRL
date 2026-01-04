/**
 * Retry utility with exponential backoff for network resilience
 */

export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Base delay in ms (default: 500) */
    baseDelay?: number;
    /** Maximum delay in ms (default: 5000) */
    maxDelay?: number;
    /** Whether to use exponential backoff (default: true) */
    exponential?: boolean;
    /** HTTP status codes that should trigger a retry */
    retryOn?: number[];
    /** Callback for retry attempts */
    onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
    maxRetries: 3,
    baseDelay: 500,
    maxDelay: 5000,
    exponential: true,
    retryOn: [408, 429, 500, 502, 503, 504], // Common transient errors
};

/**
 * Wraps an async function with retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;

            // Check if we should retry this error
            const shouldRetry = isRetryableError(error, opts.retryOn);
            const hasMoreAttempts = attempt < opts.maxRetries;

            if (!shouldRetry || !hasMoreAttempts) {
                throw error;
            }

            // Calculate delay with exponential backoff
            const delay = calculateDelay(attempt, opts.baseDelay, opts.maxDelay, opts.exponential);

            // Notify callback if provided
            if (opts.onRetry) {
                opts.onRetry(attempt + 1, lastError);
            }

            // Wait before retrying
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * Checks if an error is retryable based on status codes
 */
function isRetryableError(error: unknown, retryOn: number[]): boolean {
    // Network errors (no response)
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    // HTTP errors with specific status codes
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status;
        return retryOn.includes(status);
    }

    return false;
}

/**
 * Calculates delay with optional exponential backoff
 */
function calculateDelay(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    exponential: boolean
): number {
    if (!exponential) {
        return baseDelay;
    }

    // Exponential backoff: baseDelay * 2^attempt + jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 200; // Add some randomness to prevent thundering herd
    return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Simple sleep utility
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates a retryable version of a function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: RetryOptions = {}
): T {
    return ((...args: Parameters<T>) => {
        return withRetry(() => fn(...args), options);
    }) as T;
}
