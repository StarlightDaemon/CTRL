export interface ServerTarget {
    hostname: string;
}

export class HeaderRewriter {
    /**
     * COMPLIANCE NOTE:
     * This class modifies 'Origin' and 'Referer' headers.
     * 
     * JUSTIFICATION:
     * This extension acts as a remote control for a specific, user-owned BitTorrent server.
     * Many of these servers (e.g. qBittorrent, Deluge) enforce strict CSRF protection that checks
     * Origin/Referer against their own host.
     * 
     * SAFETY MECHANISM:
     * 1. This ONLY applies to the specific hostname configured by the user in the extension settings.
     * 2. It does NOT apply broadly to the web.
     * 3. This implementation uses Declarative Net Request (DNR) dynamic rules, which is the
     *    standard, safe way to handle this in MV3.
     */
    static async configure(servers: ServerTarget[]) {
        // NO-OP: DNR rule modification removed for Option A compliance.
        // Headers are now handled directly in FetchHttpClient.
        console.log(`[HeaderRewriter] DNR configuration skipped for ${servers.length} servers (Legacy Path)`);
    }

    private static tempRefCount = 0;

    static async configureTemporary(targetUrl: string) {
        // NO-OP: DNR rule modification removed for Option A compliance.
        this.tempRefCount++;
        console.log(`[HeaderRewriter] Temporary DNR rule skipped for ${targetUrl} (Legacy Path)`);
    }

    static async removeTemporary(force = false) {
        // NO-OP: DNR rule modification removed for Option A compliance.
        if (force) {
            this.tempRefCount = 0;
        } else if (this.tempRefCount > 0) {
            this.tempRefCount--;
        }
    }

    static async clear() {
        // NO-OP: DNR rule modification removed for Option A compliance.
    }
}
