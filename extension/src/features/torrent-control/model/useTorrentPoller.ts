import { useEffect } from 'react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { useSettings } from './useSettings';

export const useTorrentPoller = (intervalMs = 2000) => {
    const { setViewportData, setLoading, setError } = useTorrentStore();
    const { settings } = useSettings();


    useEffect(() => {
        if (!settings || (settings.servers || []).length === 0) return;

        // 1. Establish Active Session Port (Keeps SW Alive & Signals Foreground)
        const port = chrome.runtime.connect({ name: 'ctrl-active-session' });

        // 2. Message Listener (via Port or Runtime mainly runtime for broadcast)
        // Note: We keep runtime listener for global broadcasts, but Port is for lifecycle.
        const messageListener = (message: any) => {
            if (message.type === 'VIEWPORT_UPDATE') {
                const { items, total, start } = message.data;
                setViewportData(items, total, start);
                setLoading(false);
            }
            if (message.type === 'VIEWPORT_DIFF') {
                const { patches, total, start } = message.data;
                const { applyPatchData } = useTorrentStore.getState();
                applyPatchData(patches, total, start);
                setLoading(false);
            }
            if (message.type === 'STATS_UPDATE') {
                const { globalStats, setGlobalStats } = useTorrentStore.getState();
                setGlobalStats(message.data);
            }
        };

        chrome.runtime.onMessage.addListener(messageListener);

        // 3. Initial Request
        setLoading(true);
        // We can send the force refresh via the port or runtime. Runtime is fine.
        chrome.runtime.sendMessage({ type: 'FORCE_REFRESH' }).catch(() => { });

        port.onDisconnect.addListener(() => {
            console.log('Poller: Port disconnected (SW died or Unloaded)');
        });

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
            port.disconnect();
        };
    }, [settings, setViewportData, setLoading]);
};
