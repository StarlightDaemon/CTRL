/**
 * UTorrentAdapter Unit Tests
 * 
 * Tests the uTorrent WebUI adapter including token-based authentication,
 * query string API, status bitmask mapping, and delta sync.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UTorrentAdapter } from '@/shared/api/clients/utorrent/UTorrentAdapter';
import { UTorrentSettingsService } from '@/shared/api/clients/utorrent/UTorrentSettingsService';
import { UTorrentRssService } from '@/shared/api/clients/utorrent/UTorrentRssService';
import { ServerConfig } from '@/shared/lib/types';
import { STATUS_FLAG } from '@/shared/api/clients/utorrent/UTorrentSchema';
import { UTorrentAdapterError, UTorrentErrorType } from '@/shared/api/clients/utorrent/UTorrentAdapterError';
import { HttpError } from '@/shared/api/network/HttpError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'uTorrent Server',
    application: 'utorrent',
    type: 'utorrent',
    hostname: 'http://localhost:8080',
    username: 'admin',
    password: 'adminpass',
    directories: [],
    clientOptions: { retryConfig: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 } },
};

// Mock DOMParser for token parsing
class MockDOMParser {
    parseFromString(str: string, _type: string) {
        const tokenMatch = str.match(/<div id="token"[^>]*>([^<]+)<\/div>/i);
        return {
            getElementById: (id: string) => {
                if (id === 'token' && tokenMatch) {
                    return { textContent: tokenMatch[1] };
                }
                return null;
            }
        };
    }
}

// @ts-ignore - Mock global DOMParser
global.DOMParser = MockDOMParser as any;

// Helper to create mock fetch
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

/** Extended mock that supports per-response custom response headers. */
const createMockFetchWithHeaders = (
    responses: Array<{ ok: boolean; status: number; body: any; responseHeaders?: Record<string, string> }>
) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers(response.responseHeaders ?? {}),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

// Token HTML response
const tokenHtml = '<html><body><div id="token">ABC123TOKEN</div></body></html>';

// Mock torrent list response with full array indices
const createTorrentListResponse = (torrents: Array<{
    hash: string;
    status: number;
    name: string;
    size: number;
    percent: number;
    downSpeed: number;
    upSpeed: number;
    eta: number;
    label: string;
    dateAdded?: number;
    savePath?: string;
}>, torrentc?: string) => ({
    build: 28705,
    torrents: torrents.map(t => [
        t.hash,      // 0: hash
        t.status,    // 1: status
        t.name,      // 2: name
        t.size,      // 3: size
        t.percent,   // 4: percent (permils)
        0,           // 5: downloaded
        0,           // 6: uploaded
        0,           // 7: ratio
        t.upSpeed,   // 8: upspeed
        t.downSpeed, // 9: downspeed
        t.eta,       // 10: eta
        t.label,     // 11: label
        0,           // 12: peers_connected
        0,           // 13: peers_in_swarm
        0,           // 14: seeds_connected
        0,           // 15: seeds_in_swarm
        0,           // 16: availability
        1,           // 17: queue_order
        0,           // 18: remaining
        '',          // 19: download_url
        '',          // 20: rss_feed_url
        '',          // 21: status_message
        '',          // 22: stream_id
        t.dateAdded || 1704067200, // 23: date_added (default: 2024-01-01)
        0,           // 24: date_completed
        '',          // 25: app_update_url
        t.savePath || '/downloads', // 26: save_path
    ]),
    torrentc: torrentc || '12345678',
});

describe('UTorrentAdapter', () => {
    let adapter: UTorrentAdapter;

    beforeEach(() => {
        adapter = new UTorrentAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should parse token from HTML response', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should throw if token not found', async () => {
            createMockFetch([
                { ok: true, status: 200, body: '<html><body>No token here</body></html>' }
            ]);

            await expect(adapter.login()).rejects.toThrow('Failed to retrieve uTorrent token');
        });

        it('should capture GUID from Set-Cookie response header', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123', status: 201, name: 'Test', size: 100,
                percent: 500, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }]);

            const fetchSpy = createMockFetchWithHeaders([
                {
                    ok: true, status: 200, body: tokenHtml,
                    responseHeaders: { 'Set-Cookie': 'GUID=TESTGUID123; path=/' }
                },
                { ok: true, status: 200, body: mockResponse }
            ]);

            await adapter.getTorrents(); // triggers auto-login + API call

            // The second fetch (index 1) is the actual API call; it must carry the GUID cookie.
            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBe('GUID=TESTGUID123');
        });

        it('should not send Cookie header when Set-Cookie is absent', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123', status: 201, name: 'Test', size: 100,
                percent: 500, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }]);

            const fetchSpy = createMockFetchWithHeaders([
                // No responseHeaders — simulates server that doesn't set GUID
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: mockResponse }
            ]);

            await expect(adapter.getTorrents()).resolves.toBeDefined();

            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBeNull();
        });

        it('should re-capture GUID on session recovery re-login', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123', status: 201, name: 'Test', size: 100,
                percent: 500, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }]);

            const fetchSpy = createMockFetchWithHeaders([
                // First login → GUID_A
                { ok: true, status: 200, body: tokenHtml, responseHeaders: { 'Set-Cookie': 'GUID=GUID_A; path=/' } },
                // API call fails → triggers re-login
                { ok: false, status: 400, body: 'Invalid token' },
                // Re-login → GUID_B
                { ok: true, status: 200, body: tokenHtml, responseHeaders: { 'Set-Cookie': 'GUID=GUID_B; path=/' } },
                // Retry succeeds
                { ok: true, status: 200, body: mockResponse }
            ]);

            await adapter.getTorrents();

            expect(fetchSpy).toHaveBeenCalledTimes(4);

            // The retry (4th call, index 3) must use the refreshed GUID_B.
            const retryInit = fetchSpy.mock.calls[3][1] as RequestInit;
            const cookieHeader = retryInit?.headers instanceof Headers
                ? retryInit.headers.get('Cookie')
                : (retryInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBe('GUID=GUID_B');
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list with extended metadata', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123',
                status: 201, // Downloading + started
                name: 'Test Torrent',
                size: 1000000000,
                percent: 500, // 50% in permils (500/1000)
                downSpeed: 1000000,
                upSpeed: 500000,
                eta: 3600,
                label: 'movies',
                dateAdded: 1704067200,
                savePath: '/data/movies'
            }]);

            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: mockResponse }
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'ABC123',
                name: 'Test Torrent',
                category: 'movies',
                progress: 50, // 500/10 = 50%
                addedDate: 1704067200,
                savePath: '/data/movies'
            });
        });

        it('should return empty array when no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345, torrents: [], torrentc: '123' } }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });

        it('should use delta sync with cache ID on subsequent calls', async () => {
            const initialResponse = createTorrentListResponse([{
                hash: 'ABC123', status: 201, name: 'Test', size: 100,
                percent: 500, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }], 'CACHE_ID_1');

            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: initialResponse },
                { ok: true, status: 200, body: { build: 12345, torrentc: 'CACHE_ID_2' } }
            ]);

            // First call - gets full list
            await adapter.getTorrents();

            // Second call - should use cid parameter
            await adapter.getTorrents();

            // Verify the second call included the cache ID
            const secondCall = fetchSpy.mock.calls[2];
            expect(secondCall[0]).toContain('cid=CACHE_ID_1');
        });
    });

    describe('status mapping', () => {
        const testStatusMapping = async (status: number, percent: number, expectedStatus: string) => {
            const response = createTorrentListResponse([{
                hash: 'test', status, name: 'Test', size: 100,
                percent, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }]);
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe(expectedStatus);
        };

        it('should map downloading status (started, not complete)', async () => {
            // 201 = LOADED(128) + QUEUED(64) + CHECKED(8) + STARTED(1)
            await testStatusMapping(201, 500, 'downloading');
        });

        it('should map seeding status (started, 100% complete)', async () => {
            // Same status bits, but 100% progress
            await testStatusMapping(201, 1000, 'seeding');
        });

        it('should map paused status (bit 32)', async () => {
            await testStatusMapping(STATUS_FLAG.PAUSED | STATUS_FLAG.LOADED, 500, 'paused');
        });

        it('should map error status (bit 16) with highest priority', async () => {
            // Error takes priority over started
            await testStatusMapping(STATUS_FLAG.ERROR | STATUS_FLAG.STARTED, 500, 'error');
        });

        it('should map checking status (bit 2)', async () => {
            await testStatusMapping(STATUS_FLAG.CHECKING | STATUS_FLAG.LOADED, 500, 'checking');
        });

        it('should map forced start (no queue bit)', async () => {
            // 137 = LOADED(128) + CHECKED(8) + STARTED(1) - no QUEUED bit
            await testStatusMapping(137, 500, 'downloading');
        });

        it('should map queued seed (queued + 100%)', async () => {
            await testStatusMapping(STATUS_FLAG.QUEUED | STATUS_FLAG.LOADED, 1000, 'seeding');
        });
    });

    describe('session recovery', () => {
        it('should retry on 400/401 HTTP status errors regardless of message text', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123', status: 201, name: 'Test', size: 100,
                percent: 500, downSpeed: 100, upSpeed: 0, eta: 100, label: ''
            }]);

            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },        // Initial login
                { ok: false, status: 400, body: 'Bad request' },   // First call fails (400)
                { ok: true, status: 200, body: tokenHtml },        // Re-login
                { ok: false, status: 401, body: 'Unauthorized text' }, // Retry fails with 401
                { ok: true, status: 200, body: tokenHtml },        // Re-login again
                { ok: true, status: 200, body: mockResponse }      // Recovery succeeds
            ]);

            const torrents = await adapter.getTorrents();

            expect(fetchSpy).toHaveBeenCalledTimes(6);
            expect(torrents).toHaveLength(1);
        });

        it('should not retry on non-auth HTTP errors (e.g. 500) even if body mentions token', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: false, status: 500, body: 'Internal server error processing token' }
            ]);

            await expect(adapter.getTorrents()).rejects.toThrow('HTTP Error: 500 Error');
            expect(fetchSpy).toHaveBeenCalledTimes(2); // Only login + exact failed call
        });
    });

    describe('torrent actions', () => {
        it('should pause torrent via pause action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.pauseTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=pause');
        });

        it('should resume torrent via start action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.resumeTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=start');
        });

        it('should force start torrent via forcestart action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.forceStartTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=forcestart');
        });

        it('should recheck torrent via recheck action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.recheckTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=recheck');
        });

        it('should remove torrent without data via remove action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.removeTorrent('ABC123', false);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=remove');
        });

        it('should remove torrent with data via removedata action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.removeTorrent('ABC123', true);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(fetchSpy.mock.calls[1][0]).toContain('action=removedata');
        });
    });

    describe('bandwidth limits', () => {
        it('should set upload limit via setprops', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.setUploadLimit('ABC123', 102400);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('action=setprops');
            expect(url).toContain('s=ulrate');
            expect(url).toContain('v=102400');
        });

        it('should set download limit via setprops', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.setDownloadLimit('ABC123', 204800);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('action=setprops');
            expect(url).toContain('s=dlrate');
            expect(url).toContain('v=204800');
        });
    });

    describe('testConnection', () => {
        it('should return true on successful token fetch', async () => {
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml }
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

    describe('categories', () => {
        it('should return labels from list response', async () => {
            const response = {
                build: 12345,
                torrents: [],
                label: [['movies', 5], ['tv', 3]],
                torrentc: '123'
            };
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);

            const categories = await adapter.getCategories();

            expect(categories).toEqual(['movies', 'tv']);
        });

        it('should set category via setprops action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.setCategory('ABC123', 'movies');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('file management', () => {
        it('should get files for a torrent', async () => {
            const filesResponse = {
                build: 12345,
                files: [['ABC123', [
                    ['movie.mkv', 1000000, 500000, 2],
                    ['subtitles.srt', 50000, 50000, 2]
                ]]]
            };
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: filesResponse }
            ]);

            const files = await adapter.getFiles('ABC123');

            expect(files).toHaveLength(2);
            expect(files[0]).toMatchObject({
                index: 0,
                name: 'movie.mkv',
                size: 1000000,
                downloaded: 500000,
                priority: 2,
                progress: 50
            });
        });

        it('should set file priority via setprio action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.setFilePriority('ABC123', 0, 3);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('action=setprio');
            expect(url).toContain('f=0');
            expect(url).toContain('p=3');
        });

        it('should skip file by setting priority to 0', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.skipFile('ABC123', 1);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('p=0');
        });
    });

    describe('tracker management', () => {
        it('should get trackers from props', async () => {
            const propsResponse = {
                build: 12345,
                props: [{
                    hash: 'ABC123',
                    trackers: 'http://tracker1.com/announce\r\nhttp://tracker2.com/announce'
                }]
            };
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: propsResponse }
            ]);

            const trackers = await adapter.getTrackers('ABC123');

            expect(trackers).toEqual([
                'http://tracker1.com/announce',
                'http://tracker2.com/announce'
            ]);
        });

        it('should add tracker to torrent', async () => {
            const propsResponse = {
                build: 12345,
                props: [{ hash: 'ABC123', trackers: 'http://tracker1.com/announce' }]
            };
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: propsResponse },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.addTracker('ABC123', 'http://newtracker.com/announce');

            expect(fetchSpy).toHaveBeenCalledTimes(3);
            const url = fetchSpy.mock.calls[2][0] as string;
            expect(url).toContain('action=setprops');
            expect(url).toContain('s=trackers');
        });

        it('should set all trackers for a torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.setTrackers('ABC123', ['http://t1.com', 'http://t2.com']);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('s=trackers');
        });
    });
});

describe('UTorrentSettingsService', () => {
    let service: UTorrentSettingsService;

    beforeEach(() => {
        service = new UTorrentSettingsService(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GUID cookie handling', () => {
        it('should capture GUID from Set-Cookie response header', async () => {
            const fetchSpy = createMockFetchWithHeaders([
                {
                    ok: true, status: 200, body: tokenHtml,
                    responseHeaders: { 'Set-Cookie': 'GUID=SETTINGSGUID123; path=/' }
                },
                { ok: true, status: 200, body: { build: 12345, settings: [] } }
            ]);

            await service.getSettings();

            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBe('GUID=SETTINGSGUID123');
        });

        it('should not send Cookie header when Set-Cookie is absent', async () => {
            const fetchSpy = createMockFetchWithHeaders([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345, settings: [] } }
            ]);

            await service.getSettings();

            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBeNull();
        });
    });
});

describe('UTorrentRssService', () => {
    let service: UTorrentRssService;

    beforeEach(() => {
        service = new UTorrentRssService(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GUID cookie handling', () => {
        it('should capture GUID from Set-Cookie response header', async () => {
            const fetchSpy = createMockFetchWithHeaders([
                {
                    ok: true, status: 200, body: tokenHtml,
                    responseHeaders: { 'Set-Cookie': 'GUID=RSSGUID123; path=/' }
                },
                { ok: true, status: 200, body: { build: 12345, rssfeeds: [] } }
            ]);

            await service.getFeeds();

            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBe('GUID=RSSGUID123');
        });

        it('should not send Cookie header when Set-Cookie is absent', async () => {
            const fetchSpy = createMockFetchWithHeaders([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345, rssfeeds: [] } }
            ]);

            await service.getFeeds();

            const apiCallInit = fetchSpy.mock.calls[1][1] as RequestInit;
            const cookieHeader = apiCallInit?.headers instanceof Headers
                ? apiCallInit.headers.get('Cookie')
                : (apiCallInit?.headers as Record<string, string>)?.['Cookie'];
            expect(cookieHeader).toBeNull();
        });
    });

    describe('feed management', () => {
        it('should use canonical add-feed action and parameter for new feeds', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await service.addFeed('http://example.com/rss');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('action=add-feed');
            expect(url).toContain('url=http%3A%2F%2Fexample.com%2Frss');
            // Ensure we aren't sending legacy rss-update parameters
            expect(url).not.toContain('feed-id=-1');
            expect(url).not.toContain('s=http');
        });

        it('should include alias when provided', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await service.addFeed('http://example.com/rss', 'My Feed Alias');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const url = fetchSpy.mock.calls[1][0] as string;
            expect(url).toContain('alias=My+Feed+Alias');
        });
    });
});



describe('UTorrentAdapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: UTorrentErrorType[] = [
    'CONNECTION_REFUSED', 'TIMEOUT', 'AUTH_FAILED', 'TOKEN_ERROR',
    'ENDPOINT_NOT_FOUND', 'NETWORK_ERROR', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'utorrent',
        type: 'utorrent',
        hostname: 'http://localhost:8080/',
        username: 'admin',
        password: 'admin',
        directories: [],
        clientOptions: { retryConfig },
    };
}

function httpError(status: number, statusText = 'Error'): HttpError {
    return new HttpError(status, statusText, {} as Response);
}

// A token.html body extractUTorrentToken can parse, plus a GUID set-cookie header.
const TOKEN_RESPONSE = {
    body: "<html><div id='token' style='display:none;'>TOKEN123</div></html>",
    headers: { get: (k: string) => (k.toLowerCase() === 'set-cookie' ? 'GUID=abc123; path=/' : null) },
};

type GetRawSpy = { httpClient: { getRaw: (...args: unknown[]) => Promise<unknown> } };

describe('UTorrentAdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new UTorrentAdapterError('TOKEN_ERROR', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(UTorrentAdapterError);
        expect(e.type).toBe('TOKEN_ERROR');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('UTorrentAdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new UTorrentAdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new UTorrentAdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification', () => {
        it('maps a 400 HttpError → AUTH_FAILED', () => {
            expect(UTorrentAdapterError.from(httpError(400, 'Invalid Request')).type).toBe('AUTH_FAILED');
        });
        it('maps a 404 HttpError → ENDPOINT_NOT_FOUND', () => {
            expect(UTorrentAdapterError.from(httpError(404, 'Not Found')).type).toBe('ENDPOINT_NOT_FOUND');
        });
        it('maps a token-handshake failure → TOKEN_ERROR', () => {
            expect(UTorrentAdapterError.from(new Error('Failed to retrieve uTorrent token from response')).type).toBe('TOKEN_ERROR');
        });
        it('maps a fetch TypeError → CONNECTION_REFUSED', () => {
            expect(UTorrentAdapterError.from(new TypeError('Failed to fetch')).type).toBe('CONNECTION_REFUSED');
        });
        it('maps a timeout message → TIMEOUT', () => {
            expect(UTorrentAdapterError.from(new Error('Connection timed out')).type).toBe('TIMEOUT');
        });
        it('passes an existing UTorrentAdapterError through unchanged', () => {
            const original = new UTorrentAdapterError('ENDPOINT_NOT_FOUND', 'x');
            expect(UTorrentAdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(httpError(400, 'Invalid Request'));
            expect(UTorrentAdapterError.from(wrapped).type).toBe('AUTH_FAILED');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(UTorrentAdapterError.from(new Error('mystery')).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (uTorrent)', () => {
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
        const err = new UTorrentAdapterError('CONNECTION_REFUSED', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw httpError(400, 'Invalid Request'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('UTorrentAdapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new UTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new UTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(httpError(400, 'Invalid Request'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(UTorrentAdapterError);
        expect(result.error?.type).toBe('AUTH_FAILED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('classifies a token-handshake failure as TOKEN_ERROR', async () => {
        const adapter = new UTorrentAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('Failed to retrieve uTorrent token from response'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('TOKEN_ERROR');
    });

    it('retries a transient handshake failure before reporting connected', async () => {
        const adapter = new UTorrentAdapter(makeConfig(FAST_RETRY));
        let calls = 0;
        vi.spyOn((adapter as unknown as GetRawSpy).httpClient, 'getRaw').mockImplementation(async () => {
            calls++;
            if (calls < 2) throw new TypeError('Failed to fetch');
            return TOKEN_RESPONSE;
        });
        const result = await adapter.testConnection();
        expect(result.connected).toBe(true);
        expect(calls).toBe(2);
    });
});

});
