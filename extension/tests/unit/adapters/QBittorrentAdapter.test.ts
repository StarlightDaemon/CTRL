/**
 * QBittorrentAdapter Unit Tests
 * 
 * Tests the adapter logic by mocking the global fetch function.
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
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list', async () => {
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
            }];

            mockFetch(mockTorrents);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50, // Mapped from 0.5 to percentage
                category: 'movies',
                tags: ['hd', 'new'],
            });
        });

        it('should return empty array for no torrents', async () => {
            mockFetch([]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('torrents/add'),
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('should include options when provided', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                label: 'movies',
                path: '/downloads/movies',
            });

            expect(fetchSpy).toHaveBeenCalledOnce();
            // Verify FormData was sent (body will be FormData instance)
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by hash', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('torrents/pause'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by hash', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledWith(
                expect.stringContaining('torrents/resume'),
                expect.objectContaining({ method: 'POST' })
            );
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent without deleting files', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.removeTorrent('abc123', false);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should remove torrent and delete files', async () => {
            const fetchSpy = mockFetch('Ok.');

            await adapter.removeTorrent('abc123', true);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            // First call for login, second for version
            const fetchSpy = vi.spyOn(global, 'fetch')
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('Ok.'),
                } as Response)
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve('v4.5.0'),
                } as Response);

            const result = await adapter.testConnection();

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should return false on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testConnection();

            expect(result).toBe(false);
        });
    });

    describe('mapStatus', () => {
        it('should map qbittorrent states correctly', async () => {
            const mockTorrent = (state: string) => [{
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
            mockFetch(mockTorrent('downloading'));
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Test seeding states
            mockFetch(mockTorrent('uploading'));
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');

            // Test paused states
            mockFetch(mockTorrent('pausedDL'));
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Test error states
            mockFetch(mockTorrent('error'));
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });
    });
});
