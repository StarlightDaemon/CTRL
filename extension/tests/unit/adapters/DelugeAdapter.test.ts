/**
 * DelugeAdapter Unit Tests
 * 
 * Tests the Deluge JSON-RPC adapter including multi-step handshake,
 * re-authentication logic, and daemon connection handling.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DelugeAdapter } from '@/shared/api/clients/deluge/DelugeAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Deluge Server',
    application: 'deluge',
    type: 'deluge',
    hostname: 'http://localhost:8112',
    username: '', // Deluge uses password-only auth
    password: 'deluge',
    directories: [],
    clientOptions: {},
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
                // 4. web.connect - success
                { ok: true, status: 200, body: rpcResponse(null) },
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(4);
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
            expect(result).toBe(true);
        });

        it('should return false on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testConnection();
            expect(result).toBe(false);
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
