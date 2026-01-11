/**
 * UTorrentAdapter Unit Tests
 * 
 * Tests the uTorrent WebUI adapter including token-based authentication,
 * query string API, and status bitmask mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UTorrentAdapter } from '@/shared/api/clients/utorrent/UTorrentAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'uTorrent Server',
    application: 'utorrent',
    type: 'utorrent',
    hostname: 'http://localhost:8080',
    username: 'admin',
    password: 'adminpass',
    directories: [],
    clientOptions: {},
};

// Mock DOMParser for token parsing
class MockDOMParser {
    parseFromString(str: string, type: string) {
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

// Token HTML response
const tokenHtml = '<html><body><div id="token">ABC123TOKEN</div></body></html>';

// Mock torrent list response
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
}>) => ({
    build: 12345,
    torrents: torrents.map(t => [
        t.hash,      // 0: hash
        t.status,    // 1: status
        t.name,      // 2: name
        t.size,      // 3: size
        t.percent,   // 4: percent (promille)
        0,           // 5: downloaded
        0,           // 6: uploaded
        0,           // 7: ratio
        t.upSpeed,   // 8: upspeed
        t.downSpeed, // 9: downspeed
        t.eta,       // 10: eta
        t.label,     // 11: label
    ])
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
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
            const mockResponse = createTorrentListResponse([{
                hash: 'ABC123',
                status: 201, // Downloading + started
                name: 'Test Torrent',
                size: 1000000000,
                percent: 500, // 50% in promille (500/1000)
                downSpeed: 1000000,
                upSpeed: 500000,
                eta: 3600,
                label: 'movies'
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
                category: 'movies'
            });
        });

        it('should return empty array when no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345, torrents: [] } }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent via add-url action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent via stop action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.pauseTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent via start action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.resumeTorrent('ABC123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent without data via remove action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.removeTorrent('ABC123', false);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should remove torrent with data via removedata action', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: { build: 12345 } }
            ]);

            await adapter.removeTorrent('ABC123', true);

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('testConnection', () => {
        it('should return true on successful token fetch', async () => {
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml }
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

    describe('status mapping', () => {
        it('should map downloading status (bit 1)', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', status: 1, name: 'Test', size: 100, percent: 500,
                downSpeed: 100, upSpeed: 0, eta: 100, label: 'test'
            }]);
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');
        });

        it('should map paused status (bit 32)', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', status: 32, name: 'Test', size: 100, percent: 500,
                downSpeed: 0, upSpeed: 0, eta: 0, label: 'test'
            }]);
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');
        });

        it('should map error status (bit 16)', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', status: 16, name: 'Test', size: 100, percent: 500,
                downSpeed: 0, upSpeed: 0, eta: 0, label: 'test'
            }]);
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });

        it('should map checking status (bit 2)', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', status: 2, name: 'Test', size: 100, percent: 500,
                downSpeed: 0, upSpeed: 0, eta: 0, label: 'test'
            }]);
            createMockFetch([
                { ok: true, status: 200, body: tokenHtml },
                { ok: true, status: 200, body: response }
            ]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('checking');
        });
    });

    describe('categories', () => {
        it('should return labels from list response', async () => {
            const response = {
                build: 12345,
                torrents: [],
                label: [['movies', 5], ['tv', 3]]
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
});
