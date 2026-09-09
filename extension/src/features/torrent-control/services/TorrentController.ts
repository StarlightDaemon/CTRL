import type { ITorrentClient } from '@/entities/client/model/ITorrentClient';
import type { ServerConfig, AppSettings } from '@/shared/lib/types';
import type { Torrent } from '@/entities/torrent/model/Torrent';
import { ResolutionState, type ResolvedServers } from '@/shared/api/server/ServerResolver';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';
import { serverFingerprint } from '@/entities/server/lib/serverIdentity';
import {
    DEFAULT_VIEWPORT_SIZE,
    computeStats,
    emptyStats,
    initialConnectionState,
    type AddTorrentRequest,
    type CommandResult,
    type ConnectionState,
    type ConnectionStatus,
    type GlobalStats,
    type PersistedSnapshot,
    type PortClientMessage,
    type PortServerMessage,
    type RuntimeRequest,
    type StateResponse,
    type TestConnectionResponse,
    type TorrentCommandRequest,
} from '@/shared/api/messaging/protocol';

/**
 * Minimal port surface the controller needs. `chrome.runtime.Port` satisfies it;
 * tests supply an in-memory implementation.
 */
export interface PortLike {
    postMessage(message: PortServerMessage): void;
    onMessage: { addListener(cb: (message: PortClientMessage) => void): void };
    onDisconnect: { addListener(cb: () => void): void };
}

export interface ControllerDeps {
    /** Resolves vault + settings into the current server list and active server. */
    resolve: () => Promise<ResolvedServers>;
    /** Creates an adapter for a configuration. */
    createClient: (config: ServerConfig) => Promise<ITorrentClient>;
    /** Whether the per-origin host permission for this URL is granted. */
    hasHostPermission: (url: string) => Promise<boolean>;
    /** Reads global settings (add-paused default etc). */
    getSettings: () => Promise<AppSettings | null>;
    /** Persists the latest snapshot for recovery after a background restart. */
    persist?: (snapshot: PersistedSnapshot | null) => void;
    now?: () => number;
    log?: (message: string, ...rest: unknown[]) => void;
}

export interface ControllerStateEvent {
    connection: ConnectionState;
    stats: GlobalStats;
    torrents: Torrent[] | null;
}

interface Subscriber {
    port: PortLike;
    start: number;
    end: number;
    /** Revision of the last snapshot sent, so unchanged data is not re-sent. */
    sentRevision: number;
    sentStart: number;
    sentEnd: number;
}

interface CachedClient {
    fingerprint: string;
    client: ITorrentClient;
}

interface Snapshot {
    serverId: string;
    torrents: Torrent[];
}

const AUTH_ERROR_TYPES = new Set([
    'AUTH_FAILED',
    'UNAUTHORIZED',
    'IP_BANNED',
    'WHITELIST_BLOCKED',
    'INVALID_PARAMS',
    'INVALID_CREDENTIALS',
]);

/**
 * Owns all background state for the torrent queue.
 *
 * Invariants enforced here (see docs/release/v1/V1_SCOPE.md, Phase 1):
 *
 * - There is at most one poll in flight. Additional refresh requests coalesce.
 * - Every poll captures the generation it started in. If the generation moved
 *   on (server switch, vault lock, settings change) before the result arrived,
 *   the result is discarded. Generation N data never mutates generation N+1.
 * - Snapshots and status carry the server id they describe.
 * - Commands that name a torrent must name its server. The command is routed
 *   to that server's client, whatever the active server is, and fails closed
 *   if the server no longer exists.
 * - Each subscriber has its own viewport and receives an initial snapshot as
 *   soon as it attaches. Total-count changes reach every subscriber even when
 *   their visible slice is unchanged.
 */
export class TorrentController {
    private generation = 0;
    private revision = 0;
    private activeServerId: string | null = null;
    private snapshot: Snapshot | null = null;
    private pendingHydration: PersistedSnapshot | null = null;
    private connection: ConnectionState = initialConnectionState();
    private stats: GlobalStats = emptyStats();

    private subscribers = new Set<Subscriber>();
    private clients = new Map<string, CachedClient>();
    private inFlight: Promise<void> | null = null;
    private refreshRequested = false;
    private stateListeners = new Set<(event: ControllerStateEvent) => void>();

    private readonly now: () => number;
    private readonly log: (message: string, ...rest: unknown[]) => void;

    constructor(private readonly deps: ControllerDeps) {
        this.now = deps.now ?? (() => Date.now());
        this.log = deps.log ?? (() => { });
    }

    // ------------------------------------------------------------------
    // Observation
    // ------------------------------------------------------------------

    getConnection(): ConnectionState {
        return this.connection;
    }

    getStats(): GlobalStats {
        return this.stats;
    }

    getGeneration(): number {
        return this.generation;
    }

    getSnapshotTorrents(): Torrent[] | null {
        return this.snapshot?.torrents ?? null;
    }

    subscriberCount(): number {
        return this.subscribers.size;
    }

    onStateChange(listener: (event: ControllerStateEvent) => void): () => void {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    /**
     * Offers a snapshot persisted by a previous background instance. It is only
     * used once the active server has been resolved and matches; until a fresh
     * poll succeeds the data is reported as `stale`.
     */
    hydrate(persisted: PersistedSnapshot | null): void {
        if (!persisted || !persisted.serverId || !Array.isArray(persisted.torrents)) return;
        this.pendingHydration = persisted;
    }

    /**
     * Marks all current state as superseded. In-flight polls started before
     * this call will be discarded when they complete. Cached clients are
     * dropped so credentials/configuration changes take effect immediately.
     */
    invalidate(reason: string): void {
        this.generation++;
        this.clients.clear();
        this.log(`[Controller] invalidate(${reason}) -> generation ${this.generation}`);
        if (this.connection.status === 'connected' || this.connection.status === 'stale') {
            this.setConnection({ status: 'connecting' });
        }
    }

    // ------------------------------------------------------------------
    // Subscriptions
    // ------------------------------------------------------------------

    attachPort(port: PortLike): void {
        const subscriber: Subscriber = {
            port,
            start: 0,
            end: DEFAULT_VIEWPORT_SIZE,
            sentRevision: -1,
            sentStart: -1,
            sentEnd: -1,
        };
        this.subscribers.add(subscriber);

        port.onMessage.addListener((message) => {
            if (!message || typeof message !== 'object') return;
            if (message.type === 'SET_VIEWPORT') {
                const start = Math.max(0, Math.floor(Number(message.start) || 0));
                const requestedEnd = Math.floor(Number(message.end));
                const end = Number.isFinite(requestedEnd) && requestedEnd > start ? requestedEnd : start + DEFAULT_VIEWPORT_SIZE;
                subscriber.start = start;
                subscriber.end = end;
                this.sendToSubscriber(subscriber);
            } else if (message.type === 'REFRESH') {
                void this.refresh();
            }
        });

        port.onDisconnect.addListener(() => {
            this.subscribers.delete(subscriber);
        });

        // Initial snapshot (or status) for the new subscriber.
        this.sendToSubscriber(subscriber);
    }

    // ------------------------------------------------------------------
    // Polling
    // ------------------------------------------------------------------

    /** Single-flight refresh. Concurrent callers share the in-flight poll. */
    refresh(): Promise<void> {
        if (this.inFlight) {
            this.refreshRequested = true;
            return this.inFlight;
        }
        this.inFlight = this.pollOnce()
            .catch((error) => {
                this.log('[Controller] poll failed unexpectedly', error);
            })
            .finally(() => {
                this.inFlight = null;
                if (this.refreshRequested) {
                    this.refreshRequested = false;
                    void this.refresh();
                }
            });
        return this.inFlight;
    }

    private async pollOnce(): Promise<void> {
        const startedGeneration = this.generation;
        const resolved = await this.deps.resolve();
        if (startedGeneration !== this.generation) return;

        if (resolved.state !== ResolutionState.OK || !resolved.activeServer) {
            this.applyNonOkResolution(resolved.state);
            return;
        }

        const server = resolved.activeServer;
        const serverId = server.id;
        if (!serverId) {
            // Servers are normalised by the vault layer; a missing id means the
            // resolver bypassed it. Fail closed rather than guess.
            this.clearSnapshot();
            this.setConnection({ status: 'invalid_config', serverId: null, serverName: server.name, lastError: 'Server entry has no identity.' });
            this.broadcastStatus(true);
            return;
        }

        let generation = startedGeneration;
        if (this.activeServerId !== serverId) {
            // Active server changed since the last poll. Everything that belonged
            // to the previous server is now stale by definition.
            this.activeServerId = serverId;
            this.generation++;
            generation = this.generation;
            this.clients.clear();
            this.clearSnapshot();
            this.setConnection({ status: 'connecting', serverId, serverName: server.name, lastError: null, lastErrorType: null });
            this.broadcastStatus(true);
        }

        // Offer hydrated data as a stale placeholder while the first poll runs.
        if (!this.snapshot && this.pendingHydration && this.pendingHydration.serverId === serverId) {
            this.snapshot = { serverId, torrents: this.pendingHydration.torrents };
            this.revision++;
            this.stats = computeStats(this.snapshot.torrents);
            this.setConnection({ status: 'stale', serverId, serverName: server.name });
            this.broadcastSnapshot();
        }
        this.pendingHydration = null;

        const permitted = await this.deps.hasHostPermission(server.hostname);
        if (generation !== this.generation) return;
        if (!permitted) {
            this.clearSnapshot();
            this.setConnection({
                status: 'permission_missing',
                serverId,
                serverName: server.name,
                lastAttemptAt: this.now(),
                lastError: 'CTRL has not been granted access to this server address.',
                lastErrorType: 'PERMISSION_MISSING',
            });
            this.broadcastStatus(true);
            return;
        }

        let client: ITorrentClient;
        try {
            client = await this.getClient(server);
        } catch (error) {
            if (generation !== this.generation) return;
            this.setConnection({
                status: 'invalid_config',
                serverId,
                serverName: server.name,
                lastAttemptAt: this.now(),
                lastError: error instanceof Error ? error.message : String(error),
                lastErrorType: 'INVALID_CONFIG',
            });
            this.broadcastStatus(true);
            return;
        }
        if (generation !== this.generation) return;

        const attemptedAt = this.now();
        if (this.connection.status !== 'connected' && this.connection.status !== 'stale') {
            this.setConnection({ status: 'connecting', serverId, serverName: server.name, lastAttemptAt: attemptedAt });
            this.broadcastStatus(false);
        }

        let torrents: Torrent[];
        try {
            torrents = await client.getTorrents();
        } catch (error) {
            if (generation !== this.generation) {
                this.log('[Controller] discarding failed poll from superseded generation');
                return;
            }
            const classified = classifyFailure(error, client);
            const hasData = this.snapshot !== null && this.snapshot.serverId === serverId;
            let status: ConnectionStatus;
            if (classified.isAuth) {
                status = 'auth_failed';
                this.clearSnapshot();
            } else {
                status = hasData ? 'stale' : 'unavailable';
            }
            this.setConnection({
                status,
                serverId,
                serverName: server.name,
                lastAttemptAt: attemptedAt,
                lastError: classified.message,
                lastErrorType: classified.type,
            });
            this.broadcastStatus(!hasData || classified.isAuth);
            return;
        }

        if (generation !== this.generation) {
            this.log('[Controller] discarding poll result from superseded generation');
            return;
        }

        this.snapshot = { serverId, torrents: Array.isArray(torrents) ? torrents : [] };
        this.revision++;
        this.stats = computeStats(this.snapshot.torrents);
        this.setConnection({
            status: 'connected',
            serverId,
            serverName: server.name,
            lastAttemptAt: attemptedAt,
            lastSuccessAt: this.now(),
            lastError: null,
            lastErrorType: null,
        });
        this.deps.persist?.({ serverId, torrents: this.snapshot.torrents, savedAt: this.now() });
        this.broadcastSnapshot();
    }

    private applyNonOkResolution(state: ResolutionState): void {
        const status: ConnectionStatus =
            state === ResolutionState.UNINITIALIZED ? 'uninitialized'
                : state === ResolutionState.LOCKED ? 'locked'
                    : state === ResolutionState.CORRUPTED ? 'vault_corrupted'
                        : state === ResolutionState.NO_SERVERS ? 'no_servers'
                            : 'invalid_config';
        if (this.activeServerId !== null) {
            this.activeServerId = null;
            this.generation++;
            this.clients.clear();
        }
        this.clearSnapshot();
        this.setConnection({ status, serverId: null, serverName: null, lastError: null, lastErrorType: null });
        this.broadcastStatus(true);
    }

    private clearSnapshot(): void {
        if (this.snapshot) {
            this.snapshot = null;
            this.revision++;
            this.deps.persist?.(null);
        }
        this.stats = emptyStats();
    }

    private setConnection(patch: Partial<ConnectionState>): void {
        this.connection = { ...this.connection, ...patch, generation: this.generation };
    }

    // ------------------------------------------------------------------
    // Clients
    // ------------------------------------------------------------------

    private async getClient(server: ServerConfig): Promise<ITorrentClient> {
        const id = server.id;
        if (!id) throw new Error('Server entry has no identity.');
        const fingerprint = serverFingerprint(server);
        const cached = this.clients.get(id);
        if (cached && cached.fingerprint === fingerprint) return cached.client;
        const client = await this.deps.createClient(server);
        this.clients.set(id, { fingerprint, client });
        return client;
    }

    /**
     * Finds a server by id in the current configuration and returns its client.
     * Throws when the vault is unavailable or the server no longer exists.
     */
    private async getClientById(serverId: string): Promise<{ client: ITorrentClient; server: ServerConfig }> {
        const resolved = await this.deps.resolve();
        if (resolved.state === ResolutionState.LOCKED) throw new CommandError('Vault is locked.', 'LOCKED');
        if (resolved.state === ResolutionState.UNINITIALIZED) throw new CommandError('CTRL is not set up yet.', 'UNINITIALIZED');
        const server = resolved.servers.find((s) => s.id === serverId);
        if (!server) throw new CommandError('The server this torrent belongs to no longer exists.', 'SERVER_NOT_FOUND');
        if (!(await this.deps.hasHostPermission(server.hostname))) {
            throw new CommandError('CTRL has not been granted access to this server address.', 'PERMISSION_MISSING');
        }
        return { client: await this.getClient(server), server };
    }

    // ------------------------------------------------------------------
    // Commands
    // ------------------------------------------------------------------

    async handleRequest(request: RuntimeRequest): Promise<unknown> {
        switch (request.type) {
            case 'GET_STATE':
                return this.getState();
            case 'FORCE_REFRESH':
                await this.refresh();
                return { ok: true } satisfies CommandResult;
            case 'ADD_TORRENT_URL':
                return this.addTorrent(request);
            case 'PAUSE_TORRENT':
            case 'RESUME_TORRENT':
            case 'REMOVE_TORRENT':
                return this.runTorrentCommand(request);
            case 'TEST_CONNECTION':
                return this.testConnection(request.config);
            default:
                return { ok: false, error: `Unknown request type: ${String((request as { type?: unknown }).type)}` } satisfies CommandResult;
        }
    }

    async getState(): Promise<StateResponse> {
        const resolved = await this.deps.resolve();
        const servers = resolved.servers
            .filter((s) => typeof s.id === 'string')
            .map((s) => ({ id: s.id as string, name: s.name, type: s.type }));
        return {
            connection: this.connection,
            stats: this.stats,
            servers,
            activeServerId: resolved.activeServer?.id ?? null,
        };
    }

    async addTorrent(request: AddTorrentRequest): Promise<CommandResult> {
        if (!request.url || typeof request.url !== 'string') {
            return { ok: false, error: 'No torrent URL or magnet link was provided.', errorType: 'INVALID_INPUT' };
        }
        try {
            let serverId = request.serverId;
            if (!serverId) {
                const resolved = await this.deps.resolve();
                if (resolved.state === ResolutionState.LOCKED) throw new CommandError('Vault is locked.', 'LOCKED');
                if (resolved.state === ResolutionState.UNINITIALIZED) throw new CommandError('CTRL is not set up yet.', 'UNINITIALIZED');
                if (!resolved.activeServer?.id) throw new CommandError('No server is configured.', 'NO_SERVERS');
                serverId = resolved.activeServer.id;
            }
            const { client } = await this.getClientById(serverId);
            const settings = await this.deps.getSettings();
            const globalAddPaused = settings?.globals?.addPaused ?? false;
            const options = {
                ...(request.options ?? {}),
                paused: request.options?.paused ?? globalAddPaused,
            };
            await client.addTorrentUrl(request.url, options);
            void this.refresh();
            return { ok: true };
        } catch (error) {
            return failureResult(error);
        }
    }

    async runTorrentCommand(request: TorrentCommandRequest): Promise<CommandResult> {
        if (!request.serverId || typeof request.serverId !== 'string') {
            return { ok: false, error: 'Command is missing its server identity; refusing to guess a target.', errorType: 'MISSING_SERVER_ID' };
        }
        if (!request.torrentId || typeof request.torrentId !== 'string') {
            return { ok: false, error: 'Command is missing the torrent identity.', errorType: 'MISSING_TORRENT_ID' };
        }
        try {
            const { client } = await this.getClientById(request.serverId);
            switch (request.type) {
                case 'PAUSE_TORRENT':
                    await client.pauseTorrent(request.torrentId);
                    break;
                case 'RESUME_TORRENT':
                    await client.resumeTorrent(request.torrentId);
                    break;
                case 'REMOVE_TORRENT':
                    await client.removeTorrent(request.torrentId, request.deleteData === true);
                    break;
            }
            void this.refresh();
            return { ok: true };
        } catch (error) {
            return failureResult(error);
        }
    }

    async testConnection(config: ServerConfig): Promise<TestConnectionResponse> {
        try {
            const client = await this.deps.createClient(config);
            const result = await client.testConnection();
            return {
                connected: result.connected,
                error: result.error?.toUserMessage(),
                errorType: result.error?.type,
            };
        } catch (error) {
            const failure = failureResult(error);
            return { connected: false, error: failure.error, errorType: failure.errorType };
        }
    }

    // ------------------------------------------------------------------
    // Broadcasting
    // ------------------------------------------------------------------

    private sendToSubscriber(subscriber: Subscriber): void {
        if (!this.snapshot) {
            subscriber.sentRevision = this.revision;
            subscriber.sentStart = subscriber.start;
            subscriber.sentEnd = subscriber.end;
            this.safePost(subscriber, { type: 'STATUS', connection: this.connection, stats: this.stats, cleared: true });
            return;
        }
        const { torrents, serverId } = this.snapshot;
        const start = Math.min(Math.max(0, subscriber.start), torrents.length);
        const end = Math.min(Math.max(start, subscriber.end), torrents.length);
        subscriber.sentRevision = this.revision;
        subscriber.sentStart = subscriber.start;
        subscriber.sentEnd = subscriber.end;
        this.safePost(subscriber, {
            type: 'SNAPSHOT',
            serverId,
            generation: this.generation,
            revision: this.revision,
            total: torrents.length,
            start,
            items: torrents.slice(start, end),
            connection: this.connection,
            stats: this.stats,
        });
    }

    private broadcastSnapshot(): void {
        for (const subscriber of this.subscribers) {
            this.sendToSubscriber(subscriber);
        }
        this.emitState();
    }

    private broadcastStatus(cleared: boolean): void {
        for (const subscriber of this.subscribers) {
            if (cleared) {
                this.sendToSubscriber(subscriber);
            } else {
                this.safePost(subscriber, { type: 'STATUS', connection: this.connection, stats: this.stats });
            }
        }
        this.emitState();
    }

    private emitState(): void {
        const event: ControllerStateEvent = {
            connection: this.connection,
            stats: this.stats,
            torrents: this.snapshot?.torrents ?? null,
        };
        for (const listener of this.stateListeners) {
            try {
                listener(event);
            } catch (error) {
                this.log('[Controller] state listener failed', error);
            }
        }
    }

    private safePost(subscriber: Subscriber, message: PortServerMessage): void {
        try {
            subscriber.port.postMessage(message);
        } catch (error) {
            // The port is gone; drop the subscriber.
            this.log('[Controller] dropping unreachable subscriber', error);
            this.subscribers.delete(subscriber);
        }
    }
}

// ----------------------------------------------------------------------
// Failure classification
// ----------------------------------------------------------------------

export class CommandError extends Error {
    constructor(message: string, public readonly errorType: string) {
        super(message);
        this.name = 'CommandError';
    }
}

interface ClassifiedFailure {
    message: string;
    type: string;
    isAuth: boolean;
}

/**
 * Turns an arbitrary adapter failure into a user-facing message and a stable
 * discriminant. Adapters that expose `classifyError` provide their own typed
 * mapping; otherwise a conservative heuristic is applied.
 */
export function classifyFailure(error: unknown, client?: ITorrentClient): ClassifiedFailure {
    let adapterError: AdapterError | null = null;
    if (error instanceof AdapterError) {
        adapterError = error;
    } else if (client && typeof client.classifyError === 'function') {
        try {
            const classified = client.classifyError(error);
            if (classified instanceof AdapterError) adapterError = classified;
        } catch {
            adapterError = null;
        }
    }

    if (adapterError) {
        return {
            message: adapterError.toUserMessage(),
            type: adapterError.type,
            isAuth: AUTH_ERROR_TYPES.has(adapterError.type),
        };
    }

    if (error instanceof CommandError) {
        return { message: error.message, type: error.errorType, isAuth: false };
    }

    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    const isAuth = /authentication|unauthori[sz]ed|forbidden|invalid credentials|401|403|fails\./.test(lower);
    const isTimeout = /timed? ?out|abort/.test(lower);
    const isNetwork = /failed to fetch|networkerror|network error|cannot reach|econnrefused|typeerror/.test(lower);
    return {
        message: raw || 'The server could not be reached.',
        type: isAuth ? 'AUTH_FAILED' : isTimeout ? 'TIMEOUT' : isNetwork ? 'NETWORK_ERROR' : 'UNKNOWN',
        isAuth,
    };
}

function failureResult(error: unknown): CommandResult {
    if (error instanceof CommandError) {
        return { ok: false, error: error.message, errorType: error.errorType };
    }
    const classified = classifyFailure(error);
    return { ok: false, error: classified.message, errorType: classified.type };
}
