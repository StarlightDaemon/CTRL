/**
 * QBittorrent Sync Service
 * 
 * Implements the optimized `sync/maindata` protocol:
 * - Uses `rid` (Response ID) for delta updates
 * - Merges partial updates into local state
 * - Handles `full_update` signals
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentSyncDataSchema,
    QBittorrentSyncData,
    QBittorrentTorrent
} from './QBittorrentSchema';

interface SyncState {
    rid: number;
    torrents: Record<string, QBittorrentTorrent>;
    categories: Record<string, { name: string; savePath: string }>;
    tags: string[];
}

export class QBittorrentSyncService {
    private state: SyncState = {
        rid: 0, // 0 = request full update
        torrents: {},
        categories: {},
        tags: [],
    };

    constructor(private client: FetchHttpClient) { }

    /**
     * Resets the local state and rid to 0.
     * Forces a full update on the next sync call.
     */
    resetState(): void {
        this.state = {
            rid: 0,
            torrents: {},
            categories: {},
            tags: [],
        };
    }

    /**
     * Fetches the latest data from the server and updates local state.
     * Handles delta merging automatically.
     * @returns The current full state after merging updates
     */
    async sync(): Promise<SyncState> {
        const response = await this.client.get('sync/maindata', {
            params: { rid: String(this.state.rid) }
        });

        const data = QBittorrentSyncDataSchema.parse(response);

        // Update RID for next request
        this.state.rid = data.rid;

        // Handle Full Update (server restart or first connection)
        if (data.full_update) {
            this.state.torrents = data.torrents as Record<string, QBittorrentTorrent> || {};
            this.state.categories = data.categories || {};
            this.state.tags = data.tags || [];
            return this.state;
        }

        // Handle Delta Updates - Torrents
        if (data.torrents) {
            for (const [hash, delta] of Object.entries(data.torrents)) {
                if (this.state.torrents[hash]) {
                    // Update existing torrent with changed fields
                    this.state.torrents[hash] = {
                        ...this.state.torrents[hash],
                        ...delta,
                    } as QBittorrentTorrent;
                } else {
                    // New torrent added
                    this.state.torrents[hash] = delta as QBittorrentTorrent;
                }
            }
        }

        if (data.torrents_removed) {
            for (const hash of data.torrents_removed) {
                delete this.state.torrents[hash];
            }
        }

        // Handle Delta Updates - Categories
        if (data.categories) {
            this.state.categories = { ...this.state.categories, ...data.categories };
        }
        if (data.categories_removed) {
            for (const cat of data.categories_removed) {
                delete this.state.categories[cat];
            }
        }

        // Handle Delta Updates - Tags
        if (data.tags) {
            // Tags are usually sent as a full list if changed, but we merge to be safe
            const newTags = new Set([...this.state.tags, ...data.tags]);
            this.state.tags = Array.from(newTags);
        }
        if (data.tags_removed) {
            this.state.tags = this.state.tags.filter(t => !data.tags_removed?.includes(t));
        }

        return this.state;
    }

    /**
     * Get the current list of torrents from local state
     */
    getTorrents(): QBittorrentTorrent[] {
        return Object.values(this.state.torrents);
    }
}
