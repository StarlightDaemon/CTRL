import { AdapterError } from './AdapterError';

/**
 * Return contract for every adapter's `testConnection` method.
 *
 * `connected` reports whether the client is reachable and authenticated. When
 * `connected` is `false`, `error` carries the adapter-specific `AdapterError`
 * describing why, so callers can surface `error.toUserMessage()` without throwing.
 */
export interface AdapterConnectionResult {
    connected: boolean;
    error?: AdapterError;
}
