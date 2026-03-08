/**
 * QBittorrent Services Unit Tests
 * 
 * Tests for Phase 2 services:
 * - QBittorrentFileService
 * - QBittorrentTrackerService
 * - QBittorrentTransferService
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QBittorrentFileService, FilePriority } from '@/shared/api/clients/qbittorrent/QBittorrentFileService';
import { QBittorrentTrackerService, TrackerStatus } from '@/shared/api/clients/qbittorrent/QBittorrentTrackerService';
import { QBittorrentTransferService } from '@/shared/api/clients/qbittorrent/QBittorrentTransferService';
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';

// Mock FetchHttpClient
const mockClient = {
    get: vi.fn(),
    post: vi.fn(),
} as unknown as FetchHttpClient;

describe('QBittorrentFileService', () => {
    let service: QBittorrentFileService;

    beforeEach(() => {
        service = new QBittorrentFileService(mockClient);
        vi.clearAllMocks();
    });

    describe('getFiles', () => {
        it('should return parsed file list', async () => {
            const mockFiles = [
                { index: 0, name: 'video.mp4', size: 1000000, progress: 0.5, priority: 1 },
                { index: 1, name: 'subtitles.srt', size: 5000, progress: 1, priority: 1 },
            ];
            (mockClient.get as any).mockResolvedValue(mockFiles);

            const files = await service.getFiles('abc123');

            expect(mockClient.get).toHaveBeenCalledWith('torrents/files', { params: { hash: 'abc123' } });
            expect(files).toHaveLength(2);
            expect(files[0].name).toBe('video.mp4');
        });
    });

    describe('setFilePriority', () => {
        it('should set file priority with pipe-separated IDs', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.setFilePriority('abc123', [0, 1, 2], FilePriority.High);

            expect(mockClient.post).toHaveBeenCalledWith(
                'torrents/filePrio',
                expect.any(URLSearchParams)
            );
            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('hash')).toBe('abc123');
            expect(params.get('id')).toBe('0|1|2');
            expect(params.get('priority')).toBe('6'); // High = 6
        });
    });

    describe('skipFiles', () => {
        it('should skip files with priority 0', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.skipFiles('abc123', [0, 1]);

            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('priority')).toBe('0'); // Skip = 0
        });
    });

    describe('renameFile', () => {
        it('should rename file with old and new paths', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.renameFile('abc123', 'folder/old.txt', 'folder/new.txt');

            expect(mockClient.post).toHaveBeenCalledWith(
                'torrents/renameFile',
                expect.any(URLSearchParams)
            );
            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('oldPath')).toBe('folder/old.txt');
            expect(params.get('newPath')).toBe('folder/new.txt');
        });
    });
});

describe('QBittorrentTrackerService', () => {
    let service: QBittorrentTrackerService;

    beforeEach(() => {
        service = new QBittorrentTrackerService(mockClient);
        vi.clearAllMocks();
    });

    describe('getTrackers', () => {
        it('should return parsed tracker list', async () => {
            const mockTrackers = [
                { url: 'http://tracker1.com/announce', status: 2, tier: 0, num_peers: 10, num_seeds: 5, num_leeches: 5, num_downloaded: 100 },
                { url: 'http://tracker2.com/announce', status: 4, tier: 1, num_peers: 0, num_seeds: 0, num_leeches: 0, num_downloaded: 0, msg: 'Error' },
            ];
            (mockClient.get as any).mockResolvedValue(mockTrackers);

            const trackers = await service.getTrackers('abc123');

            expect(mockClient.get).toHaveBeenCalledWith('torrents/trackers', { params: { hash: 'abc123' } });
            expect(trackers).toHaveLength(2);
            expect(trackers[0].status).toBe(TrackerStatus.Working);
        });
    });

    describe('addTrackers', () => {
        it('should add trackers with newline-separated URLs', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.addTrackers('abc123', [
                'http://tracker1.com/announce',
                'http://tracker2.com/announce'
            ]);

            expect(mockClient.post).toHaveBeenCalledWith(
                'torrents/addTrackers',
                expect.any(URLSearchParams)
            );
            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('urls')).toBe('http://tracker1.com/announce\nhttp://tracker2.com/announce');
        });
    });

    describe('removeTrackers', () => {
        it('should remove trackers with pipe-separated URLs', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.removeTrackers('abc123', [
                'http://tracker1.com/announce',
                'http://tracker2.com/announce'
            ]);

            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('urls')).toBe('http://tracker1.com/announce|http://tracker2.com/announce');
        });
    });

    describe('editTracker', () => {
        it('should edit tracker URL', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.editTracker('abc123', 'http://old.com/announce', 'http://new.com/announce');

            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('origUrl')).toBe('http://old.com/announce');
            expect(params.get('newUrl')).toBe('http://new.com/announce');
        });
    });

    describe('reannounce', () => {
        it('should reannounce to all trackers for multiple torrents', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.reannounce(['hash1', 'hash2']);

            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('hashes')).toBe('hash1|hash2');
        });
    });

    describe('getWorkingTrackers', () => {
        it('should filter only working trackers', async () => {
            const mockTrackers = [
                { url: 'http://tracker1.com', status: 2, tier: 0, num_peers: 10, num_seeds: 5, num_leeches: 5, num_downloaded: 100 },
                { url: 'http://tracker2.com', status: 4, tier: 1, num_peers: 0, num_seeds: 0, num_leeches: 0, num_downloaded: 0 },
            ];
            (mockClient.get as any).mockResolvedValue(mockTrackers);

            const working = await service.getWorkingTrackers('abc123');

            expect(working).toHaveLength(1);
            expect(working[0].url).toBe('http://tracker1.com');
        });
    });
});

describe('QBittorrentTransferService', () => {
    let service: QBittorrentTransferService;

    beforeEach(() => {
        service = new QBittorrentTransferService(mockClient);
        vi.clearAllMocks();
    });

    describe('getTransferInfo', () => {
        it('should return parsed transfer info', async () => {
            const mockInfo = {
                dl_info_speed: 1000000,
                dl_info_data: 5000000000,
                up_info_speed: 500000,
                up_info_data: 2000000000,
                dl_rate_limit: 0,
                up_rate_limit: 0,
            };
            (mockClient.get as any).mockResolvedValue(mockInfo);

            const info = await service.getTransferInfo();

            expect(mockClient.get).toHaveBeenCalledWith('transfer/info');
            expect(info.dl_info_speed).toBe(1000000);
        });
    });

    describe('setGlobalDownloadLimit', () => {
        it('should set global download limit', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.setGlobalDownloadLimit(1024000);

            expect(mockClient.post).toHaveBeenCalledWith(
                'transfer/setDownloadLimit',
                expect.any(URLSearchParams)
            );
            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('limit')).toBe('1024000');
        });
    });

    describe('toggleAlternativeSpeedLimits', () => {
        it('should toggle alternative speed mode', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.toggleAlternativeSpeedLimits();

            expect(mockClient.post).toHaveBeenCalledWith('transfer/toggleSpeedLimitsMode');
        });
    });

    describe('isAlternativeSpeedLimitsEnabled', () => {
        it('should return true when mode is 1', async () => {
            (mockClient.get as any).mockResolvedValue(1);

            const enabled = await service.isAlternativeSpeedLimitsEnabled();

            expect(enabled).toBe(true);
        });

        it('should return false when mode is 0', async () => {
            (mockClient.get as any).mockResolvedValue(0);

            const enabled = await service.isAlternativeSpeedLimitsEnabled();

            expect(enabled).toBe(false);
        });
    });

    describe('setTorrentDownloadLimit', () => {
        it('should set download limit for multiple torrents', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.setTorrentDownloadLimit(['hash1', 'hash2'], 512000);

            const params = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            expect(params.get('hashes')).toBe('hash1|hash2');
            expect(params.get('limit')).toBe('512000');
        });
    });

    describe('setTorrentLimits', () => {
        it('should set both download and upload limits in parallel', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.setTorrentLimits(['hash1'], 1000000, 500000);

            expect(mockClient.post).toHaveBeenCalledTimes(2);
        });
    });

    describe('removeTorrentLimits', () => {
        it('should set limits to 0 (unlimited)', async () => {
            (mockClient.post as any).mockResolvedValue({});

            await service.removeTorrentLimits(['hash1']);

            expect(mockClient.post).toHaveBeenCalledTimes(2);
            const dlParams = (mockClient.post as any).mock.calls[0][1] as URLSearchParams;
            const upParams = (mockClient.post as any).mock.calls[1][1] as URLSearchParams;
            expect(dlParams.get('limit')).toBe('0');
            expect(upParams.get('limit')).toBe('0');
        });
    });
});
