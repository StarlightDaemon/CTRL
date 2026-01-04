/**
 * Checks if the extension has permission to access the given origin.
 */
export const checkHostPermission = async (url: string): Promise<boolean> => {
    try {
        const origin = new URL(url).origin + '/*';
        return await chrome.permissions.contains({
            origins: [origin],
        });
    } catch (e) {
        console.error('Invalid URL for permission check:', url);
        return false;
    }
};

/**
 * Requests permission to access the given origin.
 * This must be called from a user gesture (e.g., button click).
 */
export const requestHostPermission = async (url: string): Promise<boolean> => {
    try {
        const origin = new URL(url).origin + '/*';
        return await chrome.permissions.request({
            origins: [origin],
        });
    } catch (e) {
        console.error('Failed to request permission:', e);
        return false;
    }
};
