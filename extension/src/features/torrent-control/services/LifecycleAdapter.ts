import { browser } from 'wxt/browser';
import { WebSocketKeepalive } from '@/shared/lib/websocket/WebSocketKeepalive';

/**
 * Serializable representation of a parsed DOM subtree.
 * DRAFT (unvalidated) — see parseDOM below.
 */
export interface ParsedDOMNode {
    tag: string;
    id: string;
    attributes: Record<string, string>;
    text: string;
    children: ParsedDOMNode[];
}

export interface ParsedDOMResult {
    title: string;
    text: string;
    root: ParsedDOMNode | null;
}

const MAX_SERIALIZE_DEPTH = 25;

function serializeElement(el: Element, depth = 0): ParsedDOMNode {
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
        attributes[attr.name] = attr.value;
    }
    return {
        tag: el.tagName.toLowerCase(),
        id: el.id,
        attributes,
        // Full descendant text (like `textContent`), not just this element's own
        // direct text nodes — otherwise inline-formatted content (e.g. a
        // highlighted search term wrapped in <mark>/<b>, common on torrent
        // index/search pages) is silently dropped from a link or row label.
        // Matches the semantics already used for `ParsedDOMResult.text`.
        text: el.textContent?.trim() ?? '',
        children: depth < MAX_SERIALIZE_DEPTH
            ? Array.from(el.children).map(child => serializeElement(child, depth + 1))
            : [],
    };
}

/**
 * Service to handle browser-specific lifecycle management.
 * 
 * - Chrome 116+: Uses Native WebSocket Keep-Alive for persistent connections.
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
        // 'browser.runtime.getBrowserInfo' is typically Firefox-only and not in the standard WebExtension types.
        const isFirefox = typeof (browser.runtime as unknown as Record<string, unknown>).getBrowserInfo !== 'undefined';
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
        console.log('[LifecycleAdapter] No keepalive mechanism available. Relying on Alarms + Hydration.');
    },

    /**
     * Start WebSocket keepalive with a specific URL (for clients that support WS)
     */
    startWebSocketKeepalive(wsUrl: string, onMessage?: (data: unknown) => void): void {
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
     * DRAFT: this previously returned the raw `Document`, which is not
     * structured-clone serializable and cannot cross the extension message
     * boundary. It now returns a plain-object tree (`ParsedDOMResult`) following
     * the same extract-to-serializable convention the adapters use
     * (UTorrentParsingUtils string extraction, XmlRpcHelper txml objects).
     * The output shape has been exercised in
     * tests/unit/LifecycleAdapter.parseDOM.test.ts against representative
     * torrent-client-style HTML (a uTorrent-style token fragment, a
     * search-result listing with highlighted/nested text and magnet links)
     * and against structured-clone safety and deep nesting — see that file
     * for what was and wasn't checked. There are still zero real callers in
     * this codebase, so it has not been validated against any actual client's
     * live HTML; verify against the real protocol before relying on it.
     *
     * @param html String HTML to parse
     * @returns Serializable simplified representation of the document
     */
    parseDOM: async (html: string): Promise<ParsedDOMResult> => {
        // Check for native DOM support (Firefox Event Pages)
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            return {
                title: doc.title,
                text: doc.body?.textContent?.trim() ?? '',
                root: doc.body ? serializeElement(doc.body) : null,
            };
        }

        // Chrome Offscreen Fallback would go here.
        // For now, we assume this is only called where safe or Chrome uses a different path.
        throw new Error('[LifecycleAdapter] Native DOM parsing not available.');
    }
};
