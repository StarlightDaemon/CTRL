import { describe, it, expect } from 'vitest';
import {
    addressPlaceholder,
    analyzeAddress,
    emptyServerForm,
    formToServer,
    isServerFormValid,
    serverToForm,
    validateServerForm,
} from '@/features/torrent-control/model/serverForm';
import { resolveClientEndpoint } from '@/shared/lib/endpoint';
import { DEFAULT_CLIENT_ID } from '@/shared/lib/constants';
import type { ServerConfig } from '@/shared/lib/types';

const base = (address: string, clientId = 'transmission') => ({
    ...emptyServerForm(clientId),
    name: 'Box',
    address,
});

describe('serverForm — address round trip', () => {
    it.each([
        ['plain http, DNS name, default port', 'http://box.example/', 'http://box.example/'],
        ['https, DNS name', 'https://box.example', 'https://box.example/'],
        ['IPv4 with port', 'http://192.168.1.10:9091', 'http://192.168.1.10:9091/'],
        ['IPv6 loopback with port', 'http://[::1]:9091/', 'http://[::1]:9091/'],
        ['IPv6 ULA with port', 'https://[fd00::5]:8443/', 'https://[fd00::5]:8443/'],
        ['bare host:port (scheme defaulted)', 'nas.local:8080', 'http://nas.local:8080/'],
        ['reverse-proxy sub-path', 'https://home.example/torrents', 'https://home.example/torrents/'],
        ['deep sub-path with port', 'https://home.example:8443/apps/transmission/', 'https://home.example:8443/apps/transmission/'],
        ['aria2 rpc path', 'http://127.0.0.1:6800/jsonrpc', 'http://127.0.0.1:6800/jsonrpc/'],
        ['query and fragment dropped', 'http://box.example:8080/path/?x=1#y', 'http://box.example:8080/path/'],
    ])('%s: save → edit → save is a fixed point', (_label, typed, stored) => {
        const first = formToServer(base(typed));
        expect(first.hostname).toBe(stored);

        // Reload from storage, open the editor, save again without touching anything.
        const reopened = serverToForm(first);
        expect(reopened.address).toBe(stored);
        const second = formToServer(reopened, first);
        expect(second.hostname).toBe(stored);
        expect(second.id).toBe(first.id);
    });

    it('keeps a sub-path meaningful for the adapter endpoint', () => {
        const saved = formToServer(base('https://home.example/tm'));
        expect(resolveClientEndpoint('transmission', saved.hostname)).toBe('https://home.example/tm/transmission/rpc');
        const aria = formToServer(base('http://127.0.0.1:6800/jsonrpc', 'aria2'));
        expect(resolveClientEndpoint('aria2', aria.hostname)).toBe('http://127.0.0.1:6800/jsonrpc');
        const qbt = formToServer(base('https://home.example:8443/qbt', 'qbittorrent'));
        expect(resolveClientEndpoint('qbittorrent', qbt.hostname)).toBe('https://home.example:8443/qbt/api/v2/');
    });
});

describe('serverForm — analysis and validation', () => {
    it('flags plain http only for non-private hosts', () => {
        expect(analyzeAddress('http://box.example/').plainHttpRemote).toBe(true);
        expect(analyzeAddress('http://8.8.8.8:9091/').plainHttpRemote).toBe(true);
        expect(analyzeAddress('http://192.168.1.10:9091/').plainHttpRemote).toBe(false);
        expect(analyzeAddress('http://localhost:9091/').plainHttpRemote).toBe(false);
        expect(analyzeAddress('http://[::1]:9091/').plainHttpRemote).toBe(false);
        expect(analyzeAddress('https://box.example/').plainHttpRemote).toBe(false);
        expect(analyzeAddress('not a url').plainHttpRemote).toBe(false);
    });

    it('exposes the origin used for the permission grant', () => {
        expect(analyzeAddress('https://home.example:8443/apps/tm/').origin).toBe('https://home.example:8443');
        expect(analyzeAddress('http://').origin).toBeNull();
        // A bare word is a valid host name; the scheme is defaulted.
        expect(analyzeAddress('nas').origin).toBe('http://nas');
    });

    it('reports missing name and invalid address with actionable text', () => {
        const errors = validateServerForm({ ...emptyServerForm(), address: '' });
        expect(errors.name).toBe('Enter a name for this server.');
        expect(errors.address).toBe('Enter the server address.');
        expect(validateServerForm(base('ftp://box.example/')).address).toBe('Only http:// and https:// addresses are supported.');
        expect(validateServerForm(base('http://user:pw@box.example/')).address).toBe('Put the username and password in their own fields, not in the address.');
        expect(validateServerForm({ ...base('http://box.example/'), clientId: 'nope' }).clientId).toBe('Choose a BitTorrent client.');
        expect(isServerFormValid(base('http://box.example/'))).toBe(true);
    });

    it('formToServer throws the first validation message', () => {
        expect(() => formToServer({ ...emptyServerForm(), name: '', address: '' })).toThrow('Enter a name for this server.');
    });

    it('uses the selected client placeholder', () => {
        expect(addressPlaceholder('aria2')).toBe('http://127.0.0.1:6800/jsonrpc');
        expect(addressPlaceholder(DEFAULT_CLIENT_ID)).toBe('http://127.0.0.1:9091/');
        expect(addressPlaceholder('unknown')).toBe('http://127.0.0.1:8080/');
    });
});

describe('serverForm — carrying over untouched fields', () => {
    const existing: ServerConfig = {
        id: 'abc',
        name: 'Old',
        application: 'qbittorrent',
        type: 'qbittorrent',
        hostname: 'http://192.168.1.10:8080/',
        username: 'u',
        password: 'p',
        directories: ['/dl'],
        defaultDirectory: '/dl',
        defaultLabel: 'tv',
        clientOptions: { sequentialDownload: true },
        httpAuth: { username: 'proxy', password: 'proxy-pw' },
        showInContextMenu: true,
    };

    it('preserves identity, directories, defaults, httpAuth and context-menu visibility', () => {
        const next = formToServer({ ...serverToForm(existing), name: 'New name' }, existing);
        expect(next.id).toBe('abc');
        expect(next.name).toBe('New name');
        expect(next.directories).toEqual(['/dl']);
        expect(next.defaultDirectory).toBe('/dl');
        expect(next.defaultLabel).toBe('tv');
        expect(next.httpAuth).toEqual({ username: 'proxy', password: 'proxy-pw' });
        expect(next.showInContextMenu).toBe(true);
        expect(next.clientOptions).toEqual({ sequentialDownload: true });
        expect(next.username).toBe('u');
        expect(next.password).toBe('p');
    });

    it('drops client-specific options when the client type changes', () => {
        const next = formToServer({ ...serverToForm(existing), clientId: 'transmission' }, existing);
        expect(next.type).toBe('transmission');
        expect(next.application).toBe('transmission');
        expect(next.clientOptions).toEqual({});
    });

    it('keeps a hidden experimental client type loadable and editable without migration', () => {
        const deluge: ServerConfig = { ...existing, id: 'd', type: 'deluge', application: 'deluge', hostname: 'http://10.0.0.2:8112/' };
        const form = serverToForm(deluge);
        expect(form.clientId).toBe('deluge');
        const saved = formToServer(form, deluge);
        expect(saved.type).toBe('deluge');
        expect(saved.hostname).toBe('http://10.0.0.2:8112/');
    });

    it('assigns a fresh id to a new server', () => {
        const a = formToServer(base('http://a.example/'));
        const b = formToServer(base('http://a.example/'));
        expect(a.id).toBeTruthy();
        expect(a.id).not.toBe(b.id);
    });
});
