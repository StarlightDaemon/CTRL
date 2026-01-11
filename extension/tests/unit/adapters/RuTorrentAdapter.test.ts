/**
 * RuTorrentAdapter Unit Tests
 * 
 * Tests the ruTorrent XML-RPC adapter including XML parsing,
 * multicall operations, and status mapping.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RuTorrentAdapter } from '@/shared/api/clients/rutorrent/RuTorrentAdapter';
import { ServerConfig } from '@/shared/lib/types';

// Mock server config
const mockConfig: ServerConfig = {
    name: 'ruTorrent Server',
    application: 'rutorrent',
    type: 'rutorrent',
    hostname: 'http://localhost:8080/rutorrent',
    username: 'admin',
    password: 'adminpass',
    directories: [],
    clientOptions: {},
};

// Helper to create XML-RPC response
const createXmlResponse = (value: string) => `<?xml version="1.0"?>
<methodResponse>
  <params>
    <param>
      <value>${value}</value>
    </param>
  </params>
</methodResponse>`;

// Helper to create array response
const createArrayResponse = (items: string[]) => {
    const data = items.map(item => `<value>${item}</value>`).join('');
    return createXmlResponse(`<array><data>${data}</data></array>`);
};

// Helper to create torrent list response (multicall)
const createTorrentListResponse = (torrents: Array<{
    hash: string;
    name: string;
    size: number;
    done: number;
    upRate: number;
    downRate: number;
    complete: number;
    state: number;
    active: number;
    label: string;
}>) => {
    const items = torrents.map(t => {
        // Match the order from d.multicall2 in adapter
        return `<value><array><data>
            <value><string>${t.hash}</string></value>
            <value><string>${t.name}</string></value>
            <value><i8>${t.size}</i8></value>
            <value><i8>${t.done}</i8></value>
            <value><i4>${t.upRate}</i4></value>
            <value><i4>${t.downRate}</i4></value>
            <value><i4>${t.complete}</i4></value>
            <value><i4>${t.state}</i4></value>
            <value><i4>${t.active}</i4></value>
            <value><string>${t.label}</string></value>
            <value><i4>0</i4></value>
            <value><i4>0</i4></value>
            <value><string>/downloads</string></value>
            <value><i8>0</i8></value>
            <value><string></string></value>
        </data></array></value>`;
    }).join('');

    return createXmlResponse(`<array><data>${items}</data></array>`);
};

// Helper to create mock fetch
const createMockFetch = (responses: Array<{ ok: boolean; status: number; body: string }>) => {
    let callIndex = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async () => {
        const response = responses[callIndex] || responses[responses.length - 1];
        callIndex++;
        return {
            ok: response.ok,
            status: response.status,
            statusText: response.ok ? 'OK' : 'Error',
            headers: new Headers({}),
            text: () => Promise.resolve(response.body),
            json: () => Promise.resolve({}),
        } as Response;
    });
};

describe('RuTorrentAdapter', () => {
    let adapter: RuTorrentAdapter;

    beforeEach(() => {
        adapter = new RuTorrentAdapter(mockConfig);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('login', () => {
        it('should verify connection by calling system.client_version', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<string>0.9.8</string>') }
            ]);

            await adapter.login();

            expect(fetchSpy).toHaveBeenCalledOnce();
        });

        it('should throw on XML-RPC fault', async () => {
            const faultResponse = `<?xml version="1.0"?>
                <methodResponse>
                    <fault>
                        <value>
                            <struct>
                                <member><name>faultCode</name><value><int>-1</int></value></member>
                                <member><name>faultString</name><value><string>Access denied</string></value></member>
                            </struct>
                        </value>
                    </fault>
                </methodResponse>`;

            createMockFetch([{ ok: true, status: 200, body: faultResponse }]);

            await expect(adapter.login()).rejects.toThrow('rTorrent Fault');
        });
    });

    describe('getTorrents', () => {
        it('should return mapped torrent list from multicall', async () => {
            const response = createTorrentListResponse([{
                hash: 'abc123',
                name: 'Test Torrent',
                size: 1000000000,
                done: 500000000,
                upRate: 100000,
                downRate: 200000,
                complete: 0,
                state: 1,
                active: 1,
                label: 'movies'
            }]);

            createMockFetch([{ ok: true, status: 200, body: response }]);

            const torrents = await adapter.getTorrents();

            expect(torrents).toHaveLength(1);
            expect(torrents[0]).toMatchObject({
                id: 'abc123',
                name: 'Test Torrent',
                status: 'downloading',
                progress: 50,
                category: 'movies'
            });
        });

        it('should return empty array when no torrents', async () => {
            const response = createXmlResponse('<array><data></data></array>');
            createMockFetch([{ ok: true, status: 200, body: response }]);

            const torrents = await adapter.getTorrents();
            expect(torrents).toEqual([]);
        });
    });

    describe('addTorrentUrl', () => {
        it('should add torrent via load.start', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.addTorrentUrl('magnet:?xt=urn:btih:abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('pauseTorrent', () => {
        it('should pause torrent via d.stop', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.pauseTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('resumeTorrent', () => {
        it('should resume torrent via d.start', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.resumeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('removeTorrent', () => {
        it('should remove torrent via d.erase', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.removeTorrent('abc123');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });

    describe('testConnection', () => {
        it('should return true on successful login', async () => {
            createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<string>0.9.8</string>') }
            ]);

            const result = await adapter.testConnection();
            expect(result).toBe(true);
        });

        it('should return false on connection failure', async () => {
            vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

            const result = await adapter.testConnection();
            expect(result).toBe(false);
        });
    });

    describe('status mapping', () => {
        it('should map downloading state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 50,
                upRate: 0, downRate: 100, complete: 0, state: 1, active: 1, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('downloading');
        });

        it('should map seeding state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 100,
                upRate: 100, downRate: 0, complete: 1, state: 1, active: 1, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('seeding');
        });

        it('should map paused state correctly', async () => {
            const response = createTorrentListResponse([{
                hash: 'test', name: 'Test', size: 100, done: 50,
                upRate: 0, downRate: 0, complete: 0, state: 0, active: 0, label: 'test'
            }]);
            createMockFetch([{ ok: true, status: 200, body: response }]);
            const result = await adapter.getTorrents();
            expect(result[0].status).toBe('paused');
        });
    });

    describe('setCategory', () => {
        it('should set category via d.custom1.set', async () => {
            const fetchSpy = createMockFetch([
                { ok: true, status: 200, body: createXmlResponse('<i4>0</i4>') }
            ]);

            await adapter.setCategory('abc123', 'movies');

            expect(fetchSpy).toHaveBeenCalledOnce();
        });
    });
});
