/**
 * QBittorrent Search Service
 * 
 * Provides search plugin integration:
 * - Start/Stop search jobs
 * - Poll for results
 * - Manage search plugins
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentSearchResultSchema,
    QBittorrentSearchStatusSchema,
    QBittorrentSearchPluginSchema,
    QBittorrentSearchResult
} from './QBittorrentSchema';
import { z } from 'zod';

export class QBittorrentSearchService {
    constructor(private client: FetchHttpClient) { }

    /**
     * Start a search job
     * @param pattern - Search query
     * @param plugins - 'all', 'enabled', or specific plugins
     * @param category - Category filter ('all')
     * @returns Job ID
     */
    async startSearch(
        pattern: string,
        plugins: string = 'enabled',
        category: string = 'all'
    ): Promise<number> {
        const response = await this.client.post<{ id: number }>('search/start', new URLSearchParams({
            pattern,
            plugins,
            category
        }));
        return response.id;
    }

    /**
     * Stop a search job
     */
    async stopSearch(id: number): Promise<void> {
        await this.client.post('search/stop', new URLSearchParams({ id: String(id) }));
    }

    /**
     * Get status of a search job
     */
    async getStatus(id: number): Promise<z.infer<typeof QBittorrentSearchStatusSchema>> {
        const data = await this.client.post<unknown[]>('search/status', new URLSearchParams({ id: String(id) }));
        return QBittorrentSearchStatusSchema.parse(data[0]); // Returns array
    }

    /**
     * Get search results
     * @param id - Job ID
     * @param limit - Max results
     * @param offset - Pagination offset
     */
    async getResults(
        id: number,
        limit: number = 20,
        offset: number = 0
    ): Promise<QBittorrentSearchResult[]> {
        const data = await this.client.post<{ results: unknown[] }>('search/results', new URLSearchParams({
            id: String(id),
            limit: String(limit),
            offset: String(offset)
        }));

        return z.array(QBittorrentSearchResultSchema).parse(data.results);
    }

    /**
     * List installed search plugins
     */
    async getPlugins(): Promise<z.infer<typeof QBittorrentSearchPluginSchema>[]> {
        const data = await this.client.get('search/plugins');
        return z.array(QBittorrentSearchPluginSchema).parse(data);
    }

    /**
     * Install a search plugin from URL
     */
    async installPlugin(url: string): Promise<void> {
        await this.client.post('search/installPlugin', new URLSearchParams({
            sources: url
        }));
    }

    /**
     * Uninstall a search plugin
     */
    async uninstallPlugin(name: string): Promise<void> {
        await this.client.post('search/uninstallPlugin', new URLSearchParams({
            names: name
        }));
    }

    /**
     * Enable a search plugin
     */
    async enablePlugin(name: string, enable: boolean): Promise<void> {
        await this.client.post('search/enablePlugin', new URLSearchParams({
            names: name,
            enable: String(enable)
        }));
    }
}
