import { create } from 'zustand';
import type { Torrent } from '../entities/torrent/model/Torrent';
import {
    emptyStats,
    initialConnectionState,
    type ConnectionState,
    type GlobalStats,
    type SnapshotMessage,
    type StatusMessage,
} from '@/shared/api/messaging/protocol';

export type PendingAction = 'pause' | 'resume' | 'remove';

interface TorrentWindowState {
    /** Server the visible window belongs to; null when nothing is shown. */
    serverId: string | null;
    generation: number;
    revision: number;
    /** Total number of torrents on the server. */
    totalCount: number;
    /** Absolute index of `ids[0]`. */
    windowStart: number;
    /** Ordered torrent ids for the visible window. */
    ids: string[];
    /** Torrents keyed by id. Only the visible window is held. */
    byId: Record<string, Torrent>;
    connection: ConnectionState;
    globalStats: GlobalStats;
    /** Commands awaiting a result, keyed by torrent id. */
    pending: Record<string, PendingAction>;
    /** Last command failure per torrent id. */
    failures: Record<string, string>;
    /** True until the first message from the background arrives. */
    isLoading: boolean;

    applySnapshot: (message: SnapshotMessage) => void;
    applyStatus: (message: StatusMessage) => void;
    setPending: (torrentId: string, action: PendingAction | null) => void;
    setFailure: (torrentId: string, message: string | null) => void;
    reset: () => void;
}

const initialState = () => ({
    serverId: null as string | null,
    generation: 0,
    revision: 0,
    totalCount: 0,
    windowStart: 0,
    ids: [] as string[],
    byId: {} as Record<string, Torrent>,
    connection: initialConnectionState(),
    globalStats: emptyStats(),
    pending: {} as Record<string, PendingAction>,
    failures: {} as Record<string, string>,
    isLoading: true,
});

/**
 * UI-side mirror of the background queue window.
 *
 * Rows are addressed by torrent id, never by array position, so reordering,
 * insertion and removal on the server cannot make a row show another
 * torrent's data. Every snapshot replaces the whole window; there is no
 * client-side patching.
 */
export const useTorrentStore = create<TorrentWindowState>((set) => ({
    ...initialState(),

    applySnapshot: (message) => set((state) => {
        const serverChanged = state.serverId !== message.serverId;
        const byId: Record<string, Torrent> = {};
        const ids: string[] = [];
        for (const torrent of message.items) {
            if (!torrent || typeof torrent.id !== 'string') continue;
            const id = torrent.id;
            if (byId[id]) continue; // defensive: adapters must not repeat ids
            byId[id] = torrent;
            ids.push(id);
        }
        return {
            serverId: message.serverId,
            generation: message.generation,
            revision: message.revision,
            totalCount: message.total,
            windowStart: message.start,
            ids,
            byId,
            connection: message.connection,
            globalStats: message.stats,
            pending: serverChanged ? {} : state.pending,
            failures: serverChanged ? {} : state.failures,
            isLoading: false,
        };
    }),

    applyStatus: (message) => set((state) => {
        if (message.cleared) {
            return {
                ...initialState(),
                connection: message.connection,
                globalStats: message.stats,
                isLoading: false,
            };
        }
        return {
            ...state,
            connection: message.connection,
            globalStats: message.stats,
            isLoading: false,
        };
    }),

    setPending: (torrentId, action) => set((state) => {
        const pending = { ...state.pending };
        if (action) pending[torrentId] = action;
        else delete pending[torrentId];
        return { pending };
    }),

    setFailure: (torrentId, message) => set((state) => {
        const failures = { ...state.failures };
        if (message) failures[torrentId] = message;
        else delete failures[torrentId];
        return { failures };
    }),

    reset: () => set(initialState()),
}));

/** Selector: the torrent shown at an absolute row index, if it is in the window. */
export const selectTorrentAtIndex = (index: number) => (state: TorrentWindowState): Torrent | undefined => {
    const offset = index - state.windowStart;
    if (offset < 0 || offset >= state.ids.length) return undefined;
    return state.byId[state.ids[offset]];
};
