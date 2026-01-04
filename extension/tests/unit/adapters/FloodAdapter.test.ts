/**
 * FloodAdapter Unit Tests
 * 
 * Tests the Flood REST API adapter including JWT authentication,
 * torrent operations, and tag management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FloodAdapter } from '@/shared/api/clients/flood/FloodAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Flood Server',
    application: 'flood',
    type: 'flood',
    hostname: 'http://localhost:3000',
    username: 'admin',
    password: 'adminpass',
    directories: [],
    clientOptions: {},
};

// Helper to create mock responses
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

describe('FloodAdapter', () => {
    let adapter: FloodAdapter;

    beforeEach(() => {
        adapter = new FloodAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should authenticate and store token', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt-token-123' } }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should throw on auth failure', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: false } }
            ]);

            await expect(adapter.login()).rejects.toThrow('Flood authentication failed');
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
            const mockTorrent = {
                hash: 'abc123hash',
                name: 'Test Torrent',
                state: ['downloading', 'active'],
                progress: 0.5,
                sizeBytes: 1000000000,
                bytesDone: 500000000,
                dnRate: 1000000,
                upRate: 500000,
                eta: 3600,
                peers: 10,
                seeds: 5,
                ratio: 0.5,
                added: 1700000000,
                tags: ['movies']
            };

            createMockFetch([
                { ok: true, status: 200, body: { torrents: [mockTorrent] } }
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123hash',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
                tags: ['movies'],
            });
        });

        it('should return empty array for no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { torrents: [] } }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should include options when provided', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                path: '/downloads/movies',
                label: 'movies'
            });
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by hash', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.pauseTorrent('abc123hash');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by hash', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.resumeTorrent('abc123hash');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent without deleting data', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.removeTorrent('abc123hash', false);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should remove torrent and delete data', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.removeTorrent('abc123hash', true);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful login', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt' } }
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
        it('should map flood state arrays correctly', async () => {
            const createTorrentResponse = (state: string[]) => ({
                torrents: [{
                    hash: 'test',
                    name: 'Test',
                    state,
                    progress: 0.5,
                    sizeBytes: 100,
                    bytesDone: 50,
                    dnRate: 0,
                    upRate: 0,
                    eta: 0,
                    peers: 0,
                    seeds: 0,
                    ratio: 0,
                    added: 0,
                    tags: []
                }]
            });

            // Downloading state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['downloading', 'active']) }]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Seeding state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['seeding']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');

            // Paused state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['paused']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Stopped state (also maps to paused)
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['stopped']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Error state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['error']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });
    });

    describe('tags', () => {
        it('should get tags from API', async () => {
            createMockFetch([
                { ok: true, status: 200, body: ['movies', 'tv', 'music'] }
            ]);

            const tags = await adapter.getTags();

            expect(tags).toEqual(['movies', 'tv', 'music']);
        });

        it('should return empty array on error', async () => {
            createMockFetch([
                { ok: false, status: 500, body: { error: 'Server error' } }
            ]);

            const tags = await adapter.getTags();

            expect(tags).toEqual([]);
        });

        it('should add tags to torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            await adapter.addTags('abc123hash', ['newTag']);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('categories', () => {
        it('should use tags as categories', async () => {
            createMockFetch([
                { ok: true, status: 200, body: ['cat1', 'cat2'] }
            ]);

            const categories = await adapter.getCategories();

            expect(categories).toEqual(['cat1', 'cat2']);
        });
    });
});
