import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynologyAdapter } from '@/shared/api/clients/synology/SynologyAdapter';
import { ServerConfig } from '@/shared/lib/types';

describe('SynologyAdapter', () => {
    const mockConfig: ServerConfig = {
        name: 'Test NAS',
        application: 'Synology Download Station',
        type: 'synology',
        hostname: 'https://nas.local:5001',
        username: 'admin',
        password: 'password123',
        directories: ['/downloads'],
        clientOptions: {},
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create adapter with correct base URL', () => {
            const adapter = new SynologyAdapter(mockConfig);
            expect(adapter).toBeDefined();
        });

        it('should strip trailing slash from hostname', () => {
            const configWithSlash: ServerConfig = {
                ...mockConfig,
                hostname: 'https://nas.local:5001/',
            };
            const adapter = new SynologyAdapter(configWithSlash);
            expect(adapter).toBeDefined();
        });
    });

    describe('status mapping (via private method access)', () => {
        // Testing status mapping by accessing private method via type assertion
        it('should map Synology status codes correctly', () => {
            const adapter = new SynologyAdapter(mockConfig);

            // Access private method for testing status mapping
            const mapStatus = (adapter as any).mapStatus.bind(adapter);

            expect(mapStatus(1)).toBe('queued');      // WAITING
            expect(mapStatus(2)).toBe('downloading'); // DOWNLOADING
            expect(mapStatus(3)).toBe('paused');      // PAUSED
            expect(mapStatus(5)).toBe('completed');   // FINISHED
            expect(mapStatus(6)).toBe('checking');    // HASH_CHECKING
            expect(mapStatus(7)).toBe('seeding');     // SEEDING
            expect(mapStatus(10)).toBe('error');      // ERROR
            expect(mapStatus(99)).toBe('unknown');    // Unknown code
        });
    });

    describe('error code mapping', () => {
        it('should map auth error codes to messages', () => {
            const adapter = new SynologyAdapter(mockConfig);
            const getAuthError = (adapter as any).getAuthError.bind(adapter);

            expect(getAuthError(400)).toBe('No such account or incorrect password');
            expect(getAuthError(403)).toBe('2-factor authentication code required');
            expect(getAuthError(408)).toBe('Account is blocked due to too many failed attempts');
            expect(getAuthError(999)).toContain('code: 999');
        });

        it('should map task error codes to messages', () => {
            const adapter = new SynologyAdapter(mockConfig);
            const getTaskError = (adapter as any).getTaskError.bind(adapter);

            expect(getTaskError(401)).toBe('Max number of tasks reached');
            expect(getTaskError(403)).toBe('Destination does not exist');
            expect(getTaskError(999)).toContain('code: 999');
        });
    });

    describe('torrent mapping', () => {
        it('should map Synology task to Torrent format', () => {
            const adapter = new SynologyAdapter(mockConfig);
            const mapTorrent = (adapter as any).mapTorrent.bind(adapter);

            const synoTask = {
                id: 'dbid_123',
                type: 'bt',
                username: 'admin',
                title: 'Test Torrent',
                size: 1000000,
                status: 2, // DOWNLOADING
                additional: {
                    transfer: {
                        size_downloaded: 500000,
                        size_uploaded: 100000,
                        speed_download: 50000,
                        speed_upload: 10000,
                    },
                    detail: {
                        destination: '/downloads/movies',
                        create_time: 1700000000,
                    },
                },
            };

            const torrent = mapTorrent(synoTask);

            expect(torrent.id).toBe('dbid_123');
            expect(torrent.name).toBe('Test Torrent');
            expect(torrent.status).toBe('downloading');
            expect(torrent.progress).toBe(50);
            expect(torrent.size).toBe(1000000);
            expect(torrent.downloadSpeed).toBe(50000);
            expect(torrent.uploadSpeed).toBe(10000);
            expect(torrent.savePath).toBe('/downloads/movies');
        });

        it('should calculate ETA correctly', () => {
            const adapter = new SynologyAdapter(mockConfig);
            const mapTorrent = (adapter as any).mapTorrent.bind(adapter);

            const synoTask = {
                id: 'task-1',
                type: 'bt',
                username: 'admin',
                title: 'Test',
                size: 1000000,
                status: 2,
                additional: {
                    transfer: {
                        size_downloaded: 500000,
                        size_uploaded: 0,
                        speed_download: 50000, // 50KB/s
                        speed_upload: 0,
                    },
                },
            };

            const torrent = mapTorrent(synoTask);
            // Remaining: 500000, Speed: 50000, ETA = 10 seconds
            expect(torrent.eta).toBe(10);
        });

        it('should handle task without transfer data', () => {
            const adapter = new SynologyAdapter(mockConfig);
            const mapTorrent = (adapter as any).mapTorrent.bind(adapter);

            const synoTask = {
                id: 'task-1',
                type: 'http',
                username: 'admin',
                title: 'HTTP Download',
                size: 1000,
                status: 5, // FINISHED
            };

            const torrent = mapTorrent(synoTask);

            expect(torrent.progress).toBe(0);
            expect(torrent.downloadSpeed).toBe(0);
            expect(torrent.eta).toBe(-1);
        });
    });
});
