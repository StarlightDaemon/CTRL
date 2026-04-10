/**
 * QBittorrent RSS Service
 * 
 * Provides RSS feed and rule management:
 * - Add/remove feeds
 * - Manage auto-download rules
 * - List items
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentRssRule
} from './QBittorrentSchema';

export class QBittorrentRssService {
    constructor(private client: FetchHttpClient) { }

    /**
     * Add a new RSS feed
     * @param url - Feed URL
     * @param path - Optional path to organize feed (e.g., "Linux\Distros")
     */
    async addFeed(url: string, path?: string): Promise<void> {
        const params = new URLSearchParams({ url });
        if (path) params.append('path', path);

        await this.client.post('rss/addFeed', params);
    }

    /**
     * Remove an RSS item (feed or folder)
     * @param path - Path of the item to remove
     */
    async removeItem(path: string): Promise<void> {
        await this.client.post('rss/removeItem', new URLSearchParams({ path }));
    }

    /**
     * Move an RSS item
     * @param itemPath - Current path
     * @param destPath - Destination path
     */
    async moveItem(itemPath: string, destPath: string): Promise<void> {
        await this.client.post('rss/moveItem', new URLSearchParams({
            itemPath,
            destPath
        }));
    }

    /**
     * Get all RSS feeds and items
     * Recurses through the tree structure returned by API
     */
    async getFeeds(): Promise<unknown> {
        return await this.client.get('rss/items', {
            params: { withData: 'true' }
        });
    }

    /**
     * Set an auto-download rule
     * @param ruleName - Name of the rule
     * @param ruleDef - Rule definition object
     */
    async setRule(ruleName: string, ruleDef: QBittorrentRssRule): Promise<void> {
        await this.client.post('rss/setRule', new URLSearchParams({
            ruleName,
            ruleDef: JSON.stringify(ruleDef),
        }));
    }

    /**
     * Rename a rule
     */
    async renameRule(oldRuleName: string, newRuleName: string): Promise<void> {
        await this.client.post('rss/renameRule', new URLSearchParams({
            ruleName: oldRuleName,
            newRuleName,
        }));
    }

    /**
     * Remove a rule
     */
    async removeRule(ruleName: string): Promise<void> {
        await this.client.post('rss/removeRule', new URLSearchParams({ ruleName }));
    }

    /**
     * Get all auto-download rules
     */
    async getRules(): Promise<Record<string, QBittorrentRssRule>> {
        const data = await this.client.get('rss/rules');
        // Rules are dynamic keys, verify schema on integration
        return data as Record<string, QBittorrentRssRule>;
    }
}
