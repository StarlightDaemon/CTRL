/**
 * QBittorrentAdapter Unit Tests
 * 
 * Tests the adapter logic by mocking the global fetch function.
 * Phase 1: Enhanced with session management and error handling tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QBittorrentAdapter } from '@/shared/api/clients/qbittorrent/QBittorrentAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Test Server',
    application: 'qbittorrent',
    type: 'qbittorrent',
    hostname: 'http://localhost:8080',
    username: 'admin',
    password: 'adminadmin',
    directories: [],
    clientOptions: {},
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

            expect(result).toBe(true);
        });

        it('should return false on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testConnection();

            expect(result).toBe(false);
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
