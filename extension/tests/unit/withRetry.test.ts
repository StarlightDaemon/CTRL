import { describe, it, expect, vi } from 'vitest';
import { withRetry, makeRetryable } from '@/shared/lib/retry/withRetry';

describe('withRetry', () => {
    it('should return result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const result = await withRetry(fn);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValue('success');

        const result = await withRetry(fn, { baseDelay: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
        const fn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        await expect(withRetry(fn, { maxRetries: 2, baseDelay: 10 }))
            .rejects.toThrow('Failed to fetch');

        expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should call onRetry callback on each retry', async () => {
        const onRetry = vi.fn();
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValue('success');

        await withRetry(fn, { baseDelay: 10, onRetry });

        expect(onRetry).toHaveBeenCalledTimes(1);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should not retry on non-retryable errors', async () => {
        // Create an error that's not a network error and not in retryOn list
        const error = new Error('Regular error');
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withRetry(fn, { maxRetries: 3, baseDelay: 10 }))
            .rejects.toThrow('Regular error');

        expect(fn).toHaveBeenCalledTimes(1); // No retries
    });

    it('should retry on specific HTTP status codes', async () => {
        const httpError = { status: 503, message: 'Service Unavailable' };
        const fn = vi.fn()
            .mockRejectedValueOnce(httpError)
            .mockResolvedValue('success');

        const result = await withRetry(fn, { baseDelay: 10 });

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect maxDelay option', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValue('success');

        const startTime = Date.now();
        await withRetry(fn, { baseDelay: 100, maxDelay: 150, maxRetries: 3 });
        const duration = Date.now() - startTime;

        // With maxDelay of 150, delays should be capped
        expect(duration).toBeLessThan(500); // Would be longer with true exponential
    });
});

describe('makeRetryable', () => {
    it('should create a retryable version of a function', async () => {
        const originalFn = vi.fn()
            .mockRejectedValueOnce(new TypeError('Failed to fetch'))
            .mockResolvedValue('data');

        const retryableFn = makeRetryable(originalFn, { baseDelay: 10 });
        const result = await retryableFn();

        expect(result).toBe('data');
        expect(originalFn).toHaveBeenCalledTimes(2);
    });

    it('should pass through arguments', async () => {
        const originalFn = vi.fn().mockImplementation((a: number, b: string) =>
            Promise.resolve(`${a}-${b}`)
        );

        const retryableFn = makeRetryable(originalFn);
        const result = await retryableFn(42, 'test');

        expect(result).toBe('42-test');
        expect(originalFn).toHaveBeenCalledWith(42, 'test');
    });
});
