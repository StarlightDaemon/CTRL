/**
 * QBittorrent Tracker Management Service
 * 
 * Provides tracker operations for torrents:
 * - List trackers with status
 * - Add/remove trackers
 * - Edit tracker URLs
 * - Force reannounce
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentTrackerListSchema,
    QBittorrentTracker
} from './QBittorrentSchema';

/**
 * Tracker status codes returned by qBittorrent
 */
export enum TrackerStatus {
    /** Tracker is disabled */
    Disabled = 0,
    /** Tracker not contacted yet */
    NotContacted = 1,
    /** Tracker is working (announce successful) */
    Working = 2,
    /** Update in progress */
    Updating = 3,
    /** Tracker error - check msg field */
    NotWorking = 4,
}

/**
 * Service for managing trackers on torrents
 */
export class QBittorrentTrackerService {
    constructor(private client: FetchHttpClient) { }

    /**
     * Get the list of trackers for a torrent
     * @param hash - Torrent hash
     * @returns Array of trackers with status info
     */
    async getTrackers(hash: string): Promise<QBittorrentTracker[]> {
        const data = await this.client.get('torrents/trackers', {
            params: { hash }
        });
        return QBittorrentTrackerListSchema.parse(data);
    }

    /**
     * Add trackers to a torrent
     * Note: URLs must be newline-separated per qBittorrent API spec
     * @param hash - Torrent hash
     * @param urls - Array of tracker URLs to add
     */
    async addTrackers(hash: string, urls: string[]): Promise<void> {
        await this.client.post('torrents/addTrackers',
            new URLSearchParams({
                hash,
                urls: urls.join('\n'), // Newline-separated per API spec
            })
        );
    }

    /**
     * Remove trackers from a torrent
     * @param hash - Torrent hash
     * @param urls - Array of tracker URLs to remove
     */
    async removeTrackers(hash: string, urls: string[]): Promise<void> {
        await this.client.post('torrents/removeTrackers',
            new URLSearchParams({
                hash,
                urls: urls.join('|'), // Pipe-separated for removal
            })
        );
    }

    /**
     * Edit a tracker URL
     * @param hash - Torrent hash
     * @param origUrl - Original tracker URL
     * @param newUrl - New tracker URL
     */
    async editTracker(
        hash: string,
        origUrl: string,
        newUrl: string
    ): Promise<void> {
        await this.client.post('torrents/editTracker',
            new URLSearchParams({
                hash,
                origUrl,
                newUrl,
            })
        );
    }

    /**
     * Force reannounce to all trackers
     * @param hashes - Array of torrent hashes
     */
    async reannounce(hashes: string[]): Promise<void> {
        await this.client.post('torrents/reannounce',
            new URLSearchParams({
                hashes: hashes.join('|'),
            })
        );
    }

    /**
     * Get trackers that are currently working
     * @param hash - Torrent hash
     * @returns Array of working trackers
     */
    async getWorkingTrackers(hash: string): Promise<QBittorrentTracker[]> {
        const trackers = await this.getTrackers(hash);
        return trackers.filter(t => t.status === TrackerStatus.Working);
    }

    /**
     * Get trackers that have errors
     * @param hash - Torrent hash
     * @returns Array of errored trackers with their messages
     */
    async getErroredTrackers(hash: string): Promise<QBittorrentTracker[]> {
        const trackers = await this.getTrackers(hash);
        return trackers.filter(t => t.status === TrackerStatus.NotWorking);
    }
}
