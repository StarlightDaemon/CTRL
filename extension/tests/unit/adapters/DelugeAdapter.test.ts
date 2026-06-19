/**
 * DelugeAdapter Unit Tests
 * 
 * Tests the Deluge JSON-RPC adapter including multi-step handshake,
 * re-authentication logic, and daemon connection handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DelugeAdapter } from '@/shared/api/clients/deluge/DelugeAdapter';
import { ServerConfig } from '@/shared/lib/types';
import { DelugeAdapterError, DelugeErrorType } from '@/shared/api/clients/deluge/DelugeAdapterError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Deluge Server',
    application: 'deluge',
    type: 'deluge',
    hostname: 'http://localhost:8112',
    username: '', // Deluge uses password-only auth
    password: 'deluge',
    directories: [],
    clientOptions: { retryConfig: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 } },
};

// Helper to create mock JSON-RPC responses
const createMockFetch = (responses: Array<{ ok: boolean; status: number; body: any }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers({}),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

// Helper to create Deluge JSON-RPC response
const rpcResponse = (result: any, error: any = null, id: number = 1) => ({
    result,
    error,
    id
});

describe('DelugeAdapter', () => {
    let adapter: DelugeAdapter;

    beforeEach(() => {
        adapter = new DelugeAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should complete multi-step handshake when not connected', async () => {
            const fetchSpy = createMockFetch([
                // 1. auth.login - success
                { ok: true, status: 200, body: rpcResponse(true) },
                // 2. web.connected - not connected
                { ok: true, status: 200, body: rpcResponse(false) },
                // 3. web.get_hosts - return available host
                { ok: true, status: 200, body: rpcResponse([['host-id-123', '127.0.0.1', 58846, 'Online']]) },
                // 4. web.get_host_status - return Online
                { ok: true, status: 200, body: rpcResponse(['host-id-123', 'Online', '2.0.3']) },
                // 5. web.connect - success
                { ok: true, status: 200, body: rpcResponse(null) },
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(5);
        });

        it('should skip daemon connection if already connected', async () => {
            const fetchSpy = createMockFetch([
                // 1. auth.login - success
                { ok: true, status: 200, body: rpcResponse(true) },
                // 2. web.connected - already connected
                { ok: true, status: 200, body: rpcResponse(true) },
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should throw on auth failure', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(false) },
            ]);

            await expect(adapter.login()).rejects.toThrow('Authentication Failed');
        });

        it('should throw if no daemons available', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(true) },
                { ok: true, status: 200, body: rpcResponse(false) },
                { ok: true, status: 200, body: rpcResponse([]) }, // Empty hosts
            ]);

            await expect(adapter.login()).rejects.toThrow('No Deluge Daemons available');
        });

        it('should throw if daemon is offline', async () => {
            createMockFetch([
                // 1. auth.login - success
                { ok: true, status: 200, body: rpcResponse(true) },
                // 2. web.connected - not connected
                { ok: true, status: 200, body: rpcResponse(false) },
                // 3. web.get_hosts - return available host
                { ok: true, status: 200, body: rpcResponse([['host-id-123', '127.0.0.1', 58846, 'Offline']]) },
                // 4. web.get_host_status - return Offline
                { ok: true, status: 200, body: rpcResponse(['host-id-123', 'Offline', '']) },
            ]);

            await expect(adapter.login()).rejects.toThrow('Deluge daemon is offline: 127.0.0.1:58846');
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
            const mockTorrents = {
                'abc123hash': {
                    name: 'Test Torrent',
                    state: 'Downloading',
                    progress: 50.0,
                    eta: 3600,
                    download_payload_rate: 1000000,
                    upload_payload_rate: 500000,
                    total_size: 1000000000,
                    hash: 'abc123hash',
                    save_path: '/downloads',
                    ratio: 1.5,
                    queue: 0
                }
            };

            createMockFetch([
                { ok: true, status: 200, body: rpcResponse({ torrents: mockTorrents, filters: {} }) },
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123hash',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50.0,
            });
        });

        it('should return empty array for no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse({ torrents: {}, filters: {} }) },
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });

        it('should re-authenticate on session expiry', async () => {
            const fetchSpy = createMockFetch([
                // First call - session expired
                { ok: true, status: 200, body: rpcResponse(null, { code: 1, message: 'Not authenticated' }) },
                // Re-auth: auth.login
                { ok: true, status: 200, body: rpcResponse(true) },
                // Re-auth: web.connected
                { ok: true, status: 200, body: rpcResponse(true) },
                // Retry original request
                { ok: true, status: 200, body: rpcResponse({ torrents: {}, filters: {} }) },
            ]);

            const torrents = await adapter.getTorrents();

            expect(fetchSpy).toHaveBeenCalledTimes(4);
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with magnet link', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('torrent-hash-123') },
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should include options when provided', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('torrent-hash-123') },
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                path: '/downloads/movies',
            });

            // Request should have been made with options
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by hash', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse(null) },
            ]);

            await adapter.pauseTorrent('abc123hash');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by hash', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse(null) },
            ]);

            await adapter.resumeTorrent('abc123hash');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent without deleting files', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse(true) },
            ]);

            await adapter.removeTorrent('abc123hash', false);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should remove torrent and delete files', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse(true) },
            ]);

            await adapter.removeTorrent('abc123hash', true);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(true) },
                { ok: true, status: 200, body: rpcResponse(true) },
            ]);

            const result = await adapter.testConnection();
            expect(result).toEqual({ connected: true });
        });

        it('should return { connected: false } on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
            const result = await adapter.testConnection();
            expect(result.connected).toBe(false);
            expect(result.error?.type).toBe('NETWORK_ERROR');
        });
    });

    describe('status mapping', () => {
        it('should map deluge states correctly', async () => {
            const createTorrentResponse = (state: string) => ({
                torrents: {
                    'test-hash': {
                        name: 'Test',
                        state,
                        progress: 0,
                        eta: 0,
                        download_payload_rate: 0,
                        upload_payload_rate: 0,
                        total_size: 0,
                        hash: 'test-hash',
                        save_path: '',
                        ratio: 0,
                        queue: 0
                    }
                },
                filters: {}
            });

            // Downloading state
            createMockFetch([{ ok: true, status: 200, body: rpcResponse(createTorrentResponse('Downloading')) }]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Seeding state
            createMockFetch([{ ok: true, status: 200, body: rpcResponse(createTorrentResponse('Seeding')) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');

            // Paused state
            createMockFetch([{ ok: true, status: 200, body: rpcResponse(createTorrentResponse('Paused')) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Error state
            createMockFetch([{ ok: true, status: 200, body: rpcResponse(createTorrentResponse('Error')) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });
    });

    describe('getCategories (Labels)', () => {
        it('should return labels from Label plugin', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(['movies', 'tv', 'music']) },
            ]);

            const categories = await adapter.getCategories();

            expect(categories).toEqual(['movies', 'tv', 'music']);
        });

        it('should return empty array if Label plugin not enabled', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(null, { code: 2, message: 'Unknown method' }) },
            ]);

            const categories = await adapter.getCategories();

            expect(categories).toEqual([]);
        });
    });
});



describe('DelugeAdapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: DelugeErrorType[] = [
    'CONNECTION_REFUSED', 'TIMEOUT', 'AUTH_FAILED', 'AUTH_LEVEL_LOW', 'DAEMON_OFFLINE',
    'METHOD_NOT_FOUND', 'INTERNAL_ERROR', 'RPC_FAILED', 'NETWORK_ERROR', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'deluge',
        type: 'deluge',
        hostname: 'http://localhost:8112',
        password: 'deluge',
        directories: [],
        clientOptions: { retryConfig },
    };
}

function codedError(code: number, message: string): Error {
    const e = new Error(message);
    (e as Error & { code?: number }).code = code;
    return e;
}

describe('DelugeAdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new DelugeAdapterError('AUTH_FAILED', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(DelugeAdapterError);
        expect(e.type).toBe('AUTH_FAILED');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('DelugeAdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new DelugeAdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new DelugeAdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification', () => {
        it('maps RPC error code 1 → AUTH_FAILED', () => {
            expect(DelugeAdapterError.from(codedError(1, 'Not authenticated')).type).toBe('AUTH_FAILED');
        });
        it('maps RPC error code 2 → METHOD_NOT_FOUND', () => {
            expect(DelugeAdapterError.from(codedError(2, 'Unknown method core.x')).type).toBe('METHOD_NOT_FOUND');
        });
        it('maps RPC error code 5 → AUTH_LEVEL_LOW', () => {
            expect(DelugeAdapterError.from(codedError(5, 'Auth level too low')).type).toBe('AUTH_LEVEL_LOW');
        });
        it('maps "Authentication Failed" message → AUTH_FAILED', () => {
            expect(DelugeAdapterError.from(new Error('Authentication Failed')).type).toBe('AUTH_FAILED');
        });
        it('maps an offline-daemon message → DAEMON_OFFLINE', () => {
            expect(DelugeAdapterError.from(new Error('Deluge daemon is offline: 127.0.0.1:58846')).type).toBe('DAEMON_OFFLINE');
        });
        it('maps "No Deluge Daemons available" → DAEMON_OFFLINE', () => {
            expect(DelugeAdapterError.from(new Error('No Deluge Daemons available')).type).toBe('DAEMON_OFFLINE');
        });
        it('maps a timeout message → TIMEOUT', () => {
            expect(DelugeAdapterError.from(new Error('Deluge request timeout after 30000ms')).type).toBe('TIMEOUT');
        });
        it('maps a fetch TypeError → CONNECTION_REFUSED', () => {
            expect(DelugeAdapterError.from(new TypeError('Failed to fetch')).type).toBe('CONNECTION_REFUSED');
        });
        it('passes an existing DelugeAdapterError through unchanged', () => {
            const original = new DelugeAdapterError('RPC_FAILED', 'x');
            expect(DelugeAdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(codedError(1, 'Not authenticated'));
            expect(DelugeAdapterError.from(wrapped).type).toBe('AUTH_FAILED');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(DelugeAdapterError.from({}).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (Deluge)', () => {
    it('retries on transient failure and then resolves', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            calls++;
            if (calls < 2) throw new Error('transient');
            return 'ok';
        });
        await expect(withAdapterRetry(fn, FAST_RETRY)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('rethrows an AdapterError unchanged on exhaustion', async () => {
        const err = new DelugeAdapterError('DAEMON_OFFLINE', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('DelugeAdapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new DelugeAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new DelugeAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(codedError(1, 'Not authenticated'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(DelugeAdapterError);
        expect(result.error?.type).toBe('AUTH_FAILED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('classifies an offline daemon as DAEMON_OFFLINE', async () => {
        const adapter = new DelugeAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('Deluge daemon is offline: 127.0.0.1:58846'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('DAEMON_OFFLINE');
    });
});

});
