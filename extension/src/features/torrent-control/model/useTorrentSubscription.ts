import { useCallback, useEffect, useRef } from 'react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import {
    ACTIVE_SESSION_PORT,
    DEFAULT_VIEWPORT_SIZE,
    type PortClientMessage,
    type PortServerMessage,
} from '@/shared/api/messaging/protocol';

const RECONNECT_DELAY_MS = 1000;

export interface Viewport {
    start: number;
    end: number;
}

/**
 * Subscribes this UI context to live queue data from the background.
 *
 * Opens the active-session port, declares the viewport it renders, and feeds
 * every snapshot/status message into the torrent store. Holding the port also
 * tells the background to poll at the fast rate. If the port drops (the
 * background service worker was restarted), it reconnects automatically and
 * re-declares the viewport so the list keeps updating without a page reload.
 */
export function useTorrentSubscription(initialViewport: Viewport = { start: 0, end: DEFAULT_VIEWPORT_SIZE }) {
    const applySnapshot = useTorrentStore((s) => s.applySnapshot);
    const applyStatus = useTorrentStore((s) => s.applyStatus);

    const portRef = useRef<chrome.runtime.Port | null>(null);
    const viewportRef = useRef<Viewport>(initialViewport);
    const activeRef = useRef(true);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const post = useCallback((message: PortClientMessage) => {
        try {
            portRef.current?.postMessage(message);
        } catch {
            // Port is closed; the reconnect path will re-send the viewport.
        }
    }, []);

    useEffect(() => {
        activeRef.current = true;

        const connect = () => {
            if (!activeRef.current) return;
            let port: chrome.runtime.Port;
            try {
                port = chrome.runtime.connect({ name: ACTIVE_SESSION_PORT });
            } catch (error) {
                console.warn('[Subscription] connect failed, retrying', error);
                scheduleReconnect();
                return;
            }
            portRef.current = port;

            port.onMessage.addListener((message: PortServerMessage) => {
                if (!message || typeof message !== 'object') return;
                if (message.type === 'SNAPSHOT') applySnapshot(message);
                else if (message.type === 'STATUS') applyStatus(message);
            });

            port.onDisconnect.addListener(() => {
                if (portRef.current === port) portRef.current = null;
                scheduleReconnect();
            });

            const { start, end } = viewportRef.current;
            port.postMessage({ type: 'SET_VIEWPORT', start, end } satisfies PortClientMessage);
        };

        const scheduleReconnect = () => {
            if (!activeRef.current || reconnectTimer.current) return;
            reconnectTimer.current = setTimeout(() => {
                reconnectTimer.current = null;
                connect();
            }, RECONNECT_DELAY_MS);
        };

        connect();

        return () => {
            activeRef.current = false;
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
            const port = portRef.current;
            portRef.current = null;
            try {
                port?.disconnect();
            } catch {
                // already gone
            }
        };
    }, [applySnapshot, applyStatus]);

    const setViewport = useCallback((start: number, end: number) => {
        const next = { start: Math.max(0, start), end: Math.max(start + 1, end) };
        const prev = viewportRef.current;
        if (prev.start === next.start && prev.end === next.end) return;
        viewportRef.current = next;
        post({ type: 'SET_VIEWPORT', start: next.start, end: next.end });
    }, [post]);

    const refresh = useCallback(() => post({ type: 'REFRESH' }), [post]);

    return { setViewport, refresh };
}
