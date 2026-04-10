/**
 * BiglyBTAdapter Unit Tests
 * 
 * Tests BiglyBT-specific features including:
 * - Version detection and capability flags
 * - mapPerFile injection for torrent-get
 * - Atomic tag operations (tagsAdd/tagsRemove)
 * - Swarm merging telemetry parsing
 * - Error truncation for Java stack traces
 * - 409 session ID retry logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BiglyBTAdapter } from '@/shared/api/clients/biglybt/BiglyBTAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'BiglyBT Server',
    application: 'biglybt',
    type: 'biglybt',
    hostname: 'http://localhost:9091',
    username: 'admin',
    password: 'adminadmin',
    directories: [],
    clientOptions: {},
};

// Helper to create mock fetch responses
const createMockFetch = (
    responses: Array<{
        ok: boolean;
        status: number;
        headers?: Record<string, string>;
        body: unknown;
    }>
) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers(response.headers || {}),
            text: () => Promise.resolve(
                typeof response.body === 'string'
                    ? response.body
                    : JSON.stringify(response.body)
            ),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

// Standard BiglyBT session response
const biglyBTSessionResponse = {
    result: 'success',
    arguments: {
        'version': '2.94',
        'rpc-version': 17,
        'biglybt-version': '3.5.0.0',
        'az-rpc-version': '5.10.0.1',
        'rpc-i2p-address': 'i2p://abc123.b32.i2p',
        'rpc-tor-address': undefined,
    }
};

// Standard Transmission session response (no BiglyBT fields)
const transmissionSessionResponse = {
    result: 'success',
    arguments: {
        'version': '3.00',
        'rpc-version': 17,
    }
};

describe('BiglyBTAdapter', () => {
    let adapter: BiglyBTAdapter;

    beforeEach(() => {
        adapter = new BiglyBTAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // =========================================================================
    // Version Detection Tests
    // =========================================================================
    describe('version detection', () => {
        it('should detect BiglyBT from session response', async () => {
            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse }
            ]);

            await adapter.login();

            expect(adapter.isBiglyBT).toBe(true);
            expect(adapter.biglybtVersion).toBe('3.5.0.0');
            expect(adapter.i2pAvailable).toBe(true);
            expect(adapter.torAvailable).toBe(false);
        });

        it('should detect standard Transmission (not BiglyBT)', async () => {
            createMockFetch([
                { ok: true, status: 200, body: transmissionSessionResponse }
            ]);

            await adapter.login();

            expect(adapter.isBiglyBT).toBe(false);
            expect(adapter.biglybtVersion).toBeNull();
            expect(adapter.i2pAvailable).toBe(false);
        });

        it('should detect Tor availability', async () => {
            const withTor = {
                ...biglyBTSessionResponse,
                arguments: {
                    ...biglyBTSessionResponse.arguments,
                    'rpc-tor-address': 'socks5://127.0.0.1:9050',
                }
            };
            createMockFetch([{ ok: true, status: 200, body: withTor }]);

            await adapter.login();

            expect(adapter.torAvailable).toBe(true);
        });
    });

    // =========================================================================
    // getTorrents with mapPerFile
    // =========================================================================
    describe('getTorrents', () => {
        it('should include mapPerFile: true in request', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                {
                    ok: true,
                    status: 200,
                    body: {
                        result: 'success',
                        arguments: { torrents: [] }
                    }
                }
            ]);

            await adapter.login();
            await adapter.getTorrents();

            // Check the second call (torrent-get)
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.arguments.mapPerFile).toBe(true);
        });

        it('should request swarm-merge-bytes when BiglyBT detected', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                {
                    ok: true,
                    status: 200,
                    body: { result: 'success', arguments: { torrents: [] } }
                }
            ]);

            await adapter.login();
            await adapter.getTorrents();

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.arguments.fields).toContain('swarm-merge-bytes');
            expect(body.arguments.fields).toContain('swarm-bytes');
        });

        it('should NOT request swarm fields when standard Transmission', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: transmissionSessionResponse },
                {
                    ok: true,
                    status: 200,
                    body: { result: 'success', arguments: { torrents: [] } }
                }
            ]);

            await adapter.login();
            await adapter.getTorrents();

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.arguments.fields).not.toContain('swarm-merge-bytes');
        });

        it('should map swarm-merge-bytes to torrent entity', async () => {
            const torrentResponse = {
                result: 'success',
                arguments: {
                    torrents: [{
                        id: 1,
                        name: 'Test Torrent',
                        status: 4,
                        percentDone: 0.75,
                        totalSize: 1000000000,
                        rateDownload: 5000000,
                        rateUpload: 1000000,
                        eta: 1800,
                        downloadDir: '/downloads',
                        addedDate: 1700000000,
                        labels: ['movies'],
                        error: 0,
                        errorString: '',
                        'swarm-merge-bytes': 50000000
                    }]
                }
            };

            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: torrentResponse }
            ]);

            await adapter.login();
            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect((torrents[0] as any).swarmMergeBytes).toBe(50000000);
        });
    });

    // =========================================================================
    // Atomic Tag Operations
    // =========================================================================
    describe('atomic tag operations', () => {
        it('should use tagsAdd for BiglyBT clients', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.addTags('1', ['movies', 'action']);

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.method).toBe('torrent-set');
            expect(body.arguments.tagsAdd).toEqual(['movies', 'action']);
            expect(body.arguments.labels).toBeUndefined();
        });

        it('should use tagsRemove for BiglyBT clients', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.removeTags('1', ['movies']);

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.method).toBe('torrent-set');
            expect(body.arguments.tagsRemove).toEqual(['movies']);
        });

        it('should resolve real hash to numeric ID before calling torrent-set', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                // Mock for resolveNumericId
                {
                    ok: true,
                    status: 200,
                    body: {
                        result: 'success',
                        arguments: {
                            torrents: [{ id: 42 }]
                        }
                    }
                },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.addTags('abcdef1234567890abcdef1234567890', ['movies', 'action']);

            // Last call is torrent-set 
            const lastCall = fetchSpy.mock.calls[2];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.method).toBe('torrent-set');
            expect(body.arguments.ids).toEqual([42]);
            expect(body.arguments.tagsAdd).toEqual(['movies', 'action']);

            // The call before that should be torrent-get for resolution
            const getCall = fetchSpy.mock.calls[1];
            const getBody = JSON.parse(getCall[1]?.body as string);
            expect(getBody.method).toBe('torrent-get');
            expect(getBody.arguments.ids).toEqual(['abcdef1234567890abcdef1234567890']);
        });

        it('should throw an error if hash resolution fails', async () => {
            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                // Mock for resolveNumericId failing to find torrent
                {
                    ok: true,
                    status: 200,
                    body: {
                        result: 'success',
                        arguments: {
                            torrents: []
                        }
                    }
                }
            ]);

            await adapter.login();
            await expect(adapter.addTags('deadbeef', ['movies'])).rejects.toThrow('Failed to resolve numeric ID for torrent: deadbeef');
        });

        it('should fallback to labels for standard Transmission', async () => {
            // For non-BiglyBT, addTags needs to fetch current labels first
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: transmissionSessionResponse },
                {
                    ok: true,
                    status: 200,
                    body: {
                        result: 'success',
                        arguments: {
                            torrents: [{ id: 1, labels: ['existing'] }]
                        }
                    }
                },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.addTags('1', ['new-tag']);

            // Should call torrent-get first to get existing labels
            expect(fetchSpy).toHaveBeenCalledTimes(3);
        });
    });

    // =========================================================================
    // tags-get-list
    // =========================================================================
    describe('getTagList', () => {
        it('should call tags-get-list for BiglyBT', async () => {
            const tagsResponse = {
                result: 'success',
                arguments: {
                    tags: [
                        { uid: 1, name: 'Movies', type: 1, count: 10 },
                        { uid: 2, name: 'TV Shows', type: 1, count: 5 },
                        { uid: 100, name: 'Downloading', type: 2, count: 3 }
                    ]
                }
            };

            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: tagsResponse }
            ]);

            await adapter.login();
            const tags = await adapter.getTagList();

            expect(tags).toHaveLength(3);
            expect(tags[0]).toMatchObject({ uid: 1, name: 'Movies', type: 1 });
            expect(tags[2].type).toBe(2); // Automatic tag
        });

        it('should fallback gracefully for standard Transmission', async () => {
            createMockFetch([
                { ok: true, status: 200, body: transmissionSessionResponse },
                {
                    ok: true,
                    status: 200,
                    body: {
                        result: 'success',
                        arguments: {
                            torrents: [
                                { id: 1, labels: ['movies'] },
                                { id: 2, labels: ['movies', 'action'] }
                            ]
                        }
                    }
                }
            ]);

            await adapter.login();
            const tags = await adapter.getTagList();

            // Should synthesize tags from torrents
            expect(tags.every(t => t.type === 1)).toBe(true);
        });
    });

    // =========================================================================
    // vuze_tags on torrent add
    // =========================================================================
    describe('torrent add with tags', () => {
        it('should use vuze_tags for BiglyBT', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                label: 'movies'
            });

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.arguments.vuze_tags).toEqual(['movies']);
            expect(body.arguments.labels).toBeUndefined();
        });

        it('should use labels for standard Transmission', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: transmissionSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                label: 'movies'
            });

            const lastCall = fetchSpy.mock.calls[1];
            const body = JSON.parse(lastCall[1]?.body as string);

            expect(body.arguments.labels).toEqual(['movies']);
            expect(body.arguments.vuze_tags).toBeUndefined();
        });
    });

    // =========================================================================
    // Error Handling
    // =========================================================================
    describe('error handling', () => {
        it('should truncate Java stack traces', async () => {
            const javaError = {
                result: 'java.lang.NullPointerException: Something went wrong\n\tat com.biglybt.core.SomeClass.method(SomeClass.java:123)\n\tat com.biglybt.core.Another.call(Another.java:456)'
            };

            createMockFetch([
                { ok: true, status: 200, body: javaError }
            ]);

            await expect(adapter.login()).rejects.toThrow();

            try {
                await adapter.login();
            } catch (e) {
                const error = e as Error;
                // Error message should be truncated
                expect(error.message.length).toBeLessThanOrEqual(150);
            }
        });

        it('should retry on 409 with new session ID', async () => {
            const fetchSpy = createMockFetch([
                {
                    ok: false,
                    status: 409,
                    headers: { 'X-Transmission-Session-Id': 'new-session-123' },
                    body: {}
                },
                { ok: true, status: 200, body: biglyBTSessionResponse }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledTimes(2);
            expect(adapter.isBiglyBT).toBe(true);
        });
    });

    // =========================================================================
    // Status Mapping
    // =========================================================================
    describe('status mapping', () => {
        const createTorrentResponse = (status: number) => ({
            result: 'success',
            arguments: {
                torrents: [{
                    id: 1,
                    name: 'Test',
                    status,
                    percentDone: 0.5,
                    totalSize: 1000,
                    rateDownload: 0,
                    rateUpload: 0,
                    eta: 0,
                    downloadDir: '/downloads',
                    addedDate: 0,
                    labels: [],
                    error: 0,
                    errorString: '',
                }]
            }
        });

        it('should map status 0 to paused', async () => {
            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: createTorrentResponse(0) }
            ]);
            await adapter.login();
            const torrents = await adapter.getTorrents();
            expect(torrents[0].status).toBe('paused');
        });

        it('should map status 4 to downloading', async () => {
            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: createTorrentResponse(4) }
            ]);
            await adapter.login();
            const torrents = await adapter.getTorrents();
            expect(torrents[0].status).toBe('downloading');
        });

        it('should map status 6 to seeding', async () => {
            createMockFetch([
                { ok: true, status: 200, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: createTorrentResponse(6) }
            ]);
            await adapter.login();
            const torrents = await adapter.getTorrents();
            expect(torrents[0].status).toBe('seeding');
        });
    });

    // =========================================================================
    // Simple API (Port 6906)
    // =========================================================================
    describe('Simple API', () => {
        // Config with Simple API enabled
        const configWithSimpleApi: ServerConfig = {
            ...mockConfig,
            clientOptions: {
                simpleApiPort: 6906,
                simpleApiKey: 'test-api-key-12345'
            }
        };

        it('should detect when Simple API is not configured', () => {
            const adapterNoSimple = new BiglyBTAdapter(mockConfig);
            expect(adapterNoSimple.isSimpleApiConfigured).toBe(false);
        });

        it('should detect when Simple API is configured', () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            expect(adapterWithSimple.isSimpleApiConfigured).toBe(true);
        });

        it('should return false when setNetworks called without config', async () => {
            const result = await adapter.setNetworks('abc123', ['I2P']);
            expect(result).toBe(false);
        });

        it('should call setNetworks with correct URL', async () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: {} }
            ]);

            const result = await adapterWithSimple.setNetworks('abc123hash', ['I2P', 'Public']);

            expect(result).toBe(true);
            expect(fetchSpy).toHaveBeenCalledTimes(1);

            const url = fetchSpy.mock.calls[0][0] as string;
            expect(url).toContain('method=setnetworks');
            expect(url).toContain('hash=abc123hash');
            expect(url).toContain('networks=I2P%2CPublic');
            expect(url).toContain('apikey=test-api-key-12345');
            expect(url).toContain(':6906');
        });

        it('should call setPeerSources with add prefix', async () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: {} }
            ]);

            await adapterWithSimple.setPeerSources('abc123', ['DHT', 'Tracker'], true);

            const url = fetchSpy.mock.calls[0][0] as string;
            expect(url).toContain('method=setpeersources');
            expect(url).toContain('peersources=%2BDHT%2C%2BTracker');
        });

        it('should call setPeerSources with remove prefix', async () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: {} }
            ]);

            await adapterWithSimple.setPeerSources('abc123', ['DHT'], false);

            const url = fetchSpy.mock.calls[0][0] as string;
            expect(url).toContain('peersources=-DHT');
        });

        it('should call setDownloadAttribute correctly', async () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: {} }
            ]);

            await adapterWithSimple.setDownloadAttribute('abc123', 'uploadspeedlimit', '1000000');

            const url = fetchSpy.mock.calls[0][0] as string;
            expect(url).toContain('method=setdownloadattribute');
            expect(url).toContain('name=uploadspeedlimit');
            expect(url).toContain('value=1000000');
        });

        it('should handle Simple API failure gracefully', async () => {
            const adapterWithSimple = new BiglyBTAdapter(configWithSimpleApi);
            createMockFetch([
                { ok: false, status: 500, body: {} }
            ]);

            const result = await adapterWithSimple.setNetworks('abc123', ['I2P']);
            expect(result).toBe(false);
        });
    });

    // =========================================================================
    // Phase 2: Force Start & Queue Management
    // =========================================================================
    describe('force start', () => {
        beforeEach(() => {
            adapter = new BiglyBTAdapter(mockConfig);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should call torrent-start-now for forceStart', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.forceStart('123');

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.method).toBe('torrent-start-now');
            expect(body.arguments.ids).toEqual([123]);
        });

        it('should batch forceStartAll with multiple IDs', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.forceStartAll(['1', '2', '3']);

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.method).toBe('torrent-start-now');
            expect(body.arguments.ids).toEqual([1, 2, 3]);
        });
    });

    describe('queue management', () => {
        beforeEach(() => {
            adapter = new BiglyBTAdapter(mockConfig);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should call queue-move-top', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.queueMoveTop('123');

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.method).toBe('queue-move-top');
        });

        it('should call queue-move-bottom', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.queueMoveBottom('123');

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.method).toBe('queue-move-bottom');
        });
    });

    describe('per-torrent speed limits', () => {
        beforeEach(() => {
            adapter = new BiglyBTAdapter(mockConfig);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should set upload limit via torrent-set', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.setUploadLimit('123', 500);

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.method).toBe('torrent-set');
            expect(body.arguments.uploadLimit).toBe(500);
            expect(body.arguments.uploadLimited).toBe(true);
        });

        it('should disable upload limit with -1', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                { ok: true, status: 200, body: { result: 'success' } }
            ]);

            await adapter.login();
            await adapter.setUploadLimit('123', -1);

            const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1];
            const body = JSON.parse(lastCall[1].body);
            expect(body.arguments.uploadLimited).toBe(false);
        });

        it('should get speed limits from torrent', async () => {
            createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                {
                    ok: true, status: 200, body: {
                        result: 'success',
                        arguments: {
                            torrents: [{
                                id: 123,
                                name: 'test',
                                status: 4,
                                totalSize: 1000,
                                percentDone: 0.5,
                                rateDownload: 100,
                                rateUpload: 50,
                                eta: 60,
                                downloadDir: '/downloads',
                                addedDate: 1234567890,
                                error: 0,
                                errorString: '',
                                uploadLimit: 1000,
                                uploadLimited: true,
                                downloadLimit: 2000,
                                downloadLimited: false
                            }]
                        }
                    }
                }
            ]);

            await adapter.login();
            const limits = await adapter.getSpeedLimits('123');

            expect(limits).not.toBeNull();
            expect(limits!.uploadLimit).toBe(1000);
            expect(limits!.uploadLimited).toBe(true);
            expect(limits!.downloadLimit).toBe(2000);
            expect(limits!.downloadLimited).toBe(false);
        });
    });

    // =========================================================================
    // Phase 3: Network Inference
    // =========================================================================
    describe('network inference', () => {
        beforeEach(() => {
            adapter = new BiglyBTAdapter(mockConfig);
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should detect I2P network from tracker URL', async () => {
            createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                {
                    ok: true, status: 200, body: {
                        result: 'success',
                        arguments: {
                            torrents: [{
                                id: 123,
                                name: 'test',
                                status: 4,
                                totalSize: 1000,
                                percentDone: 0.5,
                                rateDownload: 100,
                                rateUpload: 50,
                                eta: 60,
                                downloadDir: '/downloads',
                                addedDate: 1234567890,
                                error: 0,
                                errorString: '',
                                trackerStats: [
                                    { announce: 'http://tracker.i2p/announce' }
                                ]
                            }]
                        }
                    }
                }
            ]);

            await adapter.login();
            const status = await adapter.getNetworkStatus('123');

            expect(status).not.toBeNull();
            expect(status!.isI2P).toBe(true);
            expect(status!.isPublic).toBe(false);
            expect(status!.isTor).toBe(false);
        });

        it('should detect Tor network from .onion tracker', async () => {
            createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                {
                    ok: true, status: 200, body: {
                        result: 'success',
                        arguments: {
                            torrents: [{
                                id: 123,
                                name: 'test',
                                status: 4,
                                totalSize: 1000,
                                percentDone: 0.5,
                                rateDownload: 100,
                                rateUpload: 50,
                                eta: 60,
                                downloadDir: '/downloads',
                                addedDate: 1234567890,
                                error: 0,
                                errorString: '',
                                trackerStats: [
                                    { announce: 'http://abc123.onion/announce' }
                                ]
                            }]
                        }
                    }
                }
            ]);

            await adapter.login();
            const status = await adapter.getNetworkStatus('123');

            expect(status).not.toBeNull();
            expect(status!.isTor).toBe(true);
            expect(status!.isPublic).toBe(false);
        });

        it('should detect mixed mode (privacy warning)', async () => {
            createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                {
                    ok: true, status: 200, body: {
                        result: 'success',
                        arguments: {
                            torrents: [{
                                id: 123,
                                name: 'test',
                                status: 4,
                                totalSize: 1000,
                                percentDone: 0.5,
                                rateDownload: 100,
                                rateUpload: 50,
                                eta: 60,
                                downloadDir: '/downloads',
                                addedDate: 1234567890,
                                error: 0,
                                errorString: '',
                                trackerStats: [
                                    { announce: 'http://tracker.i2p/announce' },
                                    { announce: 'http://public.tracker.com/announce' }
                                ]
                            }]
                        }
                    }
                }
            ]);

            await adapter.login();
            const status = await adapter.getNetworkStatus('123');

            expect(status).not.toBeNull();
            expect(status!.isI2P).toBe(true);
            expect(status!.isPublic).toBe(true);
            expect(status!.isMixedMode).toBe(true);
        });

        it('should return human-readable network label', async () => {
            createMockFetch([
                { ok: true, status: 200, headers: { 'X-Transmission-Session-Id': 'test-session' }, body: biglyBTSessionResponse },
                {
                    ok: true, status: 200, body: {
                        result: 'success',
                        arguments: {
                            torrents: [{
                                id: 123,
                                name: 'test',
                                status: 4,
                                totalSize: 1000,
                                percentDone: 0.5,
                                rateDownload: 100,
                                rateUpload: 50,
                                eta: 60,
                                downloadDir: '/downloads',
                                addedDate: 1234567890,
                                error: 0,
                                errorString: '',
                                trackerStats: [
                                    { announce: 'http://tracker.i2p/announce' }
                                ]
                            }]
                        }
                    }
                }
            ]);

            await adapter.login();
            const label = await adapter.getNetworkModeLabel('123');

            expect(label).toBe('I2P');
        });
    });
});
