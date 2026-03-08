/**
 * QBittorrent Transfer/Bandwidth Control Service
 * 
 * Provides bandwidth management operations:
 * - Global transfer info and limits
 * - Per-torrent speed limits
 * - Alternative speed mode (scheduled)
 * - Speed limit toggling
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentTransferInfoSchema,
    QBittorrentTransferInfo
} from './QBittorrentSchema';

/**
 * Service for managing bandwidth and transfer settings
 */
export class QBittorrentTransferService {
    constructor(private client: FetchHttpClient) { }

    // ============================================
    // Global Transfer Info
    // ============================================

    /**
     * Get global transfer information
     * Includes current speeds, limits, and connection status
     */
    async getTransferInfo(): Promise<QBittorrentTransferInfo> {
        const data = await this.client.get('transfer/info');
        return QBittorrentTransferInfoSchema.parse(data);
    }

    /**
     * Get current global download speed (bytes/sec)
     */
    async getGlobalDownloadSpeed(): Promise<number> {
        const info = await this.getTransferInfo();
        return info.dl_info_speed;
    }

    /**
     * Get current global upload speed (bytes/sec)
     */
    async getGlobalUploadSpeed(): Promise<number> {
        const info = await this.getTransferInfo();
        return info.up_info_speed;
    }

    // ============================================
    // Global Speed Limits
    // ============================================

    /**
     * Get current global download speed limit
     * @returns Limit in bytes/sec, 0 = unlimited
     */
    async getGlobalDownloadLimit(): Promise<number> {
        const data = await this.client.get<number>('transfer/downloadLimit');
        return data;
    }

    /**
     * Set global download speed limit
     * @param limit - Limit in bytes/sec, 0 = unlimited
     */
    async setGlobalDownloadLimit(limit: number): Promise<void> {
        await this.client.post('transfer/setDownloadLimit',
            new URLSearchParams({ limit: String(limit) })
        );
    }

    /**
     * Get current global upload speed limit
     * @returns Limit in bytes/sec, 0 = unlimited
     */
    async getGlobalUploadLimit(): Promise<number> {
        const data = await this.client.get<number>('transfer/uploadLimit');
        return data;
    }

    /**
     * Set global upload speed limit
     * @param limit - Limit in bytes/sec, 0 = unlimited
     */
    async setGlobalUploadLimit(limit: number): Promise<void> {
        await this.client.post('transfer/setUploadLimit',
            new URLSearchParams({ limit: String(limit) })
        );
    }

    // ============================================
    // Alternative Speed Limits (Scheduled Mode)
    // ============================================

    /**
     * Check if alternative speed limits mode is enabled
     */
    async isAlternativeSpeedLimitsEnabled(): Promise<boolean> {
        const data = await this.client.get<number>('transfer/speedLimitsMode');
        return data === 1;
    }

    /**
     * Toggle alternative speed limits mode
     */
    async toggleAlternativeSpeedLimits(): Promise<void> {
        await this.client.post('transfer/toggleSpeedLimitsMode');
    }

    /**
     * Enable alternative speed limits
     */
    async enableAlternativeSpeedLimits(): Promise<void> {
        const isEnabled = await this.isAlternativeSpeedLimitsEnabled();
        if (!isEnabled) {
            await this.toggleAlternativeSpeedLimits();
        }
    }

    /**
     * Disable alternative speed limits
     */
    async disableAlternativeSpeedLimits(): Promise<void> {
        const isEnabled = await this.isAlternativeSpeedLimitsEnabled();
        if (isEnabled) {
            await this.toggleAlternativeSpeedLimits();
        }
    }

    // ============================================
    // Per-Torrent Speed Limits
    // ============================================

    /**
     * Set download speed limit for specific torrents
     * @param hashes - Array of torrent hashes
     * @param limit - Limit in bytes/sec, 0 = unlimited
     */
    async setTorrentDownloadLimit(hashes: string[], limit: number): Promise<void> {
        await this.client.post('torrents/setDownloadLimit',
            new URLSearchParams({
                hashes: hashes.join('|'),
                limit: String(limit),
            })
        );
    }

    /**
     * Set upload speed limit for specific torrents
     * @param hashes - Array of torrent hashes
     * @param limit - Limit in bytes/sec, 0 = unlimited
     */
    async setTorrentUploadLimit(hashes: string[], limit: number): Promise<void> {
        await this.client.post('torrents/setUploadLimit',
            new URLSearchParams({
                hashes: hashes.join('|'),
                limit: String(limit),
            })
        );
    }

    /**
     * Get download speed limit for a torrent
     * @param hashes - Array of torrent hashes
     * @returns Map of hash -> limit (bytes/sec)
     */
    async getTorrentDownloadLimit(hashes: string[]): Promise<Record<string, number>> {
        const data = await this.client.post<Record<string, number>>(
            'torrents/downloadLimit',
            new URLSearchParams({ hashes: hashes.join('|') })
        );
        return data;
    }

    /**
     * Get upload speed limit for a torrent
     * @param hashes - Array of torrent hashes
     * @returns Map of hash -> limit (bytes/sec)
     */
    async getTorrentUploadLimit(hashes: string[]): Promise<Record<string, number>> {
        const data = await this.client.post<Record<string, number>>(
            'torrents/uploadLimit',
            new URLSearchParams({ hashes: hashes.join('|') })
        );
        return data;
    }

    /**
     * Remove speed limits from specific torrents (set to unlimited)
     * @param hashes - Array of torrent hashes
     */
    async removeTorrentLimits(hashes: string[]): Promise<void> {
        await this.setTorrentDownloadLimit(hashes, 0);
        await this.setTorrentUploadLimit(hashes, 0);
    }

    // ============================================
    // Convenience Methods
    // ============================================

    /**
     * Set both upload and download limits for specific torrents
     * @param hashes - Array of torrent hashes
     * @param downloadLimit - Download limit in bytes/sec
     * @param uploadLimit - Upload limit in bytes/sec
     */
    async setTorrentLimits(
        hashes: string[],
        downloadLimit: number,
        uploadLimit: number
    ): Promise<void> {
        await Promise.all([
            this.setTorrentDownloadLimit(hashes, downloadLimit),
            this.setTorrentUploadLimit(hashes, uploadLimit),
        ]);
    }

    /**
     * Set global speed limits (both download and upload)
     * @param downloadLimit - Download limit in bytes/sec, 0 = unlimited
     * @param uploadLimit - Upload limit in bytes/sec, 0 = unlimited
     */
    async setGlobalLimits(downloadLimit: number, uploadLimit: number): Promise<void> {
        await Promise.all([
            this.setGlobalDownloadLimit(downloadLimit),
            this.setGlobalUploadLimit(uploadLimit),
        ]);
    }

    /**
     * Remove all global speed limits
     */
    async removeGlobalLimits(): Promise<void> {
        await this.setGlobalLimits(0, 0);
    }
}
