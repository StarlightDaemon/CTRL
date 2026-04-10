import { useEffect } from 'react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { useSettings } from './useSettings';

export const useTorrentPoller = (_intervalMs = 2000) => {
    const { setViewportData, setLoading } = useTorrentStore();
    const { settings } = useSettings();


    useEffect(() => {
        if (!settings || (settings.servers || []).length === 0) return;

        // 1. Establish Active Session Port (Keeps SW Alive & Signals Foreground)
        const port = chrome.runtime.connect({ name: 'ctrl-active-session' });

        // 2. Message Listener (via Port or Runtime mainly runtime for broadcast)
        // Note: We keep runtime listener for global broadcasts, but Port is for lifecycle.
        type PollerMessage =
            | { type: 'VIEWPORT_UPDATE'; data: { items: unknown[]; total: number; start: number } }
            | { type: 'VIEWPORT_DIFF'; data: { patches: unknown[]; total: number; start: number } }
            | { type: 'STATS_UPDATE'; data: unknown };
        const messageListener = (message: PollerMessage) => {
            if (message.type === 'VIEWPORT_UPDATE') {
                const { items, total, start } = message.data;
                setViewportData(items as Parameters<typeof setViewportData>[0], total, start);
                setLoading(false);
            }
            if (message.type === 'VIEWPORT_DIFF') {
                const { patches, total, start } = message.data;
                const { applyPatchData } = useTorrentStore.getState();
                applyPatchData(patches as Parameters<typeof applyPatchData>[0], total, start);
                setLoading(false);
            }
            if (message.type === 'STATS_UPDATE') {
                const { setGlobalStats } = useTorrentStore.getState();
                setGlobalStats(message.data as Parameters<typeof setGlobalStats>[0]);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chrome.runtime.onMessage.addListener(messageListener as any);

        // 3. Initial Request
        setLoading(true);
        // We can send the force refresh via the port or runtime. Runtime is fine.
        chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }).catch(() => { });

        port.onDisconnect.addListener(() => {
            if (__UI_DEBUG_MODE__) {
                console.log('Poller: Port disconnected (SW died or Unloaded)');
            }
        });

        return () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chrome.runtime.onMessage.removeListener(messageListener as any);
            port.disconnect();
        };
    }, [settings, setViewportData, setLoading]);
};
