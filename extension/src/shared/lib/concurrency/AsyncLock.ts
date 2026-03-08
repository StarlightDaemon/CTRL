/**
 * Lightweight async lock for controlling concurrent access to critical sections
 * Used primarily for session ID refresh to prevent race conditions
 */
export class AsyncLock {
    private locked = false;
    private queue: Array<() => void> = [];

    /**
     * Acquires the lock. If already locked, waits in queue until released.
     * 
     * @example
     * ```typescript
     * const lock = new AsyncLock();
     * await lock.acquire();
     * try {
     *   // Critical section
     * } finally {
     *   lock.release();
     * }
     * ```
     */
    async acquire(): Promise<void> {
        if (!this.locked) {
            this.locked = true;
            return;
        }

        // Wait in queue
        return new Promise<void>((resolve) => {
            this.queue.push(resolve);
        });
    }

    /**
     * Releases the lock and allows next queued caller to proceed
     */
    release(): void {
        const next = this.queue.shift();
        if (next) {
            next(); // Wake next waiter
        } else {
            this.locked = false;
        }
    }

    /**
     * Executes a function with automatic lock acquisition and release
     * 
     * @example
     * ```typescript
     * const result = await lock.run(async () => {
     *   // Critical section
     *   return someValue;
     * });
     * ```
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        await this.acquire();
        try {
            return await fn();
        } finally {
            this.release();
        }
    }
}
