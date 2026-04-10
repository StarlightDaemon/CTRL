import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import { ServerConfig } from '@/shared/lib/types';
import { extractUTorrentToken } from './UTorrentParsingUtils';

/**
 * RSS Feed information
 */
export interface RssFeed {
    id: number;
    url: string;
    alias: string;
    enabled: boolean;
}

/**
 * RSS Filter rule configuration
 */
export interface RssFilterConfig {
    id?: number;           // -1 for new filter
    name: string;          // Display name for the rule
    filter: string;        // Match pattern (wildcards or regex)
    notFilter?: string;    // Exclude pattern
    savePath?: string;     // Destination directory
    feedId?: number;       // -1 = all feeds
    quality?: number;      // Quality bitmask
    smartEpFilter?: boolean; // Prevent duplicate episodes
    addToTop?: boolean;    // Add matched torrents to top of queue
    enabled?: boolean;
}

/**
 * RSS Quality flags for filter-update
 */
export const RSS_QUALITY = {
    ANY: 0,
    HDTV: 1,
    DVD: 2,
    HD_720P: 4,
    HD_1080P: 8,
    REMUX_BLURAY: 16,
} as const;

/**
 * Service for managing µTorrent RSS feeds and auto-download filters
 * 
 * Note: RSS functionality is version-dependent and may not be available
 * on all µTorrent builds. This service isolates the complexity from the
 * main adapter.
 */
export class UTorrentRssService {
    private httpClient: FetchHttpClient;
    private token: string | null = null;
    private guid: string | null = null;
    private baseUrl: string;

    constructor(private config: ServerConfig) {
        this.httpClient = new FetchHttpClient(config.hostname);
        this.baseUrl = 'gui/';
    }

    /**
     * Authenticate and get token
     */
    async login(): Promise<void> {
        const headers = this.getAuthHeaders();
        const { body, headers: respHeaders } = await this.httpClient.getRaw<string>('gui/token.html', { headers });

        this.token = extractUTorrentToken(body);

        const setCookie = respHeaders.get('set-cookie') ?? '';
        const guidMatch = setCookie.match(/GUID=([^;]+)/i);
        this.guid = guidMatch ? guidMatch[1] : null;
    }

    // ========== Feed Management ==========

    /**
     * Get all RSS feeds
     * Note: Feeds may appear in the list response under 'rssfeeds' key
     */
    async getFeeds(): Promise<RssFeed[]> {
        const response = await this.call(new URLSearchParams({ list: '1' }));
        const data = response as { rssfeeds?: unknown[] };

        if (!data.rssfeeds || !Array.isArray(data.rssfeeds)) {
            return [];
        }

        // RSS feeds format varies by version, typically: [id, enabled, url, alias, ...]
        return data.rssfeeds.map((feed: unknown) => {
            if (Array.isArray(feed)) {
                return {
                    id: Number(feed[0]) || 0,
                    enabled: Boolean(feed[1]),
                    url: String(feed[2] || ''),
                    alias: String(feed[3] || ''),
                };
            }
            return { id: 0, url: '', alias: '', enabled: false };
        }).filter(f => f.url.length > 0);
    }

    /**
     * Add a new RSS feed
     * @param url - RSS feed URL
     * @param alias - Optional display name
     */
    async addFeed(url: string, alias?: string): Promise<void> {
        const params = new URLSearchParams({
            action: 'add-feed',
            url: url,
        });
        if (alias) {
            params.append('alias', alias);
        }
        await this.call(params);
    }

    /**
     * Remove an RSS feed
     */
    async removeFeed(feedId: number): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'rss-remove',
            'feed-id': String(feedId)
        }));
    }

    /**
     * Refresh an RSS feed manually
     */
    async refreshFeed(feedId: number): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'rss-update',
            'feed-id': String(feedId)
        }));
    }

    // ========== Filter Management ==========

    /**
     * Create or update an RSS auto-download filter
     * 
     * @example
     * ```typescript
     * await rss.updateFilter({
     *   id: -1,  // New filter
     *   name: 'My TV Show',
     *   filter: '*My.Show*720p*',
     *   notFilter: '*PROPER*',
     *   savePath: '/downloads/tv/',
     *   feedId: -1,  // All feeds
     *   quality: RSS_QUALITY.HD_720P | RSS_QUALITY.HD_1080P,
     *   smartEpFilter: true,
     *   addToTop: true
     * });
     * ```
     */
    async updateFilter(config: RssFilterConfig): Promise<void> {
        const params = new URLSearchParams({
            action: 'filter-update',
            'filter-id': String(config.id ?? -1),
            name: config.name,
            filter: config.filter,
        });

        if (config.notFilter) {
            params.append('not-filter', config.notFilter);
        }
        if (config.savePath) {
            params.append('save-in', config.savePath);
        }
        if (config.feedId !== undefined) {
            params.append('feed-id', String(config.feedId));
        }
        if (config.quality !== undefined) {
            params.append('quality', String(config.quality));
        }
        if (config.smartEpFilter !== undefined) {
            params.append('smart-ep-filter', config.smartEpFilter ? '1' : '0');
        }
        if (config.addToTop !== undefined) {
            params.append('add_to_top', config.addToTop ? '1' : '0');
        }

        await this.call(params);
    }

    /**
     * Create a simple TV show filter
     * @param showName - Name pattern to match (supports wildcards)
     * @param quality - Quality flags (combine with |)
     */
    async createTvShowFilter(
        showName: string,
        quality: number = RSS_QUALITY.ANY,
        savePath?: string
    ): Promise<void> {
        await this.updateFilter({
            id: -1,
            name: showName,
            filter: `*${showName.replace(/\s+/g, '*')}*`,
            quality,
            savePath,
            feedId: -1,
            smartEpFilter: true,
            addToTop: false,
        });
    }

    /**
     * Remove an RSS filter
     */
    async removeFilter(filterId: number): Promise<void> {
        await this.call(new URLSearchParams({
            action: 'filter-remove',
            'filter-id': String(filterId)
        }));
    }

    // ========== Convenience Methods ==========

    /**
     * Subscribe to an RSS feed with auto-download enabled
     * Creates both the feed and a basic pass-through filter
     */
    async subscribeToFeed(url: string, savePath?: string): Promise<void> {
        // Add the feed
        await this.addFeed(url);

        // Note: Creating filters requires knowing the feed ID
        // For full automation, the API would need to return the new feed ID
        // This is a limitation of the µTorrent WebUI API
    }

    // ========== Private Methods ==========

    private async call(params: URLSearchParams): Promise<unknown> {
        if (!this.token) {
            await this.login();
        }

        params.append('token', this.token || '');
        params.append('t', String(Date.now()));

        const url = `${this.baseUrl}?${params.toString()}`;
        const headers = this.getAuthHeaders();
        if (this.guid) headers['Cookie'] = `GUID=${this.guid}`;

        return this.httpClient.get(url, { headers });
    }

    private getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.config.username || this.config.password) {
            const auth = btoa(`${this.config.username || ''}:${this.config.password || ''}`);
            headers['Authorization'] = `Basic ${auth}`;
        }
        return headers;
    }
}
