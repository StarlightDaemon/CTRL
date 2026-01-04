import { storage } from 'wxt/storage';
import { browser } from 'wxt/browser';

const STORAGE_KEY = 'session:torrent_state';

// Simple debounce utility to avoid external dependency issues
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return function (...args: Parameters<T>) {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

/**
 * Service to handle "Write-Through Hydration".
 * Ensures the extension state survives Service Worker termination (Safari/Firefox/Chrome).
 */
export const StateHydrator = {
    /**
     * Reads the last known state from session storage.
     * Call this on Service Worker startup.
     */
    hydrate: async <T>(): Promise<T | null> => {
        try {
            const data = await browser.storage.session.get(STORAGE_KEY);
            return data[STORAGE_KEY] as T || null;
        } catch (error) {
            console.warn('[StateHydrator] Failed to hydrate:', error);
            return null;
        }
    },

    /**
     * Persists the state to session storage.
     * Debounced to prevent thrashing storage on every single update.
     */
    persist: debounce((state: any) => {
        try {
            browser.storage.session.set({ [STORAGE_KEY]: state });
            console.debug('[StateHydrator] State persisted to session storage.');
        } catch (error) {
            console.error('[StateHydrator] Failed to persist state:', error);
        }
    }, 1000) // 1 second debounce
};
