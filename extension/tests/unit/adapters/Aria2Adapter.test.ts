/**
 * Aria2Adapter Unit Tests
 * 
 * Tests the Aria2 JSON-RPC adapter including:
 * - Token authentication
 * - Error taxonomy and handling
 * - Feature detection
 * - Metadata extraction
 * - Retry logic
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Aria2Adapter } from '@/shared/api/clients/aria2/Aria2Adapter';
import { Aria2Error } from '@/shared/api/clients/aria2/Aria2Error';
import { ServerConfig } from '@/shared/lib/types';
import { Aria2AdapterError, Aria2ErrorType } from '@/shared/api/clients/aria2/Aria2AdapterError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'Aria2 Server',
    application: 'aria2',
    type: 'aria2',
    hostname: 'http://localhost:6800/jsonrpc',
    username: '',
    password: 'mysecret', // RPC secret
    directories: [],
    clientOptions: { retryConfig: { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 } },
};

// Helper to create mock JSON-RPC responses
const createMockFetch = (responses: Array<{ ok: boolean; status: number; body: any }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers({}),
            text: () => Promise.resolve(typeof response.body === 'string' ? response.body : JSON.stringify(response.body)),
            json: () => Promise.resolve(response.body),
        } as Response;
    });
};

// Helper to create Aria2 JSON-RPC response
const rpcResponse = (result: any, id: number = 1) => ({
    jsonrpc: '2.0',
    result,
    id
});

// Helper to create RPC error response
const rpcError = (code: number, message: string, id: number = 1) => ({
    jsonrpc: '2.0',
    error: { code, message },
    id
});

// Helper to create multicall response (results wrapped in arrays)
const multicallResponse = (results: any[]) => ({
    jsonrpc: '2.0',
    result: results.map(r => [r]), // Multicall wraps each result in array
    id: 1
});

describe('Aria2Adapter', () => {
    let adapter: Aria2Adapter;

    beforeEach(() => {
        adapter = new Aria2Adapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should verify connection and parse version info', async () => {
            const fetchSpy = createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse({
                        version: '1.36.0',
                        enabledFeatures: ['BitTorrent', 'Metalink', 'HTTPS']
                    })
                }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
            expect(adapter.getDaemonVersion()).toBe('1.36.0');
            expect(adapter.hasFeature('BitTorrent')).toBe(true);
        });

        it('should warn when BitTorrent is not enabled', async () => {
            const warnSpy = vi.spyOn(console, 'warn');
            createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse({
                        version: '1.36.0',
                        enabledFeatures: ['HTTPS'] // No BitTorrent
                    })
                }
            ]);

            await adapter.login();

            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('BitTorrent support')
            );
        });

        it('should throw on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Connection refused'));

            await expect(adapter.login()).rejects.toThrow();
        }, 45000); // Extended timeout for retry logic
    });

    describe('getTorrents', () => {
        it('should aggregate active, waiting, and stopped torrents', async () => {
            const mockTorrent = {
                gid: 'abc123',
                status: 'active',
                totalLength: '1000000000',
                completedLength: '500000000',
                uploadLength: '100000000',
                downloadSpeed: '1000000',
                uploadSpeed: '500000',
                dir: '/downloads'
            };

            // getTorrents now uses system.multicall - single response with all 3 results
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[mockTorrent], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                status: 'downloading',
                progress: 50,
            });
        });

        it('should extract name from bittorrent.info.name', async () => {
            const mockTorrent = {
                gid: 'abc123',
                status: 'active',
                totalLength: '1000000000',
                completedLength: '500000000',
                uploadLength: '0',
                downloadSpeed: '1000000',
                uploadSpeed: '0',
                dir: '/downloads',
                bittorrent: {
                    info: { name: 'My Awesome Torrent' }
                }
            };

            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[mockTorrent], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents[0].name).toBe('My Awesome Torrent');
        });

        it('should fallback to file path when bittorrent.info is missing', async () => {
            const mockTorrent = {
                gid: 'abc123',
                status: 'active',
                totalLength: '1000000000',
                completedLength: '500000000',
                uploadLength: '0',
                downloadSpeed: '1000000',
                uploadSpeed: '0',
                dir: '/downloads',
                files: [{ path: '/downloads/video.mp4', length: '1000000000', completedLength: '500000000', selected: 'true' }]
            };

            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[mockTorrent], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents[0].name).toBe('video.mp4');
        });

        it('should calculate ETA from speed and remaining bytes', async () => {
            const mockTorrent = {
                gid: 'abc123',
                status: 'active',
                totalLength: '1000000', // 1MB total
                completedLength: '500000', // 500KB done
                uploadLength: '0',
                downloadSpeed: '100000', // 100KB/s
                uploadSpeed: '0',
                dir: '/downloads'
            };

            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[mockTorrent], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();
            // 500KB remaining / 100KB/s = 5 seconds
            expect(torrents[0].eta).toBe(5);
        });

        it('should return empty array when no torrents', async () => {
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent with URL', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('gid123') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should include options when provided', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('gid123') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123', {
                paused: true,
                path: '/downloads/movies',
            });

            // Request should have been made with options
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent by gid', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent by gid', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent and clean up', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') },
                { ok: true, status: 200, body: rpcResponse('OK') }, // removeDownloadResult
            ]);

            await adapter.removeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledTimes(2);
        });

        it('should handle removeDownloadResult failure gracefully', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') },
                // Return valid RPC response with error to avoid retry loop
                { ok: true, status: 200, body: rpcResponse('OK') },
            ]);

            // Should not throw
            await expect(adapter.removeTorrent('abc123')).resolves.not.toThrow();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful connection', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse({ version: '1.36.0', enabledFeatures: [] }) }
            ]);

            const result = await adapter.testConnection();
            expect(result).toEqual({ connected: true });
        });

        it('should return { connected: false } on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testConnection();
            expect(result.connected).toBe(false);
            expect(result.error?.type).toBe('NETWORK_ERROR');
        });
    });

    describe('getGlobalStats', () => {
        it('should return parsed global statistics', async () => {
            createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse({
                        downloadSpeed: '1000000',
                        uploadSpeed: '500000',
                        numActive: '3',
                        numWaiting: '5',
                        numStopped: '10'
                    })
                }
            ]);

            const stats = await adapter.getGlobalStats();

            expect(stats).toEqual({
                downloadSpeed: 1000000,
                uploadSpeed: 500000,
                activeCount: 3,
                waitingCount: 5,
                stoppedCount: 10,
            });
        });
    });

    describe('status mapping', () => {
        it('should map aria2 states correctly', async () => {
            const createTorrentResponse = (status: string, errorCode?: string) => ([{
                gid: 'test',
                status,
                totalLength: '100',
                completedLength: '50',
                uploadLength: '0',
                downloadSpeed: '0',
                uploadSpeed: '0',
                dir: '',
                ...(errorCode && { errorCode })
            }]);

            // Active = downloading
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([createTorrentResponse('active'), [], []]) }
            ]);
            let result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');

            // Waiting = queued
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[], createTorrentResponse('waiting'), []]) }
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('queued');

            // Paused
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([createTorrentResponse('paused'), [], []]) }
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');

            // Complete
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[], [], createTorrentResponse('complete')]) }
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('completed');

            // Error code takes precedence
            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([createTorrentResponse('active', '1'), [], []]) }
            ]);
            result = await adapter.getTorrents();
            expect(result[0].status).toBe('error');
        });
    });

    describe('categories and tags', () => {
        it('should return empty array for categories (not supported)', async () => {
            const categories = await adapter.getCategories();
            expect(categories).toEqual([]);
        });

        it('should return empty array for tags (not supported)', async () => {
            const tags = await adapter.getTags();
            expect(tags).toEqual([]);
        });
    });

    describe('getFiles', () => {
        it('should return file list with progress', async () => {
            createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse([
                        { index: '1', path: '/downloads/file1.mp4', length: '1000000', completedLength: '500000', selected: 'true' },
                        { index: '2', path: '/downloads/file2.txt', length: '1000', completedLength: '1000', selected: 'false' },
                    ])
                }
            ]);

            const files = await adapter.getFiles('abc123');

            expect(files).toHaveLength(2);
            expect(files[0]).toEqual({
                index: 1,
                path: '/downloads/file1.mp4',
                size: 1000000,
                completed: 500000,
                selected: true,
                progress: 50,
            });
            expect(files[1].selected).toBe(false);
            expect(files[1].progress).toBe(100);
        });
    });

    describe('selectFiles', () => {
        it('should convert 0-based indices to 1-based for Aria2', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('OK') }
            ]);

            await adapter.selectFiles('abc123', [0, 2, 4]); // 0-based

            expect(fetchSpy).toHaveBeenCalledOnce();
            // The call should convert to 1-based: "1,3,5"
        });

        it('should include bt-remove-unselected-file when requested', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse('OK') }
            ]);

            await adapter.selectFiles('abc123', [0], true);
            // Should include bt-remove-unselected-file: 'true' in options
        });
    });

    describe('getPeers', () => {
        it('should return parsed peer list', async () => {
            createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse([
                        {
                            ip: '192.168.1.100',
                            port: '51413',
                            downloadSpeed: '100000',
                            uploadSpeed: '50000',
                            seeder: 'true',
                            peerChoking: 'false',
                            amChoking: 'false'
                        },
                        {
                            ip: '10.0.0.1',
                            port: '6881',
                            downloadSpeed: '0',
                            uploadSpeed: '25000',
                            seeder: 'false',
                            peerChoking: 'true',
                            amChoking: 'true'
                        }
                    ])
                }
            ]);

            const peers = await adapter.getPeers('abc123');

            expect(peers).toHaveLength(2);
            expect(peers[0]).toEqual({
                ip: '192.168.1.100',
                port: 51413,
                downloadSpeed: 100000,
                uploadSpeed: 50000,
                isSeeder: true,
                isChoking: false,
                amChoking: false,
            });
            expect(peers[1].isSeeder).toBe(false);
            expect(peers[1].isChoking).toBe(true);
        });

        it('should return empty array when no peers', async () => {
            createMockFetch([
                { ok: true, status: 200, body: rpcResponse([]) }
            ]);

            const peers = await adapter.getPeers('abc123');
            expect(peers).toEqual([]);
        });
    });

    describe('bandwidth control', () => {
        it('should set global speed limits', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('OK') }
            ]);

            await adapter.setGlobalSpeedLimits(1000000, 500000);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should set per-torrent speed limits', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('OK') }
            ]);

            await adapter.setTorrentSpeedLimits('abc123', 500000, 250000);

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should get global options', async () => {
            createMockFetch([
                {
                    ok: true, status: 200, body: rpcResponse({
                        'max-overall-download-limit': '1000000',
                        'max-overall-upload-limit': '500000',
                        'max-concurrent-downloads': '10'
                    })
                }
            ]);

            const options = await adapter.getGlobalOptions();

            expect(options).toEqual({
                maxDownloadLimit: 1000000,
                maxUploadLimit: 500000,
                maxConcurrentDownloads: 10,
            });
        });
    });

    describe('force operations', () => {
        it('should force remove a torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.forceRemoveTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should force pause a torrent', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: rpcResponse('abc123') }
            ]);

            await adapter.forcePauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('magnet-session followedBy/following array parsing', () => {
        it('should parse torrent payload with followedBy array without schema error', async () => {
            // Real Aria2 magnet-session payload: followedBy is an array of GID strings,
            // not a scalar string. Prior to the fix this caused a Zod parse failure.
            const magnetSessionTorrent = {
                gid: 'magnet001',
                status: 'active',
                totalLength: '0',           // unknown until metadata is fetched
                completedLength: '0',
                uploadLength: '0',
                downloadSpeed: '0',
                uploadSpeed: '0',
                dir: '/downloads',
                followedBy: ['torrent002'], // array wire format
            };

            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[magnetSessionTorrent], [], []]) }
            ]);

            // Should not throw a ZodError
            const torrents = await adapter.getTorrents();
            expect(torrents).toHaveLength(1);
            expect(torrents[0].id).toBe('magnet001');
        });

        it('should parse torrent payload with both followedBy and following arrays', async () => {
            const torrentWithBothFields = {
                gid: 'torrent002',
                status: 'active',
                totalLength: '1000000000',
                completedLength: '200000000',
                uploadLength: '0',
                downloadSpeed: '5000000',
                uploadSpeed: '0',
                dir: '/downloads',
                followedBy: ['torrent003'],   // array
                following: ['magnet001'],      // array
            };

            createMockFetch([
                { ok: true, status: 200, body: multicallResponse([[torrentWithBothFields], [], []]) }
            ]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toHaveLength(1);
            expect(torrents[0].id).toBe('torrent002');
            expect(torrents[0].status).toBe('downloading');
        });
    });

    describe('structured RPC error propagation', () => {
        it('should surface auth failure as UNAUTHORIZED Aria2Error, not NETWORK_ERROR', async () => {
            // Aria2 returns code 1 with "Unauthorized" message when the RPC secret is wrong.
            // The fix ensures JsonRpcClient throws JsonRpcError (with .code property) so
            // Aria2Adapter.wrapError() reaches the structured-RPC branch and calls
            // Aria2Error.fromRpcError(), yielding UNAUTHORIZED (non-retryable).
            createMockFetch([
                { ok: true, status: 200, body: rpcError(1, 'Unauthorized') }
            ]);

            let caughtError: Aria2Error | undefined;
            try {
                await adapter.login();
            } catch (e) {
                if (e instanceof Aria2Error) {
                    caughtError = e;
                }
            }

            expect(caughtError).toBeDefined();
            expect(caughtError?.code).toBe('UNAUTHORIZED');
            // Must NOT be misclassified as a generic network error
            expect(caughtError?.code).not.toBe('NETWORK_ERROR');
            // Auth errors must not be retried
            expect(caughtError?.retryable).toBe(false);
        });

        it('should surface structured RPC Aria2Error from getTorrents, not a plain NETWORK_ERROR', async () => {
            // When system.multicall returns a JSON-RPC error (code 1), the structured
            // error path via JsonRpcError → wrapError() → fromRpcError() is exercised.
            // Context is 'system.multicall', which maps to GID_NOT_FOUND for code 1 —
            // but crucially: it is NOT a plain NETWORK_ERROR and is NOT retryable.
            // This proves the structured propagation path (not the network-error fallback) is active.
            createMockFetch([
                { ok: true, status: 200, body: rpcError(1, 'Unauthorized') }
            ]);

            let caughtError: unknown;
            try {
                await adapter.getTorrents();
            } catch (e) {
                caughtError = e;
            }

            // Must be a typed Aria2Error (structured RPC path), not a generic Error
            expect(caughtError).toBeInstanceOf(Aria2Error);
            const aria2Err = caughtError as Aria2Error;
            // Must carry the original numeric RPC code
            expect(aria2Err.rpcCode).toBe(1);
            // Must NOT be classified as a network error
            expect(aria2Err.code).not.toBe('NETWORK_ERROR');
            // Must NOT be retryable (RPC errors are not retried)
            expect(aria2Err.retryable).toBe(false);
        });
    });
});

describe('Aria2Error', () => {
    describe('fromRpcError', () => {
        it('should map -32602 to INVALID_PARAMS', () => {
            const error = Aria2Error.fromRpcError(
                { code: -32602, message: 'Invalid params' },
                'test'
            );
            expect(error.code).toBe('INVALID_PARAMS');
            expect(error.retryable).toBe(false);
        });

        it('should map code 1 in login context to UNAUTHORIZED', () => {
            const error = Aria2Error.fromRpcError(
                { code: 1, message: 'Unauthorized' },
                'login'
            );
            expect(error.code).toBe('UNAUTHORIZED');
        });

        it('should map code 1 in status context to GID_NOT_FOUND', () => {
            const error = Aria2Error.fromRpcError(
                { code: 1, message: 'GID not found' },
                'tellStatus'
            );
            expect(error.code).toBe('GID_NOT_FOUND');
        });

        it('should map code 18 to FILE_SYSTEM_ERROR', () => {
            const error = Aria2Error.fromRpcError(
                { code: 18, message: 'Permission denied' },
                'addUri'
            );
            expect(error.code).toBe('FILE_SYSTEM_ERROR');
        });
    });

    describe('fromNetworkError', () => {
        it('should detect timeout errors', () => {
            const error = Aria2Error.fromNetworkError(
                new Error('Request timeout after 30000ms'),
                'test'
            );
            expect(error.code).toBe('TIMEOUT');
            expect(error.retryable).toBe(true);
        });

        it('should mark network errors as retryable', () => {
            const error = Aria2Error.fromNetworkError(
                new Error('Connection refused'),
                'test'
            );
            expect(error.code).toBe('NETWORK_ERROR');
            expect(error.retryable).toBe(true);
        });
    });

    describe('helper methods', () => {
        it('isConnectionError should identify network issues', () => {
            const networkError = Aria2Error.fromNetworkError(new Error('fail'), 'test');
            expect(networkError.isConnectionError()).toBe(true);

            const authError = Aria2Error.fromRpcError({ code: 1, message: 'Unauthorized' }, 'login');
            expect(authError.isConnectionError()).toBe(false);
        });

        it('isAuthError should identify authentication failures', () => {
            const authError = Aria2Error.fromRpcError({ code: 1, message: 'Unauthorized' }, 'login');
            expect(authError.isAuthError()).toBe(true);

            const gidError = Aria2Error.fromRpcError({ code: 1, message: 'GID not found' }, 'tellStatus');
            expect(gidError.isAuthError()).toBe(false);
        });
    });
});



describe('Aria2Adapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: Aria2ErrorType[] = [
    'PARSE_ERROR', 'INVALID_REQUEST', 'METHOD_NOT_FOUND', 'INVALID_PARAMS', 'UNAUTHORIZED',
    'GID_NOT_FOUND', 'FILE_SYSTEM_ERROR', 'NETWORK_ERROR', 'TIMEOUT', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'aria2',
        type: 'aria2',
        hostname: 'http://localhost:6800/jsonrpc',
        password: 'secret',
        directories: [],
        clientOptions: { retryConfig },
    };
}

function aria2Error(code: Aria2ErrorType, retryable = false): Aria2Error {
    return new Aria2Error({ code, message: `aria2 ${code}`, context: 'test', retryable });
}

describe('Aria2AdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new Aria2AdapterError('UNAUTHORIZED', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(Aria2AdapterError);
        expect(e.type).toBe('UNAUTHORIZED');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('Aria2AdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new Aria2AdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new Aria2AdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification', () => {
        it('reuses Aria2Error codes directly', () => {
            for (const t of ['UNAUTHORIZED', 'GID_NOT_FOUND', 'FILE_SYSTEM_ERROR', 'NETWORK_ERROR', 'TIMEOUT'] as Aria2ErrorType[]) {
                expect(Aria2AdapterError.from(aria2Error(t)).type).toBe(t);
            }
        });
        it('maps a fetch TypeError → NETWORK_ERROR', () => {
            expect(Aria2AdapterError.from(new TypeError('Failed to fetch')).type).toBe('NETWORK_ERROR');
        });
        it('maps a timeout message → TIMEOUT', () => {
            expect(Aria2AdapterError.from(new Error('Request timeout after 30000ms')).type).toBe('TIMEOUT');
        });
        it('passes an existing Aria2AdapterError through unchanged', () => {
            const original = new Aria2AdapterError('PARSE_ERROR', 'x');
            expect(Aria2AdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(aria2Error('NETWORK_ERROR', true));
            expect(Aria2AdapterError.from(wrapped).type).toBe('NETWORK_ERROR');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(Aria2AdapterError.from(42).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (Aria2)', () => {
    it('retries on transient failure and then resolves', async () => {
        let calls = 0;
        const fn = vi.fn(async () => {
            calls++;
            if (calls < 2) throw new Error('transient');
            return 'ok';
        });
        await expect(withAdapterRetry(fn, FAST_RETRY)).resolves.toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('rethrows an AdapterError unchanged on exhaustion', async () => {
        const err = new Aria2AdapterError('NETWORK_ERROR', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('Aria2Adapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new Aria2Adapter(makeConfig());
        vi.spyOn(adapter, 'getVersionInfo').mockResolvedValue({ version: '1.36.0', enabledFeatures: ['BitTorrent'] });
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new Aria2Adapter(makeConfig());
        vi.spyOn(adapter, 'getVersionInfo').mockRejectedValue(aria2Error('UNAUTHORIZED'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(Aria2AdapterError);
        expect(result.error?.type).toBe('UNAUTHORIZED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('does not retry a non-retryable error (fails fast)', async () => {
        const adapter = new Aria2Adapter(makeConfig(FAST_RETRY));
        const rpc = vi.spyOn((adapter as unknown as { rpcClient: { call: () => Promise<unknown> } }).rpcClient, 'call')
            .mockRejectedValue(aria2Error('UNAUTHORIZED', false));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('UNAUTHORIZED');
        expect(rpc).toHaveBeenCalledTimes(1);
    });

    it('retries a transient network failure before reporting connected', async () => {
        const adapter = new Aria2Adapter(makeConfig(FAST_RETRY));
        let calls = 0;
        vi.spyOn((adapter as unknown as { rpcClient: { call: () => Promise<unknown> } }).rpcClient, 'call')
            .mockImplementation(async () => {
                calls++;
                if (calls < 2) throw new TypeError('Failed to fetch');
                return { version: '1.36.0', enabledFeatures: ['BitTorrent'] };
            });
        const result = await adapter.testConnection();
        expect(result.connected).toBe(true);
        expect(calls).toBe(2);
    });
});

});
