/**
 * WebSocket Keepalive Manager for Chrome 116+
 * 
 * Chrome 116+ allows persistent WebSocket connections in Service Workers.
 * This manager maintains a connection to prevent the SW from being terminated,
 * enabling real-time updates without polling.
 * 
 * For clients that support WebSockets (like qBittorrent with WebUI),
 * this provides push-based updates instead of polling.
 */

export interface WebSocketKeepaliveOptions {
    /** WebSocket URL to connect to */
    url: string;
    /** Heartbeat interval in ms (default: 30000) */
    heartbeatInterval?: number;
    /** Reconnect delay on disconnect (default: 5000) */
    reconnectDelay?: number;
    /** Max reconnect attempts (default: 10) */
    maxReconnectAttempts?: number;
    /** Callback for received messages */
    onMessage?: (data: any) => void;
    /** Callback for connection state changes */
    onStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
}

export class WebSocketKeepalive {
    private ws: WebSocket | null = null;
    private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectAttempts = 0;
    private isManualClose = false;
    private options: Required<WebSocketKeepaliveOptions>;

    constructor(options: WebSocketKeepaliveOptions) {
        this.options = {
            heartbeatInterval: 30000,
            reconnectDelay: 5000,
            maxReconnectAttempts: 10,
            onMessage: () => { },
            onStateChange: () => { },
            ...options,
        };
    }

    /**
     * Check if WebSocket is supported in current environment
     */
    static isSupported(): boolean {
        return typeof WebSocket !== 'undefined';
    }

    /**
     * Connect to the WebSocket server
     */
    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        this.isManualClose = false;
        this.options.onStateChange('connecting');

        try {
            this.ws = new WebSocket(this.options.url);
            this.setupEventHandlers();
        } catch (error) {
            console.error('[WebSocketKeepalive] Connection error:', error);
            this.options.onStateChange('error');
            this.scheduleReconnect();
        }
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        this.isManualClose = true;
        this.cleanup();
    }

    /**
     * Send a message through the WebSocket
     */
    send(data: string | object): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.ws.send(message);
        }
    }

    /**
     * Get current connection state
     */
    getState(): 'connecting' | 'connected' | 'disconnected' | 'error' {
        if (!this.ws) return 'disconnected';
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            default: return 'disconnected';
        }
    }

    private setupEventHandlers(): void {
        if (!this.ws) return;

        this.ws.onopen = () => {
            console.log('[WebSocketKeepalive] Connected');
            this.reconnectAttempts = 0;
            this.options.onStateChange('connected');
            this.startHeartbeat();
        };

        this.ws.onclose = (event) => {
            console.log('[WebSocketKeepalive] Disconnected', event.code, event.reason);
            this.options.onStateChange('disconnected');
            this.stopHeartbeat();

            if (!this.isManualClose) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('[WebSocketKeepalive] Error:', error);
            this.options.onStateChange('error');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.options.onMessage(data);
            } catch {
                // Raw string message
                this.options.onMessage(event.data);
            }
        };
    }

    private startHeartbeat(): void {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                // Send ping message to keep connection alive
                this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            }
        }, this.options.heartbeatInterval);
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.log('[WebSocketKeepalive] Max reconnect attempts reached');
            return;
        }

        // Exponential backoff
        const delay = this.options.reconnectDelay * Math.pow(1.5, this.reconnectAttempts);
        this.reconnectAttempts++;

        console.log(`[WebSocketKeepalive] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    private cleanup(): void {
        this.stopHeartbeat();

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.options.onStateChange('disconnected');
    }
}

/**
 * Service Worker specific keepalive using WebSocket
 * Creates a lightweight WebSocket connection just to keep SW alive
 */
export const ServiceWorkerKeepalive = {
    keepalive: null as WebSocketKeepalive | null,

    /**
     * Start keepalive using a WebSocket echo server or custom endpoint
     */
    start(url?: string): void {
        if (!WebSocketKeepalive.isSupported()) {
            console.log('[SWKeepalive] WebSocket not supported, using fallback');
            return;
        }

        // Use provided URL or default to a public echo server for testing
        // In production, this should connect to the user's torrent client if it supports WS
        const wsUrl = url || 'wss://echo.websocket.org';

        this.keepalive = new WebSocketKeepalive({
            url: wsUrl,
            heartbeatInterval: 25000, // Chrome SW idle timeout is ~30s
            onStateChange: (state) => {
                console.log(`[SWKeepalive] State: ${state}`);
            },
        });

        this.keepalive.connect();
    },

    /**
     * Stop keepalive
     */
    stop(): void {
        this.keepalive?.disconnect();
        this.keepalive = null;
    },
};
