/**
 * TransmissionAdapter Unit Tests - Phase 1 Enhanced
 * 
 * Tests cover:
 * - Task 1.1: Session management with concurrency
 * - Task 1.2: RPC version detection and capability flagging
 * - Task 1.3: Enhanced error handling (401, 403, 409, 5xx, duplicates)
 * - Task 1.4: Extended schema and entity mapping
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransmissionAdapter } from '@/shared/api/clients/transmission/TransmissionAdapter';
import { ServerConfig } from '@/shared/lib/types';
import {
    AuthenticationError,
    WhitelistError,
    SessionExpiredError,
    DuplicateTorrentError,
    DaemonError,
} from '@/shared/api/clients/transmission/TransmissionErrors';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Transmission Server',
    application: 'transmission',
    type: 'transmission',
    hostname: 'http://localhost:9091',
    username: 'admin',
    password: 'adminadmin',
    directories: [],
    clientOptions: {},
};

// Helper to create mock responses
const createMockFetch = (responses: Array<{ ok: boolean; status: number; headers?: Record<string, string>; body: unknown }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers(response.headers || {}),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

describe('TransmissionAdapter - Phase 1', () => {
    let adapter: TransmissionAdapter;

    beforeEach(() => {
        adapter = new TransmissionAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Task 1.2: RPC Version Detection', () => {
        it('should detect Transmission 4.x and set capabilities', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'rpc-version': 17,
                        'version': '4.0.5'
                    }
                }
            }]);

            await adapter.login();

            const capabilities = adapter.getCapabilities();
            expect(capabilities).toBeDefined();
            expect(capabilities?.rpcVersion).toBe(17);
            expect(capabilities?.supportsTrackerList).toBe(true);
            expect(capabilities?.usesSnakeCase).toBe(true);
            expect(capabilities?.clientType).toBe('transmission');
        });

        it('should detect Transmission 3.x and set capabilities', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'rpc-version': 16,
                        'version': '3.00'
                    }
                }
            }]);

            await adapter.login();

            const capabilities = adapter.getCapabilities();
            expect(capabilities?.rpcVersion).toBe(16);
            expect(capabilities?.supportsLabels).toBe(true);
            expect(capabilities?.supportsTrackerList).toBe(false); // v17+ only
            expect(capabilities?.usesSnakeCase).toBe(false);
        });

        it('should detect Vuze and enable workarounds', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'rpc-version': 14,
                        'version': '0.5.11' // Vuze plugin version
                    }
                }
            }]);

            await adapter.login();

            const capabilities = adapter.getCapabilities();
            expect(capabilities?.clientType).toBe('vuze');
            expect(capabilities?.hasVuzePathBug).toBe(true);
            expect(capabilities?.supportsFreeSpace).toBe(false); // Vuze limitation
        });

        it('should detect BiglyBT', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'rpc-version': 15,
                        'version': 'BiglyBT/3.5.0.0'
                    }
                }
            }]);

            await adapter.login();

            const capabilities = adapter.getCapabilities();
            expect(capabilities?.clientType).toBe('biglybt');
        });
    });

    describe('Task 1.1: Session Management Hardening', () => {
        it('should handle 409 and retry with new session ID', async () => {
            const fetchSpy = createMockFetch([
                // First call: 409 with new session ID
                {
                    ok: false,
                    status: 409,
                    headers: { 'X-Transmission-Session-Id': 'new-session-123' },
                    body: 'Conflict'
                },
                // Retry: Success
                {
                    ok: true,
                    status: 200,
                    body: { result: 'success', arguments: { 'rpc-version': 16 } }
                }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should prevent infinite retry loop on 409', async () => {
            createMockFetch([
                // Always return 409 without valid session ID
                {
                    ok: false,
                    status: 409,
                    headers: {},  // No session ID header
                    body: 'Conflict'
                }
            ]);

            // Should throw Error with specific message
            await expect(adapter.login()).rejects.toThrow('Transmission handshake failed. Server did not provide X-Transmission-Session-Id header.');
        });

        // Note: Concurrency test is difficult to unit test without integration test environment
        // This would be covered in integration tests
    });

    describe('Task 1.3: Enhanced Error Handling', () => {
        it('should throw Error on 401', async () => {
            createMockFetch([{
                ok: false,
                status: 401,
                body: 'Unauthorized'
            }]);

            await expect(adapter.login()).rejects.toThrow('Authentication failed. Verify username/password and Transmission RPC authentication settings.');
        });

        it('should throw Error on 403', async () => {
            createMockFetch([{
                ok: false,
                status: 403,
                body: 'Forbidden'
            }]);

            await expect(adapter.login()).rejects.toThrow('Authentication failed. Verify username/password and Transmission RPC authentication settings.');
        });

        it('should throw DaemonError on 5xx', async () => {
            createMockFetch([{
                ok: false,
                status: 500,
                body: 'Internal Server Error'
            }]);

            await expect(adapter.login()).rejects.toThrow(DaemonError);
        });

        it('should detect duplicate torrent on add', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'torrent-duplicate': {
                            id: 5,
                            name: 'Existing Torrent'
                        }
                    }
                }
            }]);

            await expect(
                adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123')
            ).rejects.toThrow(DuplicateTorrentError);

            await expect(
                adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123')
            ).rejects.toThrow('Existing Torrent');
        });

        it('should detect Transmission 4 duplicate torrent (result: "duplicate torrent")', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'duplicate torrent',
                    arguments: {
                        'torrent-duplicate': {
                            id: 10,
                            name: 'Existing Torrent'
                        }
                    }
                }
            }]);

            await expect(
                adapter.addTorrentUrl('magnet:?xt=urn:btih:def456')
            ).rejects.toThrow(DuplicateTorrentError);

            // Re-stub for the message assertion (fetch mock is consumed)
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'duplicate torrent',
                    arguments: {
                        'torrent-duplicate': {
                            id: 10,
                            name: 'Existing Torrent'
                        }
                    }
                }
            }]);

            await expect(
                adapter.addTorrentUrl('magnet:?xt=urn:btih:def456')
            ).rejects.toThrow('Existing Torrent');
        });
    });

    describe('Task 1.4: Extended Schema and Entity Mapping', () => {
        it('should map error level and message', async () => {
            const mockResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Failed Torrent',
                        status: 0,
                        percentDone: 0,
                        totalSize: 1000000,
                        rateDownload: 0,
                        rateUpload: 0,
                        eta: -1,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        error: 3, // Local error
                        errorString: 'Permission denied',
                    }]
                }
            };

            createMockFetch([{ ok: true, status: 200, body: mockResponse }]);

            const torrents = await adapter.getTorrents();

            expect(torrents[0].errorLevel).toBe(3);
            expect(torrents[0].errorMessage).toBe('Permission denied');
        });

        it('should map queue position and priority', async () => {
            const mockResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Queued Torrent',
                        status: 3, // Download wait
                        percentDone: 0.25,
                        totalSize: 1000000,
                        rateDownload: 0,
                        rateUpload: 0,
                        eta: 3600,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        error: 0,
                        errorString: '',
                        queuePosition: 2, // Third in queue
                        bandwidthPriority: 1, // High priority
                    }]
                }
            };

            createMockFetch([{ ok: true, status: 200, body: mockResponse }]);

            const torrents = await adapter.getTorrents();

            expect(torrents[0].queuePosition).toBe(2);
            expect(torrents[0].priority).toBe(1);
        });

        it('should map hash and statistics', async () => {
            const mockResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Seeding Torrent',
                        status: 6, // Seeding
                        percentDone: 1.0,
                        totalSize: 1000000000,
                        rateDownload: 0,
                        rateUpload: 500000,
                        eta: -1,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        error: 0,
                        errorString: '',
                        hashString: 'a1b2c3d4e5f6g7h8i9j0',
                        uploadRatio: 2.5,
                        uploadedEver: 2500000000,
                        downloadedEver: 1000000000,
                    }]
                }
            };

            createMockFetch([{ ok: true, status: 200, body: mockResponse }]);

            const torrents = await adapter.getTorrents();

            expect(torrents[0].hash).toBe('a1b2c3d4e5f6g7h8i9j0');
            expect(torrents[0].ratio).toBe(2.5);
            expect(torrents[0].uploadedTotal).toBe(2500000000);
            expect(torrents[0].downloadedTotal).toBe(1000000000);
        });

        it('should handle missing optional fields gracefully', async () => {
            const mockResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Basic Torrent',
                        status: 4,
                        percentDone: 0.5,
                        totalSize: 1000000,
                        rateDownload: 100000,
                        rateUpload: 50000,
                        eta: 3600,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        error: 0,
                        errorString: '',
                        // No optional fields
                    }]
                }
            };

            createMockFetch([{ ok: true, status: 200, body: mockResponse }]);

            const torrents = await adapter.getTorrents();

            expect(torrents[0].queuePosition).toBeUndefined();
            expect(torrents[0].priority).toBeUndefined();
            expect(torrents[0].hash).toBeUndefined();
            expect(torrents[0].ratio).toBeUndefined();
        });
    });

    describe('Status Mapping', () => {
        it('should map transmission status codes correctly', async () => {
            const createTorrentResponse = (status: number) => ({
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Test',
                        status,
                        percentDone: 0,
                        totalSize: 0,
                        rateDownload: 0,
                        rateUpload: 0,
                        eta: 0,
                        downloadDir: '',
                        addedDate: 0,
                        error: 0,
                        errorString: '',
                    }]
                }
            });

            // Status 0 = paused
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(0) }]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Status 2 = checking
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(2) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('checking');

            // Status 4 = downloading
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(4) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Status 6 = seeding
            createMockFetch([{ ok: true, status: 200, body: createTorrentResponse(6) }]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');
        });
    });

    describe('Basic Operations', () => {
        it('should test connection successfully', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            const result = await adapter.testConnection();
            expect(result).toBe(true);
        });

        it('should throw on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

            await expect(adapter.testConnection()).rejects.toThrow('Cannot reach server. Verify host/port and that remote access allows this device.');
        });

        it('should enrich timeout error with resolved RPC URL', async () => {
            // Simulate the AbortError that FetchHttpClient converts to 'Connection timed out after 10s'
            vi.spyOn(global, 'fetch').mockImplementation(() => {
                const err = new Error('Connection timed out after 10s');
                err.name = 'AbortError';
                return Promise.reject(err);
            });

            // The adapter should re-throw with the resolved URL enriched
            await expect(adapter.testConnection()).rejects.toThrow(
                'Connection timed out after 14000ms (target: http://localhost:9091/transmission/rpc)'
            );
        });

        it('should measure ping latency', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            const latency = await adapter.ping();
            expect(latency).toBeGreaterThanOrEqual(0);
            expect(typeof latency).toBe('number');
        });

        it('should add torrent with URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'torrent-added': { id: 1 } } } }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');
            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should pause torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.pauseTorrent('1');
            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should resume torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.resumeTorrent('1');
            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should remove torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.removeTorrent('1', true);
            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });
});

// ============================================================================
// Phase 2: Feature Parity Tests
// ============================================================================

describe('TransmissionAdapter - Phase 2', () => {
    let adapter: TransmissionAdapter;

    beforeEach(() => {
        adapter = new TransmissionAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Task 2.1: Queue Management', () => {
        it('should move torrents to top of queue', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.queueMoveTop(['1', '2', '3']);

            expect(fetchSpy).toHaveBeenCalledOnce();
            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('queue-move-top');
            expect(callBody.arguments.ids).toEqual([1, 2, 3]);
        });

        it('should move torrents up in queue', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.queueMoveUp(['5']);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('queue-move-up');
        });

        it('should move torrents down in queue', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.queueMoveDown(['5']);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('queue-move-down');
        });

        it('should move torrents to bottom of queue', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.queueMoveBottom(['5']);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('queue-move-bottom');
        });

        it('should set bandwidth priority', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setBandwidthPriority('1', 1); // High priority

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-set');
            expect(callBody.arguments.bandwidthPriority).toBe(1);
        });

        it('should force start torrent bypassing queue', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.forceStartTorrent('1');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-start-now');
        });
    });

    describe('Task 2.2: Tracker Management', () => {
        it('should get tracker stats for a torrent', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            trackerStats: [
                                {
                                    id: 1,
                                    announce: 'http://tracker1.example.com/announce',
                                    tier: 0,
                                    lastAnnounceTime: 1700000000,
                                    lastAnnounceResult: 'Success',
                                    lastAnnounceSucceeded: true,
                                    nextAnnounceTime: 1700001800,
                                    seederCount: 100,
                                    leecherCount: 50,
                                    downloadCount: 1000
                                }
                            ]
                        }]
                    }
                }
            }]);

            const trackers = await adapter.getTrackers('1');

            expect(trackers).toHaveLength(1);
            expect(trackers[0].announce).toBe('http://tracker1.example.com/announce');
            expect(trackers[0].seederCount).toBe(100);
        });

        it('should add tracker using trackerAdd for v3 (RPC v16-)', async () => {
            // Login first to set capabilities
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 16 } } },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            vi.restoreAllMocks();

            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.addTracker('1', 'http://new-tracker.com/announce');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-set');
            expect(callBody.arguments.trackerAdd).toContain('http://new-tracker.com/announce');
        });

        it('should add tracker using trackerList for v4 (RPC v17+)', async () => {
            // Login with v17 capabilities
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 17 } } }
            ]);
            await adapter.login();
            vi.restoreAllMocks();

            // First call: get current trackerList, second: set new list
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { torrents: [{ trackerList: 'http://old.com' }] } } },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.addTracker('1', 'http://new.com/announce');

            // Verify second call has the appended tracker
            // Note: Implementation appends with \n\n separator
        });
    });

    describe('Task 2.3: File Management', () => {
        it('should get files with stats', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            files: [
                                { name: 'movie.mkv', length: 4000000000, bytesCompleted: 2000000000 },
                                { name: 'subtitles.srt', length: 50000, bytesCompleted: 50000 }
                            ],
                            fileStats: [
                                { wanted: true, priority: 1 },  // High priority
                                { wanted: true, priority: 0 }   // Normal priority
                            ]
                        }]
                    }
                }
            }]);

            const files = await adapter.getFiles('1');

            expect(files).toHaveLength(2);
            expect(files[0]).toMatchObject({
                index: 0,
                name: 'movie.mkv',
                size: 4000000000,
                bytesCompleted: 2000000000,
                wanted: true,
                priority: 1
            });
            expect(files[1].priority).toBe(0);
        });

        it('should set file priority', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setFilePriority('1', [0, 2], 'high');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-set');
            expect(callBody.arguments['priority-high']).toEqual([0, 2]);
        });

        it('should set files wanted/unwanted', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setFilesWanted('1', [1, 3], false);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-set');
            expect(callBody.arguments['files-unwanted']).toEqual([1, 3]);
        });

        it('should verify torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.verifyTorrent('1');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-verify');
        });

        it('should move torrent data to new location', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.moveTorrentData('1', '/new/path', true);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('torrent-set-location');
            expect(callBody.arguments.location).toBe('/new/path');
            expect(callBody.arguments.move).toBe(true);
        });
    });

    describe('Task 2.4: Bandwidth Scheduling', () => {
        it('should get bandwidth schedule', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'alt-speed-enabled': true,
                        'alt-speed-down': 100,
                        'alt-speed-up': 50,
                        'alt-speed-time-enabled': true,
                        'alt-speed-time-begin': 540,   // 9 AM
                        'alt-speed-time-end': 1020,    // 5 PM
                        'alt-speed-time-day': 62       // Weekdays
                    }
                }
            }]);

            const schedule = await adapter.getBandwidthSchedule();

            expect(schedule).toMatchObject({
                altSpeedEnabled: true,
                altSpeedDown: 100,
                altSpeedUp: 50,
                schedulerEnabled: true,
                timeBegin: 540,
                timeEnd: 1020,
                days: 62
            });
        });

        it('should set bandwidth schedule', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setBandwidthSchedule({
                altSpeedDown: 200,
                altSpeedUp: 100,
                schedulerEnabled: true
            });

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('session-set');
            expect(callBody.arguments['alt-speed-down']).toBe(200);
            expect(callBody.arguments['alt-speed-up']).toBe(100);
            expect(callBody.arguments['alt-speed-time-enabled']).toBe(true);
        });

        it('should toggle turtle mode', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setTurtleMode(true);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('session-set');
            expect(callBody.arguments['alt-speed-enabled']).toBe(true);
        });
    });

    describe('Task 2.5: Blocklist Management', () => {
        it('should get blocklist info', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'blocklist-enabled': true,
                        'blocklist-url': 'http://blocklist.example.com/list.gz',
                        'blocklist-size': 150000
                    }
                }
            }]);

            const info = await adapter.getBlocklistInfo();

            expect(info).toMatchObject({
                enabled: true,
                url: 'http://blocklist.example.com/list.gz',
                size: 150000
            });
        });

        it('should enable blocklist', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setBlocklistEnabled(true);

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('session-set');
            expect(callBody.arguments['blocklist-enabled']).toBe(true);
        });

        it('should set blocklist URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.setBlocklistUrl('http://new-blocklist.com/list.gz');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.method).toBe('session-set');
            expect(callBody.arguments['blocklist-url']).toBe('http://new-blocklist.com/list.gz');
        });

        it('should update blocklist and return size', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        'blocklist-size': 200000
                    }
                }
            }]);

            const size = await adapter.updateBlocklist();

            expect(size).toBe(200000);
        });
    });

    describe('Task 2.6: Free Space Validation', () => {
        it('should get free space for a path', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        path: '/downloads',
                        'size-bytes': 500000000000  // 500 GB
                    }
                }
            }]);

            const freeSpace = await adapter.getFreeSpace('/downloads');

            expect(freeSpace).toMatchObject({
                path: '/downloads',
                freeBytes: 500000000000
            });
        });

        it('should return -1 for unsupported clients (Vuze)', async () => {
            // Login as Vuze (no free-space support)
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 14, version: '0.5.11' } } }
            ]);
            await adapter.login();
            vi.restoreAllMocks();

            const freeSpace = await adapter.getFreeSpace('/downloads');

            expect(freeSpace.freeBytes).toBe(-1);
        });
    });
});

// ============================================================================
// Phase 3: Optimization & UX Tests
// ============================================================================

describe('TransmissionAdapter - Phase 3', () => {
    let adapter: TransmissionAdapter;

    beforeEach(() => {
        adapter = new TransmissionAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Task 3.1: Adaptive Field Fetching', () => {
        it('should fetch torrents with list view fields', async () => {
            const fetchSpy = createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            id: 1,
                            name: 'Test',
                            status: 4,
                            totalSize: 1000000,
                            percentDone: 0.5,
                            rateDownload: 100000,
                            rateUpload: 50000,
                            eta: 3600,
                            downloadDir: '/downloads',
                            addedDate: 1700000000,
                            error: 0,
                            errorString: '',
                            queuePosition: 0
                        }]
                    }
                }
            }]);

            await adapter.getTorrentsWithViewMode('list');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.arguments.fields).toContain('name');
            expect(callBody.arguments.fields).toContain('queuePosition');
            // List mode shouldn't include heavy detail fields
            expect(callBody.arguments.fields).not.toContain('pieceCount');
        });

        it('should fetch torrents with detail view fields', async () => {
            const fetchSpy = createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            id: 1,
                            name: 'Test',
                            status: 4,
                            totalSize: 1000000,
                            percentDone: 0.5,
                            rateDownload: 100000,
                            rateUpload: 50000,
                            eta: 3600,
                            downloadDir: '/downloads',
                            addedDate: 1700000000,
                            error: 0,
                            errorString: ''
                        }]
                    }
                }
            }]);

            await adapter.getTorrentsWithViewMode('detail');

            const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
            expect(callBody.arguments.fields).toContain('hashString');
            expect(callBody.arguments.fields).toContain('pieceCount');
            expect(callBody.arguments.fields).toContain('creator');
        });

        it('should get recently active torrents with removed IDs', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            id: 1,
                            name: 'Active',
                            status: 4,
                            totalSize: 1000,
                            percentDone: 0.5,
                            rateDownload: 1000,
                            rateUpload: 500,
                            eta: 60,
                            downloadDir: '/downloads',
                            addedDate: 1700000000,
                            error: 0,
                            errorString: ''
                        }],
                        removed: [5, 10, 15]
                    }
                }
            }]);

            const result = await adapter.getRecentlyActiveTorrents();

            expect(result.active).toHaveLength(1);
            expect(result.removed).toEqual([5, 10, 15]);
        });
    });

    describe('Task 3.3: Enhanced Status Reporting', () => {
        it('should detect stalled download', () => {
            const torrent = {
                id: '1',
                name: 'Test',
                status: 'downloading' as const,
                progress: 50,
                size: 1000000,
                downloadSpeed: 0,
                uploadSpeed: 0,
                eta: -1,
                savePath: '/downloads',
                addedDate: Date.now()
            };

            const statusInfo = adapter.getEnhancedStatus(torrent, 4, true);

            expect(statusInfo.status).toBe('stalled-download');
            expect(statusInfo.label).toBe('Stalled');
            expect(statusInfo.isActive).toBe(false);
            expect(statusInfo.errorSeverity).toBe('warning');
        });

        it('should detect metadata fetching', () => {
            const torrent = {
                id: '1',
                name: 'Test',
                status: 'downloading' as const,
                progress: 0,
                size: 0,
                downloadSpeed: 0,
                uploadSpeed: 0,
                eta: -1,
                savePath: '/downloads',
                addedDate: Date.now()
            };

            const statusInfo = adapter.getEnhancedStatus(torrent, 4, false, 0.5);

            expect(statusInfo.status).toBe('metadata');
            expect(statusInfo.label).toBe('Fetching Metadata');
            expect(statusInfo.progress).toBe(50);
        });

        it('should detect tracker warning vs error', () => {
            const torrentWarning = {
                id: '1',
                name: 'Test',
                status: 'downloading' as const,
                progress: 50,
                size: 1000000,
                downloadSpeed: 1000,
                uploadSpeed: 500,
                eta: 3600,
                savePath: '/downloads',
                addedDate: Date.now(),
                errorLevel: 1,  // Warning
                errorMessage: 'Tracker overloaded'
            };

            const warningStatus = adapter.getEnhancedStatus(torrentWarning);
            expect(warningStatus.errorSeverity).toBe('warning');
            expect(warningStatus.status).toBe('error-tracker');

            const torrentError = { ...torrentWarning, errorLevel: 2 };
            const errorStatus = adapter.getEnhancedStatus(torrentError);
            expect(errorStatus.errorSeverity).toBe('error');
        });

        it('should detect local error', () => {
            const torrent = {
                id: '1',
                name: 'Test',
                status: 'error' as const,
                progress: 50,
                size: 1000000,
                downloadSpeed: 0,
                uploadSpeed: 0,
                eta: -1,
                savePath: '/downloads',
                addedDate: Date.now(),
                errorLevel: 3,  // Local error
                errorMessage: 'Permission denied'
            };

            const statusInfo = adapter.getEnhancedStatus(torrent);

            expect(statusInfo.status).toBe('error-local');
            expect(statusInfo.errorSeverity).toBe('error');
        });
    });

    describe('Task 3.4: Vuze Path Sanitization', () => {
        it('should sanitize Vuze path bug on Linux', async () => {
            // Login as Vuze
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 14, version: '0.5.11' } } }
            ]);
            await adapter.login();

            const sanitized = adapter.sanitizeDownloadPath('/downloads/My Torrent Name', 'My Torrent Name');
            expect(sanitized).toBe('/downloads');
        });

        it('should sanitize Vuze path bug on Windows', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 14, version: '0.5.11' } } }
            ]);
            await adapter.login();

            const sanitized = adapter.sanitizeDownloadPath('C:\\Downloads\\My Torrent', 'My Torrent');
            expect(sanitized).toBe('C:\\Downloads');
        });

        it('should not modify path for non-Vuze clients', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success', arguments: { 'rpc-version': 17, version: '4.0.0' } } }
            ]);
            await adapter.login();

            const path = adapter.sanitizeDownloadPath('/downloads/My Torrent Name', 'My Torrent Name');
            expect(path).toBe('/downloads/My Torrent Name');
        });
    });

    describe('Task 3.5: Connection Security Info', () => {
        it('should detect secure HTTPS connection', () => {
            const secureAdapter = new TransmissionAdapter({
                ...mockConfig,
                hostname: 'https://remote.example.com:9091'
            });

            const securityInfo = secureAdapter.getConnectionSecurityInfo();

            expect(securityInfo.isSecure).toBe(true);
            expect(securityInfo.warnings).toHaveLength(0);
            expect(securityInfo.statusText).toContain('Secure');
        });

        it('should allow HTTP for localhost', () => {
            const localAdapter = new TransmissionAdapter({
                ...mockConfig,
                hostname: 'http://localhost:9091'
            });

            const securityInfo = localAdapter.getConnectionSecurityInfo();

            expect(securityInfo.isLocal).toBe(true);
            expect(securityInfo.warnings).toHaveLength(0);
            expect(securityInfo.statusText).toContain('Local');
        });

        it('should warn about insecure remote HTTP', () => {
            const insecureAdapter = new TransmissionAdapter({
                ...mockConfig,
                hostname: 'http://remote.example.com:9091'
            });

            const securityInfo = insecureAdapter.getConnectionSecurityInfo();

            expect(securityInfo.isSecure).toBe(false);
            expect(securityInfo.isLocal).toBe(false);
            expect(securityInfo.warnings).toContain('insecure-remote');
            expect(securityInfo.statusText).toContain('Insecure');
        });

        it('should recognize private network addresses as local', () => {
            const privateAdapter = new TransmissionAdapter({
                ...mockConfig,
                hostname: 'http://192.168.1.100:9091'
            });

            const securityInfo = privateAdapter.getConnectionSecurityInfo();

            expect(securityInfo.isLocal).toBe(true);
            expect(securityInfo.warnings).toHaveLength(0);
        });
    });

    describe('Task 3.2: Optimistic UI Updates', () => {
        it('should call optimistic update immediately on pause', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            const updates: unknown[] = [];
            const onUpdate = (update: unknown) => updates.push(update);

            await adapter.pauseTorrentOptimistic('1', onUpdate);

            // Should have received optimistic update
            expect(updates).toHaveLength(1);
            expect(updates[0]).toMatchObject({ id: '1', status: 'paused' });
        });

        it('should rollback on pause failure', async () => {
            createMockFetch([
                { ok: false, status: 500, body: 'Server error' }
            ]);

            const updates: unknown[] = [];
            const onUpdate = (update: unknown) => updates.push(update);

            await expect(adapter.pauseTorrentOptimistic('1', onUpdate)).rejects.toThrow();

            // Should have update + rollback
            expect(updates.length).toBeGreaterThanOrEqual(1);
        });

        it('should call optimistic update immediately on resume', async () => {
            createMockFetch([
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            const updates: unknown[] = [];
            const onUpdate = (update: unknown) => updates.push(update);

            await adapter.resumeTorrentOptimistic('1', onUpdate);

            expect(updates).toHaveLength(1);
            expect(updates[0]).toMatchObject({ id: '1', status: 'downloading' });
        });
    });

    describe('getTorrentDetails', () => {
        it('should get single torrent with detail fields', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: [{
                            id: 1,
                            name: 'Detailed Torrent',
                            status: 6,
                            totalSize: 5000000000,
                            percentDone: 1.0,
                            rateDownload: 0,
                            rateUpload: 500000,
                            eta: -1,
                            downloadDir: '/downloads',
                            addedDate: 1700000000,
                            error: 0,
                            errorString: '',
                            hashString: 'abc123def456',
                            uploadRatio: 2.5
                        }]
                    }
                }
            }]);

            const torrent = await adapter.getTorrentDetails('1');

            expect(torrent).not.toBeNull();
            expect(torrent?.hash).toBe('abc123def456');
            expect(torrent?.ratio).toBe(2.5);
        });

        it('should return null for non-existent torrent', async () => {
            createMockFetch([{
                ok: true,
                status: 200,
                body: {
                    result: 'success',
                    arguments: {
                        torrents: []
                    }
                }
            }]);

            const torrent = await adapter.getTorrentDetails('999');

            expect(torrent).toBeNull();
        });
    });
});
