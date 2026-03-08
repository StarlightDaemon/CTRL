/**
 * QBittorrent File Management Service
 * 
 * Provides file-level operations within torrents:
 * - List files with progress and priority
 * - Set file priority (skip, normal, high, max)
 * - Rename files
 * 
 * Based on qBittorrent Web API v2 research.
 */
import { FetchHttpClient } from '@/shared/api/network/FetchHttpClient';
import {
    QBittorrentFileListSchema,
    QBittorrentFile
} from './QBittorrentSchema';

/**
 * File priority levels for qBittorrent
 */
export enum FilePriority {
    /** Do not download this file */
    Skip = 0,
    /** Normal priority */
    Normal = 1,
    /** High priority */
    High = 6,
    /** Maximum priority */
    Maximum = 7,
}

/**
 * Service for managing files within torrents
 */
export class QBittorrentFileService {
    constructor(private client: FetchHttpClient) { }

    /**
     * Get the list of files in a torrent
     * @param hash - Torrent hash
     * @returns Array of files with their download progress and priority
     */
    async getFiles(hash: string): Promise<QBittorrentFile[]> {
        const data = await this.client.get(`torrents/files`, {
            params: { hash }
        });
        return QBittorrentFileListSchema.parse(data);
    }

    /**
     * Set priority for specific files in a torrent
     * @param hash - Torrent hash
     * @param fileIds - Array of file indices (0-based)
     * @param priority - Priority level to set
     */
    async setFilePriority(
        hash: string,
        fileIds: number[],
        priority: FilePriority
    ): Promise<void> {
        await this.client.post('torrents/filePrio',
            new URLSearchParams({
                hash,
                id: fileIds.join('|'),
                priority: String(priority),
            })
        );
    }

    /**
     * Skip downloading specific files (convenience method)
     * @param hash - Torrent hash
     * @param fileIds - Array of file indices to skip
     */
    async skipFiles(hash: string, fileIds: number[]): Promise<void> {
        await this.setFilePriority(hash, fileIds, FilePriority.Skip);
    }

    /**
     * Download specific files with normal priority (convenience method)
     * @param hash - Torrent hash
     * @param fileIds - Array of file indices to download
     */
    async downloadFiles(hash: string, fileIds: number[]): Promise<void> {
        await this.setFilePriority(hash, fileIds, FilePriority.Normal);
    }

    /**
     * Rename a file within a torrent
     * @param hash - Torrent hash
     * @param oldPath - Current file path (relative to torrent root)
     * @param newPath - New file path (relative to torrent root)
     */
    async renameFile(
        hash: string,
        oldPath: string,
        newPath: string
    ): Promise<void> {
        await this.client.post('torrents/renameFile',
            new URLSearchParams({
                hash,
                oldPath,
                newPath,
            })
        );
    }

    /**
     * Rename the root folder of a multi-file torrent
     * @param hash - Torrent hash
     * @param newName - New folder name
     */
    async renameFolder(
        hash: string,
        oldPath: string,
        newPath: string
    ): Promise<void> {
        await this.client.post('torrents/renameFolder',
            new URLSearchParams({
                hash,
                oldPath,
                newPath,
            })
        );
    }
}
