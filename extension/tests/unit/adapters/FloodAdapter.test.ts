/**
 * FloodAdapter Unit Tests
 * 
 * Tests the Flood REST API adapter including:
 * - JWT authentication and session verification
 * - Torrent operations (CRUD)
 * - Tag management
 * - Error handling (timeout, rate limit, auth errors)
 * - Backend connection testing
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
            headers: new Headers({
                'X-RateLimit-Limit': '100',
                'X-RateLimit-Remaining': '99',
                'X-RateLimit-Reset': String(Date.now() + 60000),
            }),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

// Helper to create a mock torrent
const createMockTorrent = (overrides: Partial<any> = {}) => ({
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
    tags: ['movies'],
    basePath: '/downloads/movies',
    ...overrides,
});

describe('FloodAdapter', () => {
    let adapter: FloodAdapter;

    beforeEach(() => {
        adapter = new FloodAdapter(mockConfig);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    // ========================================================================
    // Authentication Tests
    // ========================================================================

    describe('login', () => {
        it('should authenticate and store token', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt-token-123' } }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should handle cookie-based auth (success without token)', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true } }
            ]);

            // Should not throw
            await expect(adapter.login()).resolves.toBeUndefined();
        });

        it('should throw FloodAuthError on auth failure', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: false } }
            ]);

            await expect(adapter.login()).rejects.toThrow('Flood authentication failed');
        });
    });

    describe('verifySession', () => {
        it('should return session info when connected', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt' } },
                { ok: true, status: 200, body: { username: 'admin', level: 'admin', clientConnected: true } }
            ]);

            await adapter.login();
            const session = await adapter.verifySession();

            expect(session.username).toBe('admin');
            expect(session.clientConnected).toBe(true);
        });

        it('should throw FloodBackendDisconnectedError when client not connected', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt' } },
                { ok: true, status: 200, body: { username: 'admin', level: 'user', clientConnected: false } }
            ]);

            await adapter.login();
            await expect(adapter.verifySession()).rejects.toThrow('Torrent client backend is not connected');
        });
    });

    // ========================================================================
    // Connection Testing
    // ========================================================================

    describe('testBackendConnection', () => {
        it('should return true when backend is connected', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { isConnected: true } }
            ]);

            const result = await adapter.testBackendConnection();
            expect(result).toBe(true);
        });

        it('should return false when backend is disconnected', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { isConnected: false } }
            ]);

            const result = await adapter.testBackendConnection();
            expect(result).toBe(false);
        });

        it('should return false on network error', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testBackendConnection();
            expect(result).toBe(false);
        });
    });

    describe('testConnection', () => {
        it('should return true on successful login and session verify', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt' } },
                { ok: true, status: 200, body: { username: 'admin', clientConnected: true } }
            ]);

            const result = await adapter.testConnection();
            expect(result).toBe(true);
        });

        it('should return false when backend disconnected', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { success: true, token: 'jwt' } },
                { ok: true, status: 200, body: { username: 'admin', clientConnected: false } }
            ]);

            const result = await adapter.testConnection();
            expect(result).toBe(false);
        });
    });

    // ========================================================================
    // Torrent Operations
    // ========================================================================

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { torrents: [createMockTorrent()] } }
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123hash',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
                tags: ['movies'],
                savePath: '/downloads/movies',
            });
        });

        it('should return empty array for no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { torrents: [] } }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });

        it('should extract savePath from basePath or directory', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { torrents: [createMockTorrent({ basePath: undefined, directory: '/alt/path' })] } }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents[0].savePath).toBe('/alt/path');
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
                label: 'movies',
                sequentialDownload: true,
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

    // ========================================================================
    // Status Mapping
    // ========================================================================

    describe('status mapping', () => {
        it('should map flood state arrays correctly', async () => {
            const createTorrentResponse = (state: string[]) => ({
                torrents: [createMockTorrent({ state })]
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

            // Stopped state (qBittorrent v5 - also maps to paused)
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['stopped']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Error state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['error']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');

            // Checking/hashing state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['hashing']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('checking');

            // Queued state
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(['queued']) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('queued');
        });
    });

    // ========================================================================
    // Tag Management
    // ========================================================================

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

    // ========================================================================
    // System Information
    // ========================================================================

    describe('getDiskUsage', () => {
        it('should return disk usage information', async () => {
            createMockFetch([
                {
                    ok: true, status: 200, body: [
                        { path: '/downloads', free: 100000000000, total: 500000000000, used: 400000000000, percent: 80 }
                    ]
                }
            ]);

            const usage = await adapter.getDiskUsage();

            expect(usage).toHaveLength(1);
            expect(usage[0].path).toBe('/downloads');
            expect(usage[0].percent).toBe(80);
        });
    });

    describe('detectBackendType', () => {
        it('should detect rTorrent from scgiPath', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { scgiPath: '/run/rtorrent/rpc.socket' } }
            ]);

            const backend = await adapter.detectBackendType();
            expect(backend).toBe('rtorrent');
        });

        it('should detect qBittorrent from webApiUrl', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { webApiUrl: 'http://localhost:8080' } }
            ]);

            const backend = await adapter.detectBackendType();
            expect(backend).toBe('qbittorrent');
        });

        it('should detect transmission from rpcUrl', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { rpcUrl: 'http://localhost:9091/transmission/rpc' } }
            ]);

            const backend = await adapter.detectBackendType();
            expect(backend).toBe('transmission');
        });

        it('should cache the backend type', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { scgiPath: '/run/rtorrent/rpc.socket' } }
            ]);

            await adapter.detectBackendType();
            await adapter.detectBackendType();

            // Only one fetch call because result is cached
            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    // ========================================================================
    // Timeout Handling (Note: These require real timers for accurate testing)
    // ========================================================================

    describe('timeout handling', () => {
        it('should enforce timeout on requests', async () => {
            vi.useRealTimers(); // Need real timers for timeout testing

            // Create a fetch that never resolves
            vi.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => { }));

            const promise = adapter.getTorrents();

            // Should reject with timeout error
            await expect(promise).rejects.toThrow('timeout');
        }, 10000);
    });
});
