/**
 * RuTorrentAdapter Unit Tests
 * 
 * Tests the ruTorrent XML-RPC adapter including XML parsing,
 * multicall operations, and status mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuTorrentAdapter } from '@/shared/api/clients/rutorrent/RuTorrentAdapter';
import { ServerConfig } from '@/shared/lib/types';
import { RuTorrentAdapterError, RuTorrentErrorType } from '@/shared/api/clients/rutorrent/RuTorrentAdapterError';
import { HttpError } from '@/shared/api/network/HttpError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'ruTorrent Server',
    application: 'rutorrent',
    type: 'rutorrent',
    hostname: 'http://localhost:8080/rutorrent',
    username: 'admin',
    password: 'adminpass',
    directories: [],
    clientOptions: { retryConfig: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 } },
};

// Helper to create XML-RPC response
const createXmlResponse = (value: string) => `<?xml version="1.0"?>
<methodResponse>
  <params>
    <param>
      <value>${value}</value>
    </param>
  </params>
</methodResponse>`;

// Helper to create array response
const createArrayResponse = (items: string[]) => {
    const data = items.map(item => `<value>${item}</value>`).join('');
    return createXmlResponse(`<array><data>${data}</data></array>`);
};

// Helper to create torrent list response (multicall)
// Tuple order: hash, name, size, done, upRate, downRate, complete, state,
//              active, label, hashing, path, upTotal, message  (14 columns)
// ratio is NOT requested from daemon; computed client-side.
const createTorrentListResponse = (torrents: Array<{
    hash: string;
    name: string;
    size: number;
    done: number;
    upRate: number;
    downRate: number;
    complete: number;
    state: number;
    active: number;
    label: string;
    upTotal?: number;
}>) => {
    const items = torrents.map(t => {
        // Match the order from d.multicall2 in adapter
        return `<value><array><data>
            <value><string>${t.hash}</string></value>
            <value><string>${t.name}</string></value>
            <value><i8>${t.size}</i8></value>
            <value><i8>${t.done}</i8></value>
            <value><i4>${t.upRate}</i4></value>
            <value><i4>${t.downRate}</i4></value>
            <value><i4>${t.complete}</i4></value>
            <value><i4>${t.state}</i4></value>
            <value><i4>${t.active}</i4></value>
            <value><string>${t.label}</string></value>
            <value><i4>0</i4></value>
            <value><string>/downloads</string></value>
            <value><i8>${t.upTotal ?? 0}</i8></value>
            <value><string></string></value>
        </data></array></value>`;
    }).join('');

    return createXmlResponse(`<array><data>${items}</data></array>`);
};

// Helper to create mock fetch
const createMockFetch = (responses: Array<{ ok: boolean; status: number; body: string }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers({}),
            text: () => Promise.resolve(response.body),
            json: () => Promise.resolve({}),
        } as Response;
    });
};

describe('RuTorrentAdapter', () => {
    let adapter: RuTorrentAdapter;

    beforeEach(() => {
        adapter = new RuTorrentAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should verify connection by calling system.client_version', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<string>0.9.8</string>') }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should throw on XML-RPC fault', async () => {
            const faultResponse = `<?xml version="1.0"?>
                <methodResponse>
                    <fault>
                        <value>
                            <struct>
                                <member><name>faultCode</name><value><int>-1</int></value></member>
                                <member><name>faultString</name><value><string>Access denied</string></value></member>
                            </struct>
                        </value>
                    </fault>
                </methodResponse>`;

            createMockFetch([{ ok: true, status: 200, body: faultResponse }]);

            await expect(adapter.login()).rejects.toThrow('rTorrent Fault');
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list from multicall', async () => {
            const response = createTorrentListResponse([{
                hash: 'abc123',
                name: 'Test Torrent',
                size: 1000000000,
                done: 500000000,
                upRate: 100000,
                downRate: 200000,
                complete: 0,
                state: 1,
                active: 1,
                label: 'movies'
            }]);

            createMockFetch([{ ok: true, status: 200, body: response }]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
                category: 'movies'
            });
        });

        it('should return empty array when no torrents', async () => {
            const response = createXmlResponse('<array><data></data></array>');
            createMockFetch([{ ok: true, status: 200, body: response }]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });

        it('should compute ratio client-side without a native d.ratio column', async () => {
            // upTotal = 750_000_000, size = 1_000_000_000 => ratio = 0.75
            const response = createTorrentListResponse([{
                hash: 'ratio_test',
                name: 'Ratio Test',
                size: 1_000_000_000,
                done: 1_000_000_000,
                upRate: 0,
                downRate: 0,
                complete: 1,
                state: 1,
                active: 1,
                label: '',
                upTotal: 750_000_000,
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);

            const torrents = await adapter.getTorrents();

            // Mapping must succeed (no Zod parse error from missing ratio slot)
            expect(torrents).toHaveLength(1);
            expect(torrents[0].id).toBe('ratio_test');
            expect(torrents[0].status).toBe('seeding');
            // progress is computed from done/size, not from a ratio column
            expect(torrents[0].progress).toBe(100);
            // Verify client-side ratio computation: 750,000,000 / 1,000,000,000 = 0.75
            expect(torrents[0].ratio).toBe(0.75);
            expect(torrents[0].uploadedTotal).toBe(750_000_000);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent via load.start', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent via d.stop', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent via d.start', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent via d.erase', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.removeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful login', async () => {
            createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<string>0.9.8</string>') }
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
        it('should map downloading state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 50,
                upRate: 0, downRate: 100, complete: 0, state: 1, active: 1, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');
        });

        it('should map seeding state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 100,
                upRate: 100, downRate: 0, complete: 1, state: 1, active: 1, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');
        });

        it('should map paused state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 50,
                upRate: 0, downRate: 0, complete: 0, state: 0, active: 0, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');
        });
    });

    describe('setCategory', () => {
        it('should set category via d.custom1.set', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.setCategory('abc123', 'movies');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });
});



describe('RuTorrentAdapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: RuTorrentErrorType[] = [
    'CONNECTION_REFUSED', 'TIMEOUT', 'AUTH_FAILED', 'FORBIDDEN',
    'ENDPOINT_NOT_FOUND', 'RPC_FAULT', 'NETWORK_ERROR', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'rutorrent',
        type: 'rutorrent',
        hostname: 'http://seedbox.example.com/rutorrent',
        username: 'user',
        password: 'pass',
        directories: [],
        clientOptions: { retryConfig },
    };
}

function httpError(status: number, statusText = 'Error'): HttpError {
    return new HttpError(status, statusText, {} as Response);
}

type CallSpy = { call: (...args: unknown[]) => Promise<unknown> };

describe('RuTorrentAdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new RuTorrentAdapterError('RPC_FAULT', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(RuTorrentAdapterError);
        expect(e.type).toBe('RPC_FAULT');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('RuTorrentAdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new RuTorrentAdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new RuTorrentAdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification', () => {
        it('maps an rTorrent fault → RPC_FAULT', () => {
            expect(RuTorrentAdapterError.from(new Error('rTorrent Fault: Method not found (-506)')).type).toBe('RPC_FAULT');
        });
        it('maps a 401 HttpError → AUTH_FAILED', () => {
            expect(RuTorrentAdapterError.from(httpError(401, 'Unauthorized')).type).toBe('AUTH_FAILED');
        });
        it('maps a 403 HttpError → FORBIDDEN', () => {
            expect(RuTorrentAdapterError.from(httpError(403, 'Forbidden')).type).toBe('FORBIDDEN');
        });
        it('maps a 404 HttpError → ENDPOINT_NOT_FOUND', () => {
            expect(RuTorrentAdapterError.from(httpError(404, 'Not Found')).type).toBe('ENDPOINT_NOT_FOUND');
        });
        it('maps a fetch TypeError → CONNECTION_REFUSED', () => {
            expect(RuTorrentAdapterError.from(new TypeError('Failed to fetch')).type).toBe('CONNECTION_REFUSED');
        });
        it('maps a timeout message → TIMEOUT', () => {
            expect(RuTorrentAdapterError.from(new Error('Connection timed out')).type).toBe('TIMEOUT');
        });
        it('passes an existing RuTorrentAdapterError through unchanged', () => {
            const original = new RuTorrentAdapterError('FORBIDDEN', 'x');
            expect(RuTorrentAdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(httpError(401, 'Unauthorized'));
            expect(RuTorrentAdapterError.from(wrapped).type).toBe('AUTH_FAILED');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(RuTorrentAdapterError.from(new Error('mystery')).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (ruTorrent)', () => {
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
        const err = new RuTorrentAdapterError('CONNECTION_REFUSED', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw httpError(401, 'Unauthorized'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('RuTorrentAdapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new RuTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new RuTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(httpError(401, 'Unauthorized'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(RuTorrentAdapterError);
        expect(result.error?.type).toBe('AUTH_FAILED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('classifies an rTorrent fault as RPC_FAULT', async () => {
        const adapter = new RuTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('rTorrent Fault: Unsupported target (-501)'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('RPC_FAULT');
    });

    it('retries a transient failure before reporting connected', async () => {
        const adapter = new RuTorrentAdapter(makeConfig(FAST_RETRY));
        let calls = 0;
        vi.spyOn(adapter as unknown as CallSpy, 'call').mockImplementation(async () => {
            calls++;
            if (calls < 2) throw new TypeError('Failed to fetch');
            return '0.9.8';
        });
        const result = await adapter.testConnection();
        expect(result.connected).toBe(true);
        expect(calls).toBe(2);
    });
});

});
