import { Torrent } from '@/entities/torrent/model/Torrent';

export interface AddTorrentOptions {
    paused?: boolean;
    path?: string;
    label?: string;
    sequentialDownload?: boolean;
    firstLastPiecePrio?: boolean;
}

export interface ITorrentClient {
    /**
     * Authenticates with the torrent client.
     * Should handle session persistence and re-authentication loops.
     */
    login(): Promise<void>;

    /**
     * Clears the session and logs out.
     */
    logout(): Promise<void>;

    /**
     * Retrieves the list of torrents.
     */
    getTorrents(): Promise<Torrent[]>;

    /**
     * Adds a torrent via a magnet link or URL.
     */
    addTorrentUrl(url: string, options?: AddTorrentOptions): Promise<void>;

    /**
     * Adds a torrent file (Blob/File).
     */
    addTorrentFile(file: Blob, options?: AddTorrentOptions): Promise<void>;

    /**
     * Pauses a torrent.
     */
    pauseTorrent(id: string): Promise<void>;

    /**
     * Resumes a torrent.
     */
    resumeTorrent(id: string): Promise<void>;

    /**
     * Removes a torrent.
     */
    removeTorrent(id: string, deleteData?: boolean): Promise<void>;

    /**
     * Tests the connection to the client.
     * Returns true if successful, false otherwise.
     */
    testConnection(): Promise<boolean>;

    /**
     * Pings the client to measure latency.
     * Returns latency in milliseconds.
     */
    ping(): Promise<number>;

    /**
     * Retrieves the list of available categories.
     */
    getCategories(): Promise<string[]>;

    /**
     * Sets the category for a specific torrent.
     */
    setCategory(hash: string, category: string): Promise<void>;

    /**
     * Retrieves the list of available tags.
     */
    getTags(): Promise<string[]>;

    /**
     * Adds tags to a specific torrent.
     */
    addTags(hash: string, tags: string[]): Promise<void>;

    /**
     * Removes tags from a specific torrent.
     */
    removeTags(hash: string, tags: string[]): Promise<void>;
}
