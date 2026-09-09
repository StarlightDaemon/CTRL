import { describe, it, expect, beforeEach } from 'vitest';
import { useTorrentStore, selectTorrentAtIndex } from '@/stores/useTorrentStore';
import { initialConnectionState, emptyStats, type SnapshotMessage } from '@/shared/api/messaging/protocol';
import type { Torrent } from '@/entities/torrent/model/Torrent';

const t = (id: string, name = id): Torrent => ({
    id, name, status: 'downloading', progress: 0, size: 0, downloadSpeed: 0, uploadSpeed: 0, eta: 0, savePath: '', addedDate: 0,
});

const snapshot = (items: Torrent[], start = 0, total = items.length, serverId = 'A'): SnapshotMessage => ({
    type: 'SNAPSHOT',
    serverId,
    generation: 1,
    revision: 1,
    total,
    start,
    items,
    connection: { ...initialConnectionState(), status: 'connected', serverId },
    stats: emptyStats(),
});

describe('useTorrentStore', () => {
    beforeEach(() => {
        useTorrentStore.getState().reset();
    });

    it('addresses rows by id through the window order', () => {
        useTorrentStore.getState().applySnapshot(snapshot([t('a'), t('b')], 10, 12));
        const state = useTorrentStore.getState();
        expect(selectTorrentAtIndex(10)(state)?.id).toBe('a');
        expect(selectTorrentAtIndex(11)(state)?.id).toBe('b');
        expect(selectTorrentAtIndex(9)(state)).toBeUndefined();
        expect(selectTorrentAtIndex(12)(state)).toBeUndefined();
        expect(state.totalCount).toBe(12);
    });

    it('replaces the whole window on reorder so no row shows another torrent\'s data', () => {
        const store = useTorrentStore.getState();
        store.applySnapshot(snapshot([t('a', 'A'), t('b', 'B')]));
        store.applySnapshot(snapshot([t('b', 'B'), t('a', 'A')]));
        const state = useTorrentStore.getState();
        expect(selectTorrentAtIndex(0)(state)?.name).toBe('B');
        expect(selectTorrentAtIndex(1)(state)?.name).toBe('A');
    });

    it('drops pending and failure markers when the server changes', () => {
        const store = useTorrentStore.getState();
        store.applySnapshot(snapshot([t('a')]));
        store.setPending('a', 'pause');
        store.setFailure('a', 'nope');
        store.applySnapshot(snapshot([t('a')], 0, 1, 'B'));
        expect(useTorrentStore.getState().pending).toEqual({});
        expect(useTorrentStore.getState().failures).toEqual({});
    });

    it('a cleared status empties the window but keeps the connection state', () => {
        const store = useTorrentStore.getState();
        store.applySnapshot(snapshot([t('a')]));
        store.applyStatus({ type: 'STATUS', connection: { ...initialConnectionState(), status: 'locked' }, stats: emptyStats(), cleared: true });
        const state = useTorrentStore.getState();
        expect(state.ids).toEqual([]);
        expect(state.totalCount).toBe(0);
        expect(state.connection.status).toBe('locked');
        expect(state.isLoading).toBe(false);
    });

    it('ignores duplicate ids from a misbehaving adapter', () => {
        useTorrentStore.getState().applySnapshot(snapshot([t('a', 'first'), t('a', 'second')]));
        const state = useTorrentStore.getState();
        expect(state.ids).toEqual(['a']);
        expect(state.byId.a.name).toBe('first');
    });
});
