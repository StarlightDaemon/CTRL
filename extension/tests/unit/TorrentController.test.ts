import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TorrentController, type PortLike } from '@/features/torrent-control/services/TorrentController';
import { ResolutionState, type ResolvedServers } from '@/shared/api/server/ServerResolver';
import type { ITorrentClient } from '@/entities/client/model/ITorrentClient';
import type { ServerConfig } from '@/shared/lib/types';
import type { Torrent } from '@/entities/torrent/model/Torrent';
import type { PortClientMessage, PortServerMessage, SnapshotMessage, StatusMessage } from '@/shared/api/messaging/protocol';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

function torrent(id: string, overrides: Partial<Torrent> = {}): Torrent {
    return {
        id,
        name: `Torrent ${id}`,
        status: 'downloading',
        progress: 10,
        size: 1000,
        downloadSpeed: 100,
        uploadSpeed: 10,
        eta: 60,
        savePath: '/dl',
        addedDate: 0,
        ...overrides,
    };
}

function server(id: string, name = id): ServerConfig {
    return {
        id,
        name,
        application: 'transmission',
        type: 'transmission',
        hostname: `http://${id}.example:9091/`,
        directories: [],
        clientOptions: {},
    };
}

/** A client whose getTorrents() resolves only when the test says so. */
class FakeClient implements ITorrentClient {
    public pending: Array<(value: Torrent[] | Error) => void> = [];
    public calls = { pause: [] as string[], resume: [] as string[], remove: [] as Array<[string, boolean | undefined]>, add: [] as Array<[string, unknown]> };
    public auto: Torrent[] | Error | null = null;

    constructor(public readonly label: string) { }

    login = vi.fn(async () => { });
    logout = vi.fn(async () => { });
    getTorrents = vi.fn((): Promise<Torrent[]> => {
        if (this.auto) {
            return this.auto instanceof Error ? Promise.reject(this.auto) : Promise.resolve(this.auto);
        }
        return new Promise((resolve, reject) => {
            this.pending.push((value) => (value instanceof Error ? reject(value) : resolve(value)));
        });
    });
    /** Resolve the oldest pending getTorrents() call. */
    resolveNext(value: Torrent[] | Error) {
        const next = this.pending.shift();
        if (!next) throw new Error(`no pending getTorrents on ${this.label}`);
        next(value);
    }
    addTorrentUrl = vi.fn(async (url: string, options?: unknown) => { this.calls.add.push([url, options]); });
    addTorrentFile = vi.fn(async () => { });
    pauseTorrent = vi.fn(async (id: string) => { this.calls.pause.push(id); });
    resumeTorrent = vi.fn(async (id: string) => { this.calls.resume.push(id); });
    removeTorrent = vi.fn(async (id: string, deleteData?: boolean) => { this.calls.remove.push([id, deleteData]); });
    testConnection = vi.fn(async () => ({ connected: true }));
    ping = vi.fn(async () => 1);
    getCategories = vi.fn(async () => []);
    setCategory = vi.fn(async () => { });
    getTags = vi.fn(async () => []);
    addTags = vi.fn(async () => { });
    removeTags = vi.fn(async () => { });
}

class FakePort implements PortLike {
    public sent: PortServerMessage[] = [];
    private messageListeners: Array<(m: PortClientMessage) => void> = [];
    private disconnectListeners: Array<() => void> = [];
    public closed = false;

    postMessage(message: PortServerMessage) {
        if (this.closed) throw new Error('port closed');
        this.sent.push(message);
    }
    onMessage = { addListener: (cb: (m: PortClientMessage) => void) => { this.messageListeners.push(cb); } };
    onDisconnect = { addListener: (cb: () => void) => { this.disconnectListeners.push(cb); } };

    /** Simulate the UI sending a message. */
    send(message: PortClientMessage) { this.messageListeners.forEach((l) => l(message)); }
    disconnect() { this.closed = true; this.disconnectListeners.forEach((l) => l()); }
    lastSnapshot(): SnapshotMessage | undefined {
        return [...this.sent].reverse().find((m): m is SnapshotMessage => m.type === 'SNAPSHOT');
    }
    last(): PortServerMessage | undefined { return this.sent[this.sent.length - 1]; }
    snapshots(): SnapshotMessage[] { return this.sent.filter((m): m is SnapshotMessage => m.type === 'SNAPSHOT'); }
}

interface Harness {
    controller: TorrentController;
    clients: Map<string, FakeClient>;
    setServers: (servers: ServerConfig[], activeIndex: number) => void;
    setResolution: (state: ResolutionState) => void;
    persisted: { value: unknown };
    permissions: Set<string>;
    addPaused: { value: boolean };
}

function harness(): Harness {
    const clients = new Map<string, FakeClient>();
    let resolution: ResolvedServers = { state: ResolutionState.OK, servers: [], activeServer: null };
    const persisted = { value: undefined as unknown };
    const permissions = new Set<string>();
    const addPaused = { value: false };

    const controller = new TorrentController({
        resolve: async () => resolution,
        createClient: async (config) => {
            const existing = clients.get(config.id as string);
            if (existing) return existing;
            const client = new FakeClient(config.id as string);
            clients.set(config.id as string, client);
            return client;
        },
        hasHostPermission: async (url) => permissions.size === 0 || permissions.has(url),
        getSettings: async () => ({ ...DEFAULT_OPTIONS, globals: { ...DEFAULT_OPTIONS.globals, addPaused: addPaused.value } }),
        persist: (snapshot) => { persisted.value = snapshot; },
        now: () => 1000,
    });

    return {
        controller,
        clients,
        persisted,
        permissions,
        addPaused,
        setServers: (servers, activeIndex) => {
            resolution = { state: ResolutionState.OK, servers, activeServer: servers[activeIndex] ?? null };
        },
        setResolution: (state) => {
            resolution = { state, servers: [], activeServer: null };
        },
    };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------

describe('TorrentController — server identity and stale responses', () => {
    let h: Harness;
    const A = server('A');
    const B = server('B');

    beforeEach(() => {
        h = harness();
    });

    it('discards a delayed result from server A that completes after switching to server B', async () => {
        h.setServers([A, B], 0);
        const port = new FakePort();
        h.controller.attachPort(port);

        const pollA = h.controller.refresh();
        await flush();
        const clientA = h.clients.get('A')!;
        expect(clientA.pending).toHaveLength(1);

        // Switch the active server to B while A's poll is still in flight.
        h.setServers([A, B], 1);
        h.controller.invalidate('options');
        const pollB = h.controller.refresh(); // coalesces onto the in-flight poll, then re-runs
        // Let A's slow response arrive now.
        clientA.resolveNext([torrent('7', { name: 'from A' })]);
        await pollA;
        await flush();
        const clientB = h.clients.get('B')!;
        clientB.resolveNext([torrent('7', { name: 'from B' })]);
        await pollB;
        await flush();

        const snapshot = port.lastSnapshot();
        expect(snapshot).toBeDefined();
        expect(snapshot!.serverId).toBe('B');
        expect(snapshot!.items.map((t) => t.name)).toEqual(['from B']);
        // A's data must never have been published under B (or at all after the switch).
        const publishedFromA = port.snapshots().some((s) => s.items.some((t) => t.name === 'from A'));
        expect(publishedFromA).toBe(false);
        expect(h.controller.getConnection().serverId).toBe('B');
    });

    it('routes a command from a stale row to the row\'s own server, never the active one', async () => {
        h.setServers([A, B], 0);
        for (const s of [A, B]) {
            h.clients.set(s.id!, Object.assign(new FakeClient(s.id!), { auto: [torrent('7')] }));
        }
        await h.controller.refresh();

        // User switches to B; a stale row from A (torrent 7) is still on screen.
        h.setServers([A, B], 1);
        h.controller.invalidate('options');
        await h.controller.refresh();

        const result = await h.controller.runTorrentCommand({ type: 'REMOVE_TORRENT', serverId: 'A', torrentId: '7', deleteData: false });
        expect(result.ok).toBe(true);
        expect(h.clients.get('A')!.calls.remove).toEqual([['7', false]]);
        expect(h.clients.get('B')!.calls.remove).toEqual([]);
    });

    it('fails closed when a command names a server that no longer exists', async () => {
        h.setServers([B], 0);
        h.clients.set('B', Object.assign(new FakeClient('B'), { auto: [torrent('7')] }));
        await h.controller.refresh();

        const result = await h.controller.runTorrentCommand({ type: 'REMOVE_TORRENT', serverId: 'A', torrentId: '7' });
        expect(result.ok).toBe(false);
        expect(result.errorType).toBe('SERVER_NOT_FOUND');
        expect(h.clients.get('B')!.calls.remove).toEqual([]);
    });

    it('refuses destructive commands without a server identity', async () => {
        h.setServers([A], 0);
        const result = await h.controller.runTorrentCommand({ type: 'REMOVE_TORRENT', serverId: '', torrentId: '7' });
        expect(result.ok).toBe(false);
        expect(result.errorType).toBe('MISSING_SERVER_ID');
    });

    it('keeps overlapping numeric ids on A and B apart', async () => {
        h.setServers([A, B], 0);
        h.clients.set('A', Object.assign(new FakeClient('A'), { auto: [torrent('1', { name: 'A-one' })] }));
        h.clients.set('B', Object.assign(new FakeClient('B'), { auto: [torrent('1', { name: 'B-one' })] }));
        const port = new FakePort();
        h.controller.attachPort(port);

        await h.controller.refresh();
        expect(port.lastSnapshot()!.items[0].name).toBe('A-one');

        const pause = await h.controller.runTorrentCommand({ type: 'PAUSE_TORRENT', serverId: 'B', torrentId: '1' });
        expect(pause.ok).toBe(true);
        expect(h.clients.get('B')!.calls.pause).toEqual(['1']);
        expect(h.clients.get('A')!.calls.pause).toEqual([]);
    });

    it('runs only one poll at a time and coalesces refresh requests', async () => {
        h.setServers([A], 0);
        const p1 = h.controller.refresh();
        const p2 = h.controller.refresh();
        const p3 = h.controller.refresh();
        await flush();
        const client = h.clients.get('A')!;
        expect(client.getTorrents).toHaveBeenCalledTimes(1);
        client.resolveNext([]);
        await p1; await p2; await p3;
        await flush();
        // The coalesced request triggers exactly one follow-up poll.
        expect(client.getTorrents).toHaveBeenCalledTimes(2);
        client.resolveNext([]);
    });

    it('drops cached clients and re-creates them when the configuration changes', async () => {
        h.setServers([A], 0);
        h.clients.set('A', Object.assign(new FakeClient('A'), { auto: [] }));
        await h.controller.refresh();
        const original = h.clients.get('A')!;

        // Changing the password changes the fingerprint; the old client must not be reused.
        h.setServers([{ ...A, password: 'new' }], 0);
        h.clients.delete('A');
        h.controller.invalidate('vault-data');
        const poll = h.controller.refresh();
        await flush();
        const fresh = h.clients.get('A')!;
        expect(fresh).toBeDefined();
        expect(fresh).not.toBe(original);
        fresh.resolveNext([]);
        await poll;
        expect(original.getTorrents).toHaveBeenCalledTimes(1);
    });
});

describe('TorrentController — snapshots preserve identity', () => {
    let h: Harness;
    const A = server('A');

    beforeEach(() => {
        h = harness();
        h.setServers([A], 0);
    });

    const publish = async (list: Torrent[]) => {
        const client = h.clients.get('A') ?? (await h.controller['deps'].createClient(A) as FakeClient);
        client.auto = list;
        await h.controller.refresh();
    };

    it.each([
        ['reorder', [torrent('a', { progress: 10 }), torrent('b', { progress: 20 })], [torrent('b', { progress: 25 }), torrent('a', { progress: 10 })]],
        ['replacement', [torrent('a')], [torrent('b')]],
        ['insertion', [torrent('a'), torrent('c')], [torrent('a'), torrent('b'), torrent('c')]],
        ['deletion', [torrent('a'), torrent('b'), torrent('c')], [torrent('a'), torrent('c')]],
        ['metadata change', [torrent('a', { status: 'downloading' })], [torrent('a', { status: 'paused' })]],
    ])('%s: the delivered window equals the server list', async (_label, before, after) => {
        const port = new FakePort();
        h.controller.attachPort(port);
        await publish(before);
        await publish(after);
        const snapshot = port.lastSnapshot()!;
        expect(snapshot.total).toBe(after.length);
        expect(snapshot.items).toEqual(after);
        expect(snapshot.items.map((t) => t.id)).toEqual(after.map((t) => t.id));
    });

    it('sends every subscriber its own viewport', async () => {
        const p1 = new FakePort();
        const p2 = new FakePort();
        h.controller.attachPort(p1);
        h.controller.attachPort(p2);
        p1.send({ type: 'SET_VIEWPORT', start: 0, end: 2 });
        p2.send({ type: 'SET_VIEWPORT', start: 2, end: 4 });
        await publish([torrent('a'), torrent('b'), torrent('c'), torrent('d'), torrent('e')]);
        expect(p1.lastSnapshot()!.items.map((t) => t.id)).toEqual(['a', 'b']);
        expect(p1.lastSnapshot()!.start).toBe(0);
        expect(p2.lastSnapshot()!.items.map((t) => t.id)).toEqual(['c', 'd']);
        expect(p2.lastSnapshot()!.start).toBe(2);
        expect(p1.lastSnapshot()!.total).toBe(5);
        expect(p2.lastSnapshot()!.total).toBe(5);
    });

    it('gives a new subscriber an initial snapshot immediately', async () => {
        await publish([torrent('a'), torrent('b')]);
        const late = new FakePort();
        h.controller.attachPort(late);
        const snapshot = late.lastSnapshot();
        expect(snapshot).toBeDefined();
        expect(snapshot!.items.map((t) => t.id)).toEqual(['a', 'b']);
    });

    it('propagates a total change that happens outside the viewport', async () => {
        const port = new FakePort();
        h.controller.attachPort(port);
        port.send({ type: 'SET_VIEWPORT', start: 0, end: 1 });
        await publish([torrent('a')]);
        expect(port.lastSnapshot()!.total).toBe(1);
        await publish([torrent('a'), torrent('b')]);
        expect(port.lastSnapshot()!.total).toBe(2);
        expect(port.lastSnapshot()!.items.map((t) => t.id)).toEqual(['a']);
    });

    it('clamps a viewport past the end of the list', async () => {
        const port = new FakePort();
        h.controller.attachPort(port);
        port.send({ type: 'SET_VIEWPORT', start: 10, end: 20 });
        await publish([torrent('a')]);
        const snapshot = port.lastSnapshot()!;
        expect(snapshot.start).toBe(1);
        expect(snapshot.items).toEqual([]);
        expect(snapshot.total).toBe(1);
    });

    it('drops a subscriber whose port is closed', async () => {
        const port = new FakePort();
        h.controller.attachPort(port);
        expect(h.controller.subscriberCount()).toBe(1);
        port.disconnect();
        expect(h.controller.subscriberCount()).toBe(0);
    });
});

describe('TorrentController — restart, hydration and connection state', () => {
    let h: Harness;
    const A = server('A', 'Alpha');

    beforeEach(() => {
        h = harness();
    });

    it('uses a persisted snapshot for the same server as stale data until a fresh poll succeeds', async () => {
        h.setServers([A], 0);
        h.controller.hydrate({ serverId: 'A', torrents: [torrent('old')], savedAt: 1 });
        const port = new FakePort();
        h.controller.attachPort(port);
        const poll = h.controller.refresh();
        await flush();
        // While the poll is pending the stale snapshot is shown.
        const stale = port.lastSnapshot();
        expect(stale?.items.map((t) => t.id)).toEqual(['old']);
        expect(stale?.connection.status).toBe('stale');
        h.clients.get('A')!.resolveNext([torrent('new')]);
        await poll;
        expect(port.lastSnapshot()!.items.map((t) => t.id)).toEqual(['new']);
        expect(port.lastSnapshot()!.connection.status).toBe('connected');
    });

    it('ignores a persisted snapshot that belongs to a different server', async () => {
        h.setServers([A], 0);
        h.controller.hydrate({ serverId: 'B', torrents: [torrent('foreign')], savedAt: 1 });
        const port = new FakePort();
        h.controller.attachPort(port);
        const poll = h.controller.refresh();
        await flush();
        expect(port.snapshots().some((s) => s.items.some((t) => t.id === 'foreign'))).toBe(false);
        h.clients.get('A')!.resolveNext([]);
        await poll;
    });

    it('reports locked / uninitialized / no_servers / corrupted truthfully and clears the queue', async () => {
        h.setServers([A], 0);
        h.clients.set('A', Object.assign(new FakeClient('A'), { auto: [torrent('a')] }));
        const port = new FakePort();
        h.controller.attachPort(port);
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('connected');

        for (const [state, status] of [
            [ResolutionState.LOCKED, 'locked'],
            [ResolutionState.UNINITIALIZED, 'uninitialized'],
            [ResolutionState.NO_SERVERS, 'no_servers'],
            [ResolutionState.CORRUPTED, 'vault_corrupted'],
        ] as const) {
            h.setResolution(state);
            h.controller.invalidate('test');
            await h.controller.refresh();
            expect(h.controller.getConnection().status).toBe(status);
            const last = port.last() as StatusMessage;
            expect(last.type).toBe('STATUS');
            expect(last.cleared).toBe(true);
            expect(h.controller.getSnapshotTorrents()).toBeNull();
        }
    });

    it('reports permission_missing without contacting the server', async () => {
        h.setServers([A], 0);
        h.permissions.add('http://somewhere-else/');
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('permission_missing');
        expect(h.controller.getConnection().lastErrorType).toBe('PERMISSION_MISSING');
        expect(h.clients.get('A')).toBeUndefined();
    });

    it('reports a revoked permission as revoked, drops the queue, and recovers once access is granted again', async () => {
        h.setServers([A], 0);
        h.permissions.add(A.hostname);
        const client = Object.assign(new FakeClient('A'), { auto: [torrent('a')] as Torrent[] | Error });
        h.clients.set('A', client);
        const port = new FakePort();
        h.controller.attachPort(port);
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('connected');

        // The user removes site access from the browser: background gets onRemoved.
        // (The harness treats an empty set as "everything permitted", so keep an unrelated entry.)
        h.permissions.delete(A.hostname);
        h.permissions.add('http://unrelated.example/');
        h.controller.notePermissionRemoved();
        h.controller.invalidate('permission-removed');
        await h.controller.refresh();

        const connection = h.controller.getConnection();
        expect(connection.status).toBe('permission_missing');
        expect(connection.lastErrorType).toBe('PERMISSION_REVOKED');
        expect(connection.lastError).toContain('removed in the browser');
        expect(h.controller.getSnapshotTorrents()).toBeNull();
        const last = port.last() as StatusMessage;
        expect(last.type).toBe('STATUS');
        expect(last.cleared).toBe(true);
        expect(client.getTorrents).toHaveBeenCalledTimes(1);

        // Granted again (onAdded → invalidate → refresh): back to live data, flag cleared.
        h.permissions.add(A.hostname);
        h.controller.invalidate('permission-added');
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('connected');

        // A later, ordinary missing permission is no longer described as revoked.
        h.permissions.delete(A.hostname);
        h.controller.invalidate('test');
        await h.controller.refresh();
        expect(h.controller.getConnection().lastErrorType).toBe('PERMISSION_MISSING');
    });

    it('marks data stale when a later poll fails and unavailable when none succeeded', async () => {
        h.setServers([A], 0);
        const client = Object.assign(new FakeClient('A'), { auto: new Error('Failed to fetch') as Torrent[] | Error });
        h.clients.set('A', client);
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('unavailable');

        client.auto = [torrent('a')];
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('connected');

        client.auto = new Error('Failed to fetch');
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('stale');
        expect(h.controller.getSnapshotTorrents()!.map((t) => t.id)).toEqual(['a']);
    });

    it('reports auth_failed and clears the queue on an authentication error', async () => {
        h.setServers([A], 0);
        const client = Object.assign(new FakeClient('A'), { auto: [torrent('a')] as Torrent[] | Error });
        h.clients.set('A', client);
        await h.controller.refresh();
        client.auto = new Error('Authentication Failed (401 Unauthorized)');
        await h.controller.refresh();
        expect(h.controller.getConnection().status).toBe('auth_failed');
        expect(h.controller.getSnapshotTorrents()).toBeNull();
    });

    it('persists successful snapshots with their server id', async () => {
        h.setServers([A], 0);
        h.clients.set('A', Object.assign(new FakeClient('A'), { auto: [torrent('a')] }));
        await h.controller.refresh();
        expect(h.persisted.value).toMatchObject({ serverId: 'A', torrents: [expect.objectContaining({ id: 'a' })] });
    });
});

describe('TorrentController — add-paused policy', () => {
    const A = server('A');

    it('applies the global default from every entrypoint and honours explicit overrides', async () => {
        const h = harness();
        h.setServers([A], 0);
        h.clients.set('A', Object.assign(new FakeClient('A'), { auto: [] }));
        h.addPaused.value = true;

        await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?xt=urn:btih:1' });
        await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?xt=urn:btih:2', options: { paused: false } });
        h.addPaused.value = false;
        await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?xt=urn:btih:3', options: { label: 'tv' } });

        const calls = h.clients.get('A')!.calls.add;
        expect(calls[0][1]).toMatchObject({ paused: true });
        expect(calls[1][1]).toMatchObject({ paused: false });
        expect(calls[2][1]).toMatchObject({ paused: false, label: 'tv' });
    });

    it('targets an explicit server id and rejects an unknown one', async () => {
        const h = harness();
        const B = server('B');
        h.setServers([A, B], 0);
        for (const s of [A, B]) h.clients.set(s.id!, Object.assign(new FakeClient(s.id!), { auto: [] }));

        const ok = await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?x', serverId: 'B' });
        expect(ok.ok).toBe(true);
        expect(h.clients.get('B')!.calls.add).toHaveLength(1);
        expect(h.clients.get('A')!.calls.add).toHaveLength(0);

        const bad = await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?x', serverId: 'nope' });
        expect(bad.ok).toBe(false);
        expect(bad.errorType).toBe('SERVER_NOT_FOUND');
    });

    it('refuses to add when the vault is locked', async () => {
        const h = harness();
        h.setResolution(ResolutionState.LOCKED);
        const result = await h.controller.addTorrent({ type: 'ADD_TORRENT_URL', url: 'magnet:?x' });
        expect(result.ok).toBe(false);
        expect(result.errorType).toBe('LOCKED');
    });
});
