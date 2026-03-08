/**
 * Normalizes a URL into a valid extension match pattern.
 * e.g., "http://localhost:9091/" -> "http://localhost:9091/*"
 */
const toMatchPattern = (url: string): string => {
    try {
        const u = new URL(url);
        // Origin includes scheme and host (and port if not default)
        // e.g., "http://localhost:9091"
        return `${u.origin}/*`;
    } catch (e) {
        console.error('Invalid URL for match pattern:', url);
        // Fallback or rethrow? For permissions, we need a valid pattern.
        return url.endsWith('/') ? `${url}*` : `${url}/*`;
    }
};

/**
 * Checks if the extension has permission to access the given origin.
 */
export const checkHostPermission = async (url: string): Promise<boolean> => {
    try {
        const pattern = toMatchPattern(url);
        return await chrome.permissions.contains({
            origins: [pattern],
        });
    } catch (e) {
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
