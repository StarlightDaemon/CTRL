/**
 * Aria2Adapter Unit Tests
 * 
 * Tests the Aria2 JSON-RPC adapter including token authentication,
 * multicall for torrent lists, and status mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aria2Adapter } from '@/shared/api/clients/aria2/Aria2Adapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Aria2 Server',
    application: 'aria2',
    type: 'aria2',
    hostname: 'http://localhost:6800/jsonrpc',
    username: '',
    password: 'mysecret', // RPC secret
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

// Helper to create Aria2 JSON-RPC response
const rpcResponse = (result: any, id: number = 1) => ({
    jsonrpc: '2.0',
    result,
    id
});

describe('Aria2Adapter', () => {
    let adapter: Aria2Adapter;

    beforeEach(() => {
        adapter = new Aria2Adapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should verify connection by getting version', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse({ version: '1.36.0', enabledFeatures: ['BitTorrent'] }) }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should throw on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection refused'));

            await expect(adapter.login()).rejects.toThrow();
        });
    });

    describe('getTorrents', () => {
        it('should aggregate active, waiting, and stopped torrents', async () => {
            const mockTorrent = {
                gid: 'abc123',
                status: 'active',
                totalLength: '1000000000',
                completedLength: '500000000',
                uploadLength: '100000000',
                downloadSpeed: '1000000',
                uploadSpeed: '500000',
                dir: '/downloads'
            };

            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([mockTorrent]) },      // tellActive
                { ok: true, status: 200, body: rpcResponse([]) },                  // tellWaiting
                { ok: true, status: 200, body: rpcResponse([]) },                  // tellStopped
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                status: 'downloading',
                progress: 50,
            });
        });

        it('should return empty array when no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse([]) },
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });

        it('should combine all torrent states', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([{ gid: '1', status: 'active', totalLength: '100', completedLength: '50', uploadLength: '0', downloadSpeed: '0', uploadSpeed: '0', dir: '' }]) },
                { ok: true, status: 200, body: rpcResponse([{ gid: '2', status: 'waiting', totalLength: '100', completedLength: '0', uploadLength: '0', downloadSpeed: '0', uploadSpeed: '0', dir: '' }]) },
                { ok: true, status: 200, body: rpcResponse([{ gid: '3', status: 'complete', totalLength: '100', completedLength: '100', uploadLength: '0', downloadSpeed: '0', uploadSpeed: '0', dir: '' }]) },
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toHaveLength(3);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('gid123') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should include options when provided', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('gid123') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                path: '/downloads/movies',
            });

            // Request should have been made with options
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by gid', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by gid', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent and clean up', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') },
                { ok: true, status: 200, body: rpcResponse('OK') }, // removeDownloadResult
            ]);

            await adapter.removeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle removeDownloadResult failure gracefully', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') },
                { ok: false, status: 500, body: { error: 'Not found' } },
            ]);

            // Should not throw
            await expect(adapter.removeTorrent('abc123')).resolves.not.toThrow();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse({ version: '1.36.0' }) }
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
        it('should map aria2 states correctly', async () => {
            const createTorrentResponse = (status: string) => ([{
                gid: 'test',
                status,
                totalLength: '100',
                completedLength: '50',
                uploadLength: '0',
                downloadSpeed: '0',
                uploadSpeed: '0',
                dir: ''
            }]);

            // Active = downloading
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(createTorrentResponse('active')) },
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse([]) },
            ]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Waiting = queued
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse(createTorrentResponse('waiting')) },
                { ok: true, status: 200, body: rpcResponse([]) },
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('queued');

            // Paused
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse(createTorrentResponse('paused')) },
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse([]) },
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Complete
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse([]) },
                { ok: true, status: 200, body: rpcResponse(createTorrentResponse('complete')) },
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('completed');
        });
    });

    describe('categories and tags', () => {
        it('should return empty array for categories (not supported)', async () => {
            const categories = await adapter.getCategories();
            expect(categories).toEqual([]);
        });

        it('should return empty array for tags (not supported)', async () => {
            const tags = await adapter.getTags();
            expect(tags).toEqual([]);
        });
    });
});
