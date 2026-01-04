import { browser } from 'wxt/browser';
import { WebSocketKeepalive, ServiceWorkerKeepalive } from '@/shared/lib/websocket/WebSocketKeepalive';
import { OffscreenManager } from '@/features/torrent-control/model/services/OffscreenManager';

/**
 * Service to handle browser-specific lifecycle management.
 * 
 * - Chrome 116+: Uses Native WebSocket Keep-Alive for persistent connections.
 * - Chrome <116: Uses Offscreen Document with ping interval.
 * - Firefox/Brave: Uses Alarms API "Heartbeat" to prevent idle suspension.
 * - Safari: (Not fully supported yet, falls back to Hydration).
 */
export const LifecycleAdapter = {
    wsKeepalive: null as WebSocketKeepalive | null,

    /**
     * Initializes the appropriate Keep-Alive mechanism for the current browser.
     */
    initKeepAlive: async () => {
        // Feature detection for Firefox-like extensive environments vs Chrome-like restricted environments.
        // 'browser.runtime.getBrowserInfo' is typically Firefox-only.
        // @ts-ignore - WXT types might not fully cover Firefox specifics yet, or we use runtime detection.
        const isFirefox = typeof browser.runtime.getBrowserInfo !== 'undefined';

        // Check for offscreen API as a proxy for Chrome MV3
        // @ts-ignore
        const hasOffscreen = typeof chrome !== 'undefined' && typeof chrome.offscreen !== 'undefined';

        // Check Chrome version for WebSocket support in SW (Chrome 116+)
        const chromeVersion = LifecycleAdapter.getChromeVersion();
        const hasWebSocketInSW = chromeVersion >= 116;

        if (isFirefox) {
            console.log('[LifecycleAdapter] Firefox detected. Using Alarms heartbeat.');
            // Firefox Event Pages handle lifecycle differently, alarms handled in background.ts
            return;
        }

        if (hasWebSocketInSW && WebSocketKeepalive.isSupported()) {
            console.log('[LifecycleAdapter] Chrome 116+ detected. WebSocket keepalive available.');
            // Note: We don't automatically connect here - the actual WebSocket connection
            // would be to a torrent client that supports it (e.g., qBittorrent WebSocket API).
            // For now, we just log capability. Actual connection happens when needed.
            return;
        }

        if (hasOffscreen) {
            console.log('[LifecycleAdapter] Chrome <116 detected. Using Offscreen document keepalive.');
            await OffscreenManager.ensureCreated();
            return;
        }

        console.log('[LifecycleAdapter] No keepalive mechanism available. Relying on Alarms + Hydration.');
    },

    /**
     * Start WebSocket keepalive with a specific URL (for clients that support WS)
     */
    startWebSocketKeepalive(wsUrl: string, onMessage?: (data: any) => void): void {
        if (!WebSocketKeepalive.isSupported()) {
            console.warn('[LifecycleAdapter] WebSocket not supported');
            return;
        }

        LifecycleAdapter.stopWebSocketKeepalive();

        LifecycleAdapter.wsKeepalive = new WebSocketKeepalive({
            url: wsUrl,
            heartbeatInterval: 25000,
            maxReconnectAttempts: 10,
            onMessage: onMessage || (() => { }),
            onStateChange: (state) => {
                console.log(`[LifecycleAdapter] WebSocket state: ${state}`);
            },
        });

        LifecycleAdapter.wsKeepalive.connect();
    },

    /**
     * Stop the WebSocket keepalive connection
     */
    stopWebSocketKeepalive(): void {
        LifecycleAdapter.wsKeepalive?.disconnect();
        LifecycleAdapter.wsKeepalive = null;
    },

    /**
     * Get Chrome major version number
     */
    getChromeVersion(): number {
        try {
            const match = navigator.userAgent.match(/Chrome\/(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
        } catch {
            return 0;
        }
    },

    /**
     * Abstracted DOM Parser.
     * - Firefox: Uses native DOMParser in background.
     * - Chrome: Delegates to Offscreen Document (if implemented) or throws.
     * 
     * @param html String HTML to parse
     * @returns Parsed document or data (Note: returning actual DOM nodes passes poorly over messages)
     */
    parseDOM: async (html: string): Promise<any> => {
        // Check for native DOM support (Firefox Event Pages)
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            // For cross-browser consistency, we should extract data here rather than returning the DOM node,
            // as Chrome requires serializable data.
            // TODO: Implement specific parsing logic here or return a simplified object.
            return doc;
        }

        // Chrome Offscreen Fallback would go here.
        // For now, we assume this is only called where safe or Chrome uses a different path.
        throw new Error('[LifecycleAdapter] Native DOM parsing not available.');
    }
};
