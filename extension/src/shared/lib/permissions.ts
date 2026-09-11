/**
 * Optional host-permission helpers.
 *
 * Match patterns differ between the release browsers:
 *
 * - Chrome supports a port in the host part and then matches only that port
 *   (`http://nas:8080/*`), which is the narrowest possible grant.
 * - Firefox match patterns do not support ports. Its permissions API accepts
 *   `http://nas:8080/*` and even reports it as granted, but requests to that
 *   origin are still treated as cross-origin (verified live on Firefox 155:
 *   CORS preflights were sent and the client's reply was blocked), whereas
 *   `http://nas/*` exempts them. Firefox therefore gets the port-less form,
 *   which is the narrowest grant it offers.
 */
export function isFirefox(): boolean {
    return typeof navigator !== 'undefined' && /\bFirefox\//.test(navigator.userAgent ?? '');
}

/**
 * Normalizes a URL into the match pattern used for the host grant.
 * e.g. "http://localhost:9091/transmission/" -> "http://localhost:9091/*" (Chrome)
 *                                            -> "http://localhost/*"      (Firefox)
 * @throws TypeError when the input is not a valid URL.
 */
export function toMatchPattern(url: string, firefox: boolean = isFirefox()): string {
    const u = new URL(url);
    const port = !firefox && u.port ? `:${u.port}` : '';
    return `${u.protocol}//${u.hostname}${port}/*`;
}

/**
 * Checks if the extension has permission to access the given origin.
 */
export const checkHostPermission = async (url: string): Promise<boolean> => {
    try {
        const pattern = toMatchPattern(url);
        return await chrome.permissions.contains({
            origins: [pattern],
        });
    } catch {
        return false;
    }
};

/**
 * Requests permission to access the given origin.
 * This must be called from a user gesture (e.g., button click).
 */
export const requestHostPermission = async (url: string): Promise<boolean> => {
    try {
        const pattern = toMatchPattern(url);
        return await chrome.permissions.request({
            origins: [pattern],
        });
    } catch (e) {
        console.error('Failed to request permission:', e);
        return false;
    }
};
