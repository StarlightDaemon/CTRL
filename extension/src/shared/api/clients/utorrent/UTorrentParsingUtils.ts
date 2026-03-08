/**
 * Utility for parsing uTorrent responses in a Manifest V3 compatible way.
 * Replaces DOMParser usage with string/regex based extraction.
 */

/**
 * Extracts the session token from uTorrent's token.html response.
 * 
 * uTorrent returns a simple HTML page containing the token:
 * <html><div id='token' style='display:none;'>TOKEN_VALUE</div></html>
 * 
 * @param html - The HTML response content
 * @returns The extracted token string
 * @throws Error if the token cannot be found
 */
export function extractUTorrentToken(html: string): string {
    // Primary approach: Tolerant, case-insensitive regex
    const match = html.match(/<div[^>]*id=["']token["'][^>]*>([^<]+)<\/div>/i);
    if (match && match[1]) {
        return match[1].trim();
    }

    // Fallback: Manual string slicing if regex fails to match for some reason
    // (e.g. unexpected whitespace or attributes)
    const idIndex = html.toLowerCase().indexOf('id="token"');
    const altIdIndex = html.toLowerCase().indexOf("id='token'");

    const targetIndex = idIndex !== -1 ? idIndex : altIdIndex;

    if (targetIndex !== -1) {
        const tagEndIndex = html.indexOf('>', targetIndex);
        if (tagEndIndex !== -1) {
            const contentEndIndex = html.indexOf('<', tagEndIndex);
            if (contentEndIndex !== -1) {
                const token = html.slice(tagEndIndex + 1, contentEndIndex).trim();
                if (token) return token;
            }
        }
    }

    throw new Error('Failed to retrieve uTorrent token from response');
}
