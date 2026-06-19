/**
 * QBittorrentAdapter Unit Tests
 * 
 * Tests the adapter logic by mocking the global fetch function.
 * Phase 1: Enhanced with session management and error handling tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QBittorrentAdapter } from '@/shared/api/clients/qbittorrent/QBittorrentAdapter';
import { ServerConfig } from '@/shared/lib/types';
import { QBittorrentAdapterError, QBittorrentErrorType } from '@/shared/api/clients/qbittorrent/QBittorrentAdapterError';
import { HttpError } from '@/shared/api/network/HttpError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Test Server',
    application: 'qbittorrent',
    type: 'qbittorrent',
    hostname: 'http://localhost:8080',
    username: 'admin',
    password: 'adminadmin',
    directories: [],
    clientOptions: { retryConfig: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 } },
};

// Mock fetch helper
const mockFetch = (response: any, ok = true, status = 200) => {
    return vi.spyOn(global, 'fetch').mockResolvedValue({
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        text: () => Promise.resolve(typeof response === 'string' ? response : JSON.stringify(response)),
        json: () => Promise.resolve(response),
    } as Response);
};

// Mock fetch with multiple sequential responses
const mockFetchSequence = (responses: Array<{ response: any; ok?: boolean; status?: number }>) => {
    const spy = vi.spyOn(global, 'fetch');
    responses.forEach((r, index) => {
        spy.mockResolvedValueOnce({
            ok: r.ok ?? true,
            status: r.status ?? 200,
            statusText: (r.ok ?? true) ? 'OK' : 'Error',
            text: () => Promise.resolve(typeof r.response === 'string' ? r.response : JSON.stringify(r.response)),
            json: () => Promise.resolve(r.response),
        } as Response);
    });
    return spy;
};

describe('QBittorrentAdapter', () => {
    let adapter: QBittorrentAdapter;

    beforeEach(() => {
        adapter = new QBittorrentAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should login successfully with valid credentials', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('auth/login'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should throw error on failed login', async () => {
            mockFetch('Fails.');

            await expect(adapter.login()).rejects.toThrow('Authentication Failed');
        });

        it('should detect IP ban and throw specific error', async () => {
            mockFetch('Your IP address has been banned after too many failed authentication attempts');

            await expect(adapter.login()).rejects.toThrow('IP has been banned');
        });

        it('should track login attempts and warn about lockout protection', async () => {
            mockFetch('Fails.');

            // First attempt
            await expect(adapter.login()).rejects.toThrow('2 attempts remaining');

            // Second attempt
            await expect(adapter.login()).rejects.toThrow('1 attempts remaining');

            // Third attempt
            await expect(adapter.login()).rejects.toThrow('0 attempts remaining');

            // Fourth attempt should fail due to lockout protection
            await expect(adapter.login()).rejects.toThrow('Login attempts exhausted');
        });

        it('should throw error on 401 Unauthorized response', async () => {
            mockFetch('', false, 401);
            await expect(adapter.login()).rejects.toThrow('Authentication Failed (401 Unauthorized)');
        });

        it('should track 401 failures and trigger lockout guard', async () => {
            mockFetch('', false, 401);

            // First attempt
            await expect(adapter.login()).rejects.toThrow('2 attempts remaining');

            // Second attempt
            await expect(adapter.login()).rejects.toThrow('1 attempts remaining');

            // Third attempt
            await expect(adapter.login()).rejects.toThrow('0 attempts remaining');

            // Fourth attempt should fail due to lockout protection
            await expect(adapter.login()).rejects.toThrow('Login attempts exhausted');
        });

        it('should inject CSRF headers (Origin and Referer)', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.any(Headers),
                })
            );

            // Check headers contain Origin
            const callArgs = fetchSpy.mock.calls[0][1] as RequestInit;
            const headers = callArgs.headers as Headers;
            expect(headers.get('Origin')).toBe('http://localhost:8080');
            expect(headers.get('Referer')).toBe('http://localhost:8080/');
        });
    });

    describe('session management', () => {
        it('should re-authenticate on 403 response', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.', ok: true },           // Initial login
                { response: '', ok: false, status: 403 }, // Expired session
                { response: 'Ok.', ok: true },           // Re-login
                { response: 'v4.6.0', ok: true },        // Retry version request
            ]);

            await adapter.login();
            const version = await adapter.getAppVersion();

            expect(version).toBe('v4.6.0');
            expect(fetchSpy).toHaveBeenCalledTimes(4);
        });
    });

    describe('API version detection', () => {
        it('should return API version', async () => {
            mockFetchSequence([
                { response: 'Ok.' },      // Login
                { response: '2.9.3' },    // webapiVersion
            ]);

            await adapter.login();
            const version = await adapter.getApiVersion();

            expect(version).toBe('2.9.3');
        });

        it('should cache API version on subsequent calls', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: '2.9.3' },
            ]);

            await adapter.login();
            await adapter.getApiVersion();
            await adapter.getApiVersion();

            // Should only have called fetch twice (login + first version call)
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list with extended fields', async () => {
            const mockTorrents = [{
                hash: 'abc123',
                name: 'Test Torrent',
                state: 'downloading',
                progress: 0.5,
                size: 1000000000,
                dlspeed: 1000000,
                upspeed: 500000,
                eta: 3600,
                save_path: '/downloads',
                added_on: 1700000000,
                category: 'movies',
                tags: 'hd,new',
                ratio: 1.5,
                num_seeds: 10,
                num_leechs: 5,
                seq_dl: true,
                f_l_piece_prio: false,
            }];

            mockFetchSequence([
                { response: 'Ok.' },       // Login
                { response: mockTorrents }, // torrents/info
            ]);

            await adapter.login();
            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
                category: 'movies',
                tags: ['hd', 'new'],
                ratio: 1.5,
                seeds: 10,
                peers: 5,
                sequentialDownload: true,
                firstLastPiecePrio: false,
            });
        });

        it('should return empty array for no torrents', async () => {
            mockFetchSequence([
                { response: 'Ok.' },
                { response: [] },
            ]);

            await adapter.login();
            const torrents = await adapter.getTorrents();

            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenLastCalledWith(
                expect.stringContaining('torrents/add'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should include sequential download options when provided', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                label: 'movies',
                path: '/downloads/movies',
                sequentialDownload: true,
                firstLastPiecePrio: true,
            });

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            // FormData will contain the sequential options
        });
    });

    describe('error handling for adding torrents (409, 415, 405)', () => {
        it('should throw semantic error on 409 (all adds fail)', async () => {
            mockFetchSequence([
                { response: 'Ok.', ok: true },
                { response: 'Conflict', ok: false, status: 409 },
            ]);
            await adapter.login();
            await expect(adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123')).rejects.toThrow('All torrents failed to add');
        });

        it('should throw semantic error on 415 (invalid torrent file)', async () => {
            mockFetchSequence([
                { response: 'Ok.', ok: true },
                { response: 'Unsupported Media Type', ok: false, status: 415 },
            ]);
            await adapter.login();
            const fakeFile = new Blob(['fake content']);
            await expect(adapter.addTorrentFile(fakeFile)).rejects.toThrow('Invalid torrent file');
        });

        it('should throw semantic error on 405 (wrong method)', async () => {
            mockFetchSequence([
                { response: 'Ok.', ok: true },
                { response: 'Method Not Allowed', ok: false, status: 405 },
            ]);
            await adapter.login();
            await expect(adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123')).rejects.toThrow('Method not allowed — update adapter');
        });
    });

    describe('sequential download controls', () => {
        it('should toggle sequential download for torrents', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: '' },
            ]);

            await adapter.login();
            await adapter.toggleSequentialDownload(['hash1', 'hash2']);

            expect(fetchSpy).toHaveBeenLastCalledWith(
                expect.stringContaining('torrents/toggleSequentialDownload'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should toggle first/last piece priority', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: '' },
            ]);

            await adapter.login();
            await adapter.toggleFirstLastPiecePrio(['hash1']);

            expect(fetchSpy).toHaveBeenLastCalledWith(
                expect.stringContaining('torrents/toggleFirstLastPiecePrio'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by hash', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenLastCalledWith(
                expect.stringContaining('torrents/pause'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by hash', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenLastCalledWith(
                expect.stringContaining('torrents/resume'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent without deleting files', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.removeTorrent('abc123', false);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should remove torrent and delete files', async () => {
            const fetchSpy = mockFetchSequence([
                { response: 'Ok.' },
                { response: 'Ok.' },
            ]);

            await adapter.login();
            await adapter.removeTorrent('abc123', true);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            mockFetchSequence([
                { response: 'Ok.' },
                { response: 'v4.5.0' },
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

    describe('mapStatus', () => {
        it('should map qbittorrent states correctly', async () => {
            const createMockTorrent = (state: string) => [{
                hash: 'test',
                name: 'Test',
                state,
                progress: 0,
                size: 0,
                dlspeed: 0,
                upspeed: 0,
                eta: 0,
                save_path: '',
                added_on: 0,
                category: '',
                tags: '',
            }];

            // Test downloading states
            mockFetchSequence([{ response: 'Ok.' }, { response: createMockTorrent('downloading') }]);
            await adapter.login();
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Test stalled state (new in Phase 1)
            adapter = new QBittorrentAdapter(mockConfig);
            mockFetchSequence([{ response: 'Ok.' }, { response: createMockTorrent('stalledDL') }]);
            await adapter.login();
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('stalled');

            // Test seeding states
            adapter = new QBittorrentAdapter(mockConfig);
            mockFetchSequence([{ response: 'Ok.' }, { response: createMockTorrent('uploading') }]);
            await adapter.login();
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');

            // Test paused states
            adapter = new QBittorrentAdapter(mockConfig);
            mockFetchSequence([{ response: 'Ok.' }, { response: createMockTorrent('pausedDL') }]);
            await adapter.login();
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Test error states
            adapter = new QBittorrentAdapter(mockConfig);
            mockFetchSequence([{ response: 'Ok.' }, { response: createMockTorrent('error') }]);
            await adapter.login();
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });
    });
});



describe('QBittorrentAdapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: QBittorrentErrorType[] = [
    'CONNECTION_REFUSED', 'TIMEOUT', 'AUTH_FAILED', 'IP_BANNED',
    'ENDPOINT_NOT_FOUND', 'SERVER_ERROR', 'NETWORK_ERROR', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'qbittorrent',
        type: 'qbittorrent',
        hostname: 'http://localhost:8080',
        username: 'admin',
        password: 'adminadmin',
        directories: [],
        clientOptions: { retryConfig },
    };
}

function httpError(status: number, statusText = 'Error'): HttpError {
    return new HttpError(status, statusText, {} as Response);
}

describe('QBittorrentAdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new QBittorrentAdapterError('AUTH_FAILED', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(QBittorrentAdapterError);
        expect(e.type).toBe('AUTH_FAILED');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('QBittorrentAdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new QBittorrentAdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new QBittorrentAdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification', () => {
        it('maps an IP-ban message → IP_BANNED', () => {
            expect(QBittorrentAdapterError.from(new Error('IP has been banned by qBittorrent.')).type).toBe('IP_BANNED');
        });
        it('maps "Login attempts exhausted" → IP_BANNED', () => {
            expect(QBittorrentAdapterError.from(new Error('Login attempts exhausted. Wait 30s')).type).toBe('IP_BANNED');
        });
        it('maps an authentication-failed message → AUTH_FAILED', () => {
            expect(QBittorrentAdapterError.from(new Error('Authentication Failed (401 Unauthorized).')).type).toBe('AUTH_FAILED');
        });
        it('maps a timeout message → TIMEOUT', () => {
            expect(QBittorrentAdapterError.from(new Error('Request timeout after 30000ms')).type).toBe('TIMEOUT');
        });
        it('maps a 404 HttpError → ENDPOINT_NOT_FOUND', () => {
            expect(QBittorrentAdapterError.from(httpError(404, 'Not Found')).type).toBe('ENDPOINT_NOT_FOUND');
        });
        it('maps a 5xx HttpError → SERVER_ERROR', () => {
            expect(QBittorrentAdapterError.from(httpError(503, 'Service Unavailable')).type).toBe('SERVER_ERROR');
        });
        it('maps a fetch TypeError → CONNECTION_REFUSED', () => {
            expect(QBittorrentAdapterError.from(new TypeError('Failed to fetch')).type).toBe('CONNECTION_REFUSED');
        });
        it('passes an existing QBittorrentAdapterError through unchanged', () => {
            const original = new QBittorrentAdapterError('SERVER_ERROR', 'x');
            expect(QBittorrentAdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(new Error('IP has been banned'));
            expect(QBittorrentAdapterError.from(wrapped).type).toBe('IP_BANNED');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(QBittorrentAdapterError.from(new Error('some odd failure')).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (qBittorrent)', () => {
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
        const err = new QBittorrentAdapterError('SERVER_ERROR', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw httpError(503, 'Service Unavailable'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('QBittorrentAdapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new QBittorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        vi.spyOn(adapter, 'getAppVersion').mockResolvedValue('v4.6.0');
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new QBittorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('Authentication Failed (401 Unauthorized).'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(QBittorrentAdapterError);
        expect(result.error?.type).toBe('AUTH_FAILED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('classifies an IP ban as IP_BANNED', async () => {
        const adapter = new QBittorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('IP has been banned by qBittorrent.'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('IP_BANNED');
    });

    it('does NOT retry login (preserves IP-ban lockout protection)', async () => {
        const adapter = new QBittorrentAdapter(makeConfig(FAST_RETRY));
        const loginSpy = vi.spyOn(adapter, 'login').mockRejectedValue(new Error('Authentication Failed (401 Unauthorized).'));
        await adapter.testConnection();
        expect(loginSpy).toHaveBeenCalledTimes(1);
    });
});

});
