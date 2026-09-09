import type { Torrent } from '@/entities/torrent/model/Torrent';
import type { AddTorrentOptions } from '@/entities/client/model/ITorrentClient';
import type { ServerConfig } from '@/entities/server/model/types';

/**
 * Wire protocol between the background controller and the extension UIs.
 *
 * Two channels exist:
 *
 * 1. A long-lived runtime port (`ACTIVE_SESSION_PORT`). A UI that wants live
 *    queue data opens one, declares the viewport it renders, and receives
 *    id-keyed snapshots plus connection status for as long as it stays open.
 *    Holding the port also signals the background to poll at the fast rate.
 *
 * 2. One-shot `runtime.sendMessage` requests for commands (add, pause,
 *    resume, remove, test connection) and for reading the current state.
 *
 * Every snapshot and every destructive command carries the server identity
 * it belongs to. The background rejects commands whose server no longer
 * exists and discards poll results that belong to a superseded generation,
 * so a delayed response from server A can never be displayed as server B and
 * a stale row can never route a command to the wrong client.
 */

export const ACTIVE_SESSION_PORT = 'ctrl-active-session';

/** Rows delivered to a subscriber that has not declared a viewport yet. */
export const DEFAULT_VIEWPORT_SIZE = 50;

export type ConnectionStatus =
    /** No vault exists yet; the user has never completed setup. */
    | 'uninitialized'
    /** Vault exists but no session key is present (browser restart / explicit lock). */
    | 'locked'
    /** Stored vault material is incomplete or malformed and will not unlock. */
    | 'vault_corrupted'
    /** Vault is unlocked but holds no servers. */
    | 'no_servers'
    /** The active server entry cannot be used (bad URL / unknown type). */
    | 'invalid_config'
    /** The per-origin host permission for the active server is not granted. */
    | 'permission_missing'
    /** A server is selected and the first poll has not completed yet. */
    | 'connecting'
    /** The last poll succeeded. */
    | 'connected'
    /** A previous poll succeeded but the latest one failed; data shown is old. */
    | 'stale'
    /** No successful poll for this server; it cannot be reached. */
    | 'unavailable'
    /** The server rejected the configured credentials. */
    | 'auth_failed';

export interface ConnectionState {
    status: ConnectionStatus;
    /** Stable id of the server the state describes, or null when none applies. */
    serverId: string | null;
    serverName: string | null;
    /** Incremented whenever the active server or vault state changes. */
    generation: number;
    lastSuccessAt: number | null;
    lastAttemptAt: number | null;
    /** User-facing description of the last failure, if any. */
    lastError: string | null;
    /** Adapter error discriminant of the last failure, if any. */
    lastErrorType: string | null;
}

export interface GlobalStats {
    downloadSpeed: number;
    uploadSpeed: number;
    activeCount: number;
    total: number;
}

/** Full replacement of the subscriber's visible window. */
export interface SnapshotMessage {
    type: 'SNAPSHOT';
    serverId: string;
    generation: number;
    revision: number;
    total: number;
    start: number;
    items: Torrent[];
    connection: ConnectionState;
    stats: GlobalStats;
}

/** Connection status changed without any queue data to show. */
export interface StatusMessage {
    type: 'STATUS';
    connection: ConnectionState;
    stats: GlobalStats;
    /** Present when there is no queue to display for the current state. */
    cleared?: boolean;
}

export type PortServerMessage = SnapshotMessage | StatusMessage;

export type PortClientMessage =
    | { type: 'SET_VIEWPORT'; start: number; end: number }
    | { type: 'REFRESH' };

export interface CommandResult {
    ok: boolean;
    error?: string;
    errorType?: string;
}

export interface AddTorrentRequest {
    type: 'ADD_TORRENT_URL';
    url: string;
    /** Target server. Defaults to the active server. */
    serverId?: string;
    /** Explicit overrides. `paused` defaults to the global add-paused setting. */
    options?: AddTorrentOptions;
}

export interface TorrentCommandRequest {
    type: 'PAUSE_TORRENT' | 'RESUME_TORRENT' | 'REMOVE_TORRENT';
    serverId: string;
    torrentId: string;
    /** Only honoured for REMOVE_TORRENT. Defaults to false. */
    deleteData?: boolean;
}

export interface TestConnectionRequest {
    type: 'TEST_CONNECTION';
    /** Unsaved configuration to probe. */
    config: ServerConfig;
}

export interface GetStateRequest {
    type: 'GET_STATE';
}

export interface ForceRefreshRequest {
    type: 'FORCE_REFRESH';
}

export type RuntimeRequest =
    | AddTorrentRequest
    | TorrentCommandRequest
    | TestConnectionRequest
    | GetStateRequest
    | ForceRefreshRequest;

export interface ServerSummary {
    id: string;
    name: string;
    type: string;
}

export interface StateResponse {
    connection: ConnectionState;
    stats: GlobalStats;
    servers: ServerSummary[];
    activeServerId: string | null;
}

export interface TestConnectionResponse {
    connected: boolean;
    error?: string;
    errorType?: string;
}

/** Shape persisted to storage.session so a restarted background can resume. */
export interface PersistedSnapshot {
    serverId: string;
    torrents: Torrent[];
    savedAt: number;
}

export function emptyStats(): GlobalStats {
    return { downloadSpeed: 0, uploadSpeed: 0, activeCount: 0, total: 0 };
}

export function computeStats(torrents: Torrent[]): GlobalStats {
    let downloadSpeed = 0;
    let uploadSpeed = 0;
    let activeCount = 0;
    for (const t of torrents) {
        downloadSpeed += t.downloadSpeed || 0;
        uploadSpeed += t.uploadSpeed || 0;
        if (t.status === 'downloading' || t.status === 'seeding') activeCount++;
    }
    return { downloadSpeed, uploadSpeed, activeCount, total: torrents.length };
}

export function initialConnectionState(): ConnectionState {
    return {
        status: 'connecting',
        serverId: null,
        serverName: null,
        generation: 0,
        lastSuccessAt: null,
        lastAttemptAt: null,
        lastError: null,
        lastErrorType: null,
    };
}
