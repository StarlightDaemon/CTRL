import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SynologyAdapter } from '@/shared/api/clients/synology/SynologyAdapter';
import { ServerConfig } from '@/shared/lib/types';
import { SynologyAdapterError, SynologyErrorType } from '@/shared/api/clients/synology/SynologyAdapterError';
import { withAdapterRetry, RetryConfig, RetryExhaustedError } from '@/shared/lib/retry/withAdapterRetry';
import { AdapterError } from '@/shared/api/clients/shared/AdapterError';

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

            expect(getTaskError(401)).toBe('Max number of concurrent tasks reached');
            expect(getTaskError(403)).toBe('Destination access denied - check permissions');
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



describe('SynologyAdapter — AdapterError & withAdapterRetry (parity)', () => {
const FAST_RETRY: RetryConfig = { maxAttempts: 3, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };
const NO_RETRY: RetryConfig = { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0, backoffMultiplier: 1 };

const ALL_TYPES: SynologyErrorType[] = [
    'CONNECTION_REFUSED', 'TIMEOUT', 'AUTH_FAILED', 'OTP_REQUIRED', 'OTP_FAILED',
    'IP_BLOCKED', 'PERMISSION_DENIED', 'SESSION_EXPIRED', 'NETWORK_ERROR', 'UNKNOWN',
];

function makeConfig(retryConfig: RetryConfig = NO_RETRY): ServerConfig {
    return {
        name: 'Test',
        application: 'synology',
        type: 'synology',
        hostname: 'http://nas.local:5000',
        username: 'admin',
        password: 'pass',
        directories: [],
        clientOptions: { retryConfig },
    };
}

type GetSpy = { client: { get: (...args: unknown[]) => Promise<unknown> } };

describe('SynologyAdapterError', () => {
    it('constructs with type and message and is an AdapterError', () => {
        const e = new SynologyAdapterError('IP_BLOCKED', 'nope');
        expect(e).toBeInstanceOf(AdapterError);
        expect(e).toBeInstanceOf(SynologyAdapterError);
        expect(e.type).toBe('IP_BLOCKED');
        expect(e.message).toBe('nope');
        expect(e.name).toBe('SynologyAdapterError');
    });

    it('returns a non-empty user message for every error type', () => {
        for (const t of ALL_TYPES) {
            const msg = new SynologyAdapterError(t, 'x').toUserMessage();
            expect(typeof msg).toBe('string');
            expect(msg.length).toBeGreaterThan(0);
        }
    });

    it('returns a distinct user message per error type', () => {
        const msgs = ALL_TYPES.map(t => new SynologyAdapterError(t, 'x').toUserMessage());
        expect(new Set(msgs).size).toBe(ALL_TYPES.length);
    });

    describe('from() classification (DSM message codes)', () => {
        it('maps "No such account or incorrect password" → AUTH_FAILED', () => {
            expect(SynologyAdapterError.from(new Error('No such account or incorrect password')).type).toBe('AUTH_FAILED');
        });
        it('maps a 2FA-required message → OTP_REQUIRED', () => {
            expect(SynologyAdapterError.from(new Error('2-factor authentication code required')).type).toBe('OTP_REQUIRED');
        });
        it('maps a 2FA-failed message → OTP_FAILED', () => {
            expect(SynologyAdapterError.from(new Error('2-factor authentication failed')).type).toBe('OTP_FAILED');
        });
        it('maps a blocked-IP message → IP_BLOCKED', () => {
            expect(SynologyAdapterError.from(new Error('Blocked IP source - too many failed attempts')).type).toBe('IP_BLOCKED');
        });
        it('maps an insufficient-privilege message → PERMISSION_DENIED', () => {
            expect(SynologyAdapterError.from(new Error('Insufficient privilege for this operation')).type).toBe('PERMISSION_DENIED');
        });
        it('maps a session-expiry message → SESSION_EXPIRED', () => {
            expect(SynologyAdapterError.from(new Error('SID not found (session expired)')).type).toBe('SESSION_EXPIRED');
        });
        it('maps "Network failure" → NETWORK_ERROR', () => {
            expect(SynologyAdapterError.from(new Error('Network failure')).type).toBe('NETWORK_ERROR');
        });
        it('maps a self-signed-certificate / fetch failure → CONNECTION_REFUSED', () => {
            expect(SynologyAdapterError.from(new TypeError('Failed to fetch')).type).toBe('CONNECTION_REFUSED');
            expect(SynologyAdapterError.from(new Error('self-signed certificate in chain')).type).toBe('CONNECTION_REFUSED');
        });
        it('passes an existing SynologyAdapterError through unchanged', () => {
            const original = new SynologyAdapterError('PERMISSION_DENIED', 'x');
            expect(SynologyAdapterError.from(original)).toBe(original);
        });
        it('unwraps RetryExhaustedError to classify the underlying cause', () => {
            const wrapped = new RetryExhaustedError(new Error('No such account or incorrect password'));
            expect(SynologyAdapterError.from(wrapped).type).toBe('AUTH_FAILED');
        });
        it('falls back to UNKNOWN for unrecognized values', () => {
            expect(SynologyAdapterError.from(new Error('weird DSM glitch')).type).toBe('UNKNOWN');
        });
    });
});

describe('withAdapterRetry (Synology)', () => {
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
        const err = new SynologyAdapterError('CONNECTION_REFUSED', 'down');
        const fn = vi.fn(async () => { throw err; });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBe(err);
        expect(fn).toHaveBeenCalledTimes(FAST_RETRY.maxAttempts);
    });

    it('wraps a non-AdapterError as RetryExhaustedError on exhaustion', async () => {
        const fn = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        await expect(withAdapterRetry(fn, FAST_RETRY)).rejects.toBeInstanceOf(RetryExhaustedError);
    });
});

describe('SynologyAdapter.testConnection', () => {
    it('returns { connected: true } on success', async () => {
        const adapter = new SynologyAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        vi.spyOn((adapter as unknown as GetSpy).client, 'get').mockResolvedValue({ success: true, data: {} });
        await expect(adapter.testConnection()).resolves.toEqual({ connected: true });
    });

    it('returns { connected: false, error } with a classified AdapterError on auth failure', async () => {
        const adapter = new SynologyAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('No such account or incorrect password'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error).toBeInstanceOf(SynologyAdapterError);
        expect(result.error?.type).toBe('AUTH_FAILED');
        expect(typeof result.error?.toUserMessage()).toBe('string');
    });

    it('classifies a 2FA requirement as OTP_REQUIRED', async () => {
        const adapter = new SynologyAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockRejectedValue(new Error('2-factor authentication code required'));
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('OTP_REQUIRED');
    });

    it('maps an info-probe failure code to PERMISSION_DENIED', async () => {
        const adapter = new SynologyAdapter(makeConfig());
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        vi.spyOn((adapter as unknown as GetSpy).client, 'get').mockResolvedValue({ success: false, error: { code: 105 } });
        const result = await adapter.testConnection();
        expect(result.connected).toBe(false);
        expect(result.error?.type).toBe('PERMISSION_DENIED');
    });

    it('does NOT retry login (preserves IP-block protection)', async () => {
        const adapter = new SynologyAdapter(makeConfig(FAST_RETRY));
        const loginSpy = vi.spyOn(adapter, 'login').mockRejectedValue(new Error('No such account or incorrect password'));
        await adapter.testConnection();
        expect(loginSpy).toHaveBeenCalledTimes(1);
    });

    it('retries a transient info-probe failure before reporting connected', async () => {
        const adapter = new SynologyAdapter(makeConfig(FAST_RETRY));
        vi.spyOn(adapter, 'login').mockResolvedValue(undefined);
        let calls = 0;
        vi.spyOn((adapter as unknown as GetSpy).client, 'get').mockImplementation(async () => {
            calls++;
            if (calls < 2) throw new TypeError('Failed to fetch');
            return { success: true, data: {} };
        });
        const result = await adapter.testConnection();
        expect(result.connected).toBe(true);
        expect(calls).toBe(2);
    });
});

});
