import { create } from 'zustand';
import { Torrent } from '../entities/torrent/model/Torrent';
import { applyTorrentPatches, JsonPatchOperation } from '../shared/lib/diff/TorrentDiffer';

interface GlobalStats {
    downloadSpeed: number;
    uploadSpeed: number;
    activeCount: number;
}

interface TorrentState {
    torrents: Record<number, Torrent>; // Normalized sparse storage
    totalCount: number;
    globalStats: GlobalStats;
    isLoading: boolean;
    error: string | null;

    // Actions
    setViewportData: (items: Torrent[], total: number, start: number) => void;
    applyPatchData: (patches: JsonPatchOperation[], total: number, start: number) => void;
    setGlobalStats: (stats: GlobalStats) => void;
    optimisticUpdate: (id: number | string, changes: Partial<Torrent>) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;
}

export const useTorrentStore = create<TorrentState>((set) => ({
    torrents: {},
    totalCount: 0,
    globalStats: { downloadSpeed: 0, uploadSpeed: 0, activeCount: 0 },
    isLoading: false,
    error: null,

    setViewportData: (items, total, start) => set((state) => {
        let newTorrents = { ...state.torrents };

        if (state.totalCount !== total && total === 0) {
            newTorrents = {};
        }

        items.forEach((item, i) => {
            // Preserve optimistic "pending" usage if the server hasn't caught up,
            // BUT for simplicity, we assume server truth overwrites unless we track specific optimistic flags.
            // For now, let's keep it simple: Server wins. 
            // Optimistic UI is transient visual feedback.
            newTorrents[start + i] = item;
        });

        return {
            torrents: newTorrents,
            totalCount: total,
            isLoading: false,
            error: null
        };
    }),

    applyPatchData: (patches, total, start) => set((state) => {
        const newTorrents = applyTorrentPatches(state.torrents, patches, start);
        return {
            torrents: newTorrents,
            totalCount: total,
            isLoading: false,
            error: null
        };
    }),

    setGlobalStats: (stats) => set({ globalStats: stats }),

    optimisticUpdate: (id, changes) => set((state) => {
        // Find key for this ID (inefficient in sparse array-like object but ok for small viewports)
        // Key is index, value is Torrent.
        // We need to update the torrent object with matching ID.
        const key = Object.keys(state.torrents).find(k => state.torrents[Number(k)].id === id);
        if (key) {
            const index = Number(key);
            return {
                torrents: {
                    ...state.torrents,
                    [index]: {
                        ...state.torrents[index],
                        ...changes
                    }
                }
            };
        }
        return state;
    }),

    setLoading: (isLoading) => set({ isLoading }),
    setError: (error) => set({ error }),
}));
