/**
 * QBittorrent Optimization Services Unit Tests (Phase 3)
 * 
 * Tests for:
 * - QBittorrentSyncService (Delta updating)
 * - QBittorrentRssService (Feeds/Rules)
 * - QBittorrentSearchService (Jobs/Plugins)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QBittorrentSyncService } from '@/shared/api/clients/qbittorrent/QBittorrentSyncService';
import { QBittorrentRssService } from '@/shared/api/clients/qbittorrent/QBittorrentRssService';
import { QBittorrentSearchService } from '@/shared/api/clients/qbittorrent/QBittorrentSearchService';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';

// Mock Client
const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
} as unknown as FetchHttpClient;

describe('QBittorrentSyncService', () => {
    let service: QBittorrentSyncService;

    beforeEach(() => {
        service = new QBittorrentSyncService(mockClient);
        vi.clearAllMocks();
    });

    it('should handle full_update correctly', async () => {
        const fullData = {
            rid: 123,
            full_update: true,
            torrents: {
                'hash1': { name: 'Torrent 1', progress: 0.5 },
                'hash2': { name: 'Torrent 2', progress: 1.0 }
            },
            categories: { 'cat1': { name: 'cat1', savePath: '/tmp' } }
        };
        (mockClient.get as any).mockResolvedValue(fullData);

        const state = await service.sync();

        expect(service.getTorrents()).toHaveLength(2);
        expect(state.rid).toBe(123);
    });

    it('should merge delta updates for torrents', async () => {
        // First sync (Initial)
        (mockClient.get as any).mockResolvedValueOnce({
            rid: 1,
            full_update: true,
            torrents: { 'hash1': { name: 'Test', progress: 0.1, dlspeed: 100 } }
        });
        await service.sync();

        // Second sync (Delta)
        (mockClient.get as any).mockResolvedValueOnce({
            rid: 2,
            torrents: { 'hash1': { progress: 0.2, dlspeed: 200 } } // Only changed fields
        });
        const state = await service.sync();

        expect(state.torrents['hash1'].name).toBe('Test'); // Preserved
        expect(state.torrents['hash1'].progress).toBe(0.2); // Updated
        expect(state.torrents['hash1'].dlspeed).toBe(200);
    });

    it('should remove torrents listed in torrents_removed', async () => {
        // Initial state
        (mockClient.get as any).mockResolvedValueOnce({
            rid: 1,
            full_update: true,
            torrents: { 'hash1': { name: 'T1' }, 'hash2': { name: 'T2' } }
        });
        await service.sync();

        // Removal update
        (mockClient.get as any).mockResolvedValueOnce({
            rid: 2,
            torrents_removed: ['hash1']
        });
        await service.sync();

        expect(service.getTorrents()).toHaveLength(1);
        expect(service.getTorrents()[0].name).toBe('T2');
    });
});

describe('QBittorrentRssService', () => {
    let service: QBittorrentRssService;

    beforeEach(() => {
        service = new QBittorrentRssService(mockClient);
        vi.clearAllMocks();
    });

    it('should add feed with path', async () => {
        (mockClient.post as any).mockResolvedValue({});

        await service.addFeed('http://rss.com', 'Linux');

        expect(mockClient.post).toHaveBeenCalledWith('rss/addFeed', expect.any(URLSearchParams));
    });

    it('should set auto-download rule', async () => {
        (mockClient.post as any).mockResolvedValue({});

        const rule = {
            enabled: true,
            mustContain: 'linux',
            mustNotContain: 'win',
            useRegex: true,
            episodeFilter: '',
            smartFilter: false,
            affectedFeeds: ['http://rss.com']
        };

        await service.setRule('MyRule', rule);

        const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
        expect(params.get('ruleName')).toBe('MyRule');
        expect(JSON.parse(params.get('ruleDef')!)).toMatchObject(rule);
    });
});

describe('QBittorrentSearchService', () => {
    let service: QBittorrentSearchService;

    beforeEach(() => {
        service = new QBittorrentSearchService(mockClient);
        vi.clearAllMocks();
    });

    it('should start search and return ID', async () => {
        (mockClient.post as any).mockResolvedValue({ id: 101 });

        const id = await service.startSearch('ubuntu');

        expect(id).toBe(101);
        expect(mockClient.post).toHaveBeenCalledWith('search/start', expect.any(URLSearchParams));
    });

    it('should get search results', async () => {
        (mockClient.post as any).mockResolvedValue({
            results: [{
                fileName: 'Ubuntu 24.04',
                fileSize: 1000,
                fileUrl: 'magnet:?',
                nbLeechers: 5,
                nbSeeders: 100,
                siteUrl: 'http://linux.org'
            }]
        });

        const results = await service.getResults(101);

        expect(results).toHaveLength(1);
        expect(results[0].fileName).toBe('Ubuntu 24.04');
    });
});
