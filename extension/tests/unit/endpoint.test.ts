import { describe, it, expect } from 'vitest';
import { parseEndpoint, resolveClientEndpoint, isPrivateHost } from '@/shared/lib/endpoint';

describe('parseEndpoint', () => {
    it.each([
        ['192.168.1.10:9091', 'http://192.168.1.10:9091/'],
        ['http://192.168.1.10:9091', 'http://192.168.1.10:9091/'],
        ['https://box.example', 'https://box.example/'],
        ['https://box.example/torrents/', 'https://box.example/torrents/'],
        ['https://box.example/torrents', 'https://box.example/torrents/'],
        ['http://[::1]:9091/', 'http://[::1]:9091/'],
        ['[fd00::5]:8080', 'http://[fd00::5]:8080/'],
        ['http://box.example:8080/path/?q=1#frag', 'http://box.example:8080/path/'],
        ['  localhost:8080  ', 'http://localhost:8080/'],
    ])('normalises %s to %s', (input, expected) => {
        const result = parseEndpoint(input);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.normalized).toBe(expected);
    });

    it('round-trips a normalised address unchanged', () => {
        for (const value of ['http://192.168.1.10:9091/', 'https://box.example/tm/', 'http://[::1]:6800/']) {
            const r = parseEndpoint(value);
            expect(r.ok && r.normalized).toBe(value);
        }
    });

    it.each([
        ['', 'Enter the server address.'],
        ['ftp://box.example/', 'Only http:// and https:// addresses are supported.'],
        ['javascript:alert(1)', 'Only http:// and https:// addresses are supported.'],
        ['http://user:pass@box.example/', 'Put the username and password in their own fields, not in the address.'],
        ['http://', 'The server address is not a valid URL.'],
    ])('rejects %s', (input, error) => {
        const result = parseEndpoint(input);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error).toBe(error);
    });
});

describe('resolveClientEndpoint', () => {
    it('appends the Transmission RPC path unless already present', () => {
        expect(resolveClientEndpoint('transmission', 'http://192.168.1.10:9091/')).toBe('http://192.168.1.10:9091/transmission/rpc');
        expect(resolveClientEndpoint('transmission', 'https://box.example/tm/')).toBe('https://box.example/tm/transmission/rpc');
        expect(resolveClientEndpoint('transmission', 'https://box.example/custom/rpc')).toBe('https://box.example/custom/rpc');
        expect(resolveClientEndpoint('vuze_remoteui', 'http://[::1]:9091/')).toBe('http://[::1]:9091/transmission/rpc');
    });

    it('appends /jsonrpc for aria2 unless already present', () => {
        expect(resolveClientEndpoint('aria2', 'http://127.0.0.1:6800/')).toBe('http://127.0.0.1:6800/jsonrpc');
        expect(resolveClientEndpoint('aria2', 'http://127.0.0.1:6800')).toBe('http://127.0.0.1:6800/jsonrpc');
        expect(resolveClientEndpoint('aria2', 'http://127.0.0.1:6800/jsonrpc')).toBe('http://127.0.0.1:6800/jsonrpc');
        expect(resolveClientEndpoint('aria2', 'https://dl.example/aria/')).toBe('https://dl.example/aria/jsonrpc');
    });

    it('appends the qBittorrent API root', () => {
        expect(resolveClientEndpoint('qbittorrent', 'http://192.168.1.10:8080')).toBe('http://192.168.1.10:8080/api/v2/');
        expect(resolveClientEndpoint('qbittorrent', 'https://box.example/qbt/')).toBe('https://box.example/qbt/api/v2/');
    });
});

describe('isPrivateHost', () => {
    it.each([
        ['localhost', true], ['127.0.0.1', true], ['10.0.0.5', true], ['192.168.1.235', true], ['172.16.0.1', true], ['172.32.0.1', false],
        ['::1', true], ['[::1]', true], ['fd00::1', true], ['box.example', false], ['8.8.8.8', false], ['nas.local', true],
    ])('%s -> %s', (host, expected) => {
        expect(isPrivateHost(host)).toBe(expected);
    });
});
