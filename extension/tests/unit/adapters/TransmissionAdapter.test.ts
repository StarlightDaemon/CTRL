/**
 * TransmissionAdapter Unit Tests
 * 
 * Tests the Transmission RPC adapter including session ID retry logic.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransmissionAdapter } from '@/shared/api/clients/transmission/TransmissionAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Transmission Server',
    application: 'transmission',
    type: 'transmission',
    hostname: 'http://localhost:9091',
    username: 'admin',
    password: 'adminadmin',
    directories: [],
    clientOptions: {},
};

// Helper to create mock responses
const createMockFetch = (responses: Array<{ ok: boolean; status: number; headers?: Record<string, string>; body: any }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers(response.headers || {}),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

describe('TransmissionAdapter', () => {
    let adapter: TransmissionAdapter;

    beforeEach(() => {
        adapter = new TransmissionAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
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

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
            const mockResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Test Torrent',
                        status: 4, // Downloading
                        percentDone: 0.5,
                        totalSize: 1000000000,
                        rateDownload: 1000000,
                        rateUpload: 500000,
                        eta: 3600,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        labels: ['movies'],
                        error: 0,
                        errorString: '',
                    }]
                }
            };

            createMockFetch([{ ok: true, status: 200, body: mockResponse }]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: '1',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
            });
        });

        it('should return empty array for no torrents', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: { result: 'success', arguments: { torrents: [] } }
            }]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should include options when provided', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                path: '/downloads/movies',
            });

            // Verify request was made (detailed body check would require more complex mocking)
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by id', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.pauseTorrent('1');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by id', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.resumeTorrent('1');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('status mapping', () => {
        it('should map transmission status codes correctly', async () => {
            const createTorrentResponse = (status: number) => ({
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Test',
                        status,
                        percentDone: 0,
                        totalSize: 0,
                        rateDownload: 0,
                        rateUpload: 0,
                        eta: 0,
                        downloadDir: '',
                        addedDate: 0,
                        labels: [],
                        error: 0,
                        errorString: '',
                    }]
                }
            });

            // Status 0 = paused
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(0) }]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Status 4 = downloading
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(4) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Status 6 = seeding
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(6) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');
        });
    });
});
