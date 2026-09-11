import { browser } from 'wxt/browser';
import type { PersistedSnapshot } from '@/shared/api/messaging/protocol';

const STORAGE_KEY = 'session:torrent_state';

// Simple debounce utility to avoid external dependency issues
function debounce<Args extends unknown[]>(func: (...args: Args) => void, wait: number): (...args: Args) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Args) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

function isPersistedSnapshot(value: unknown): value is PersistedSnapshot {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return typeof v.serverId === 'string' && Array.isArray(v.torrents) && typeof v.savedAt === 'number';
}

/**
 * Write-through persistence of the last good queue snapshot to
 * `storage.session`, so a restarted background can show recent data (marked
 * stale) while the first fresh poll runs. The snapshot carries the server id
 * it belongs to; the controller ignores it when the active server differs.
 */
export const StateHydrator = {
    /**
     * Reads the last known snapshot from session storage. Returns null when
     * nothing usable is stored (including legacy shapes from older builds).
     */
    hydrate: async (): Promise<PersistedSnapshot | null> => {
        try {
            const data = await browser.storage.session.get(STORAGE_KEY);
            const value = data[STORAGE_KEY];
            return isPersistedSnapshot(value) ? value : null;
        } catch (error) {
            console.warn('[StateHydrator] Failed to hydrate:', error);
            return null;
        }
    },

    /**
     * Persists the snapshot (or clears it when null). Debounced to avoid
     * thrashing storage on every poll.
     */
    persist: debounce((snapshot: PersistedSnapshot | null) => {
        try {
            if (snapshot) {
                void browser.storage.session.set({ [STORAGE_KEY]: snapshot });
            } else {
                void browser.storage.session.remove(STORAGE_KEY);
            }
        } catch (error) {
            console.error('[StateHydrator] Failed to persist state:', error);
        }
    }, 1000),
};
