import { describe, it, expect } from 'vitest';
import { sanitizeServerForExport, sanitizeServersForExport } from '@/features/torrent-control/model/exportSanitizer';
import type { ServerConfig } from '@/shared/lib/types';

/**
 * A configuration with a secret in every location a secret can live.
 * Every string below must be absent from a safe export.
 */
const SECRETS = {
    password: 'MAIN-PASSWORD-SECRET',
    httpPassword: 'HTTP-AUTH-SECRET',
    apiKey: 'BIGLYBT-API-KEY-SECRET',
    token: 'RPC-TOKEN-SECRET',
    userinfo: 'URL-USER:URL-PASS',
    nested: 'NESTED-SECRET',
    future: 'FUTURE-UNKNOWN-SECRET',
};

const loaded: ServerConfig = {
    id: 'srv-1',
    name: 'Seedbox',
    application: 'biglybt',
    type: 'biglybt',
    hostname: `https://${SECRETS.userinfo}@box.example:9091/`,
    username: 'alice',
    password: SECRETS.password,
    directories: ['/data/tv'],
    defaultDirectory: '/data/tv',
    defaultLabel: 'tv',
    showInContextMenu: true,
    httpAuth: { username: 'proxy-user', password: SECRETS.httpPassword },
    clientOptions: {
        simpleApiKey: SECRETS.apiKey,
        token: SECRETS.token,
        retryConfig: { maxAttempts: 3 },
        auth: { secret: SECRETS.nested },
        somethingNew: SECRETS.future,
    },
};

describe('sanitizeServerForExport', () => {
    it('removes every credential-bearing value', () => {
        const safe = sanitizeServerForExport(loaded);
        const serialised = JSON.stringify(safe);
        for (const [name, secret] of Object.entries(SECRETS)) {
            expect(serialised, `secret "${name}" leaked`).not.toContain(secret);
        }
        expect(serialised).not.toContain('URL-USER');
        expect(serialised).not.toContain('URL-PASS');
    });

    it('keeps the non-secret identity and layout fields', () => {
        const safe = sanitizeServerForExport(loaded);
        expect(safe).toMatchObject({
            id: 'srv-1',
            name: 'Seedbox',
            application: 'biglybt',
            type: 'biglybt',
            hostname: 'https://box.example:9091/',
            username: 'alice',
            directories: ['/data/tv'],
            defaultDirectory: '/data/tv',
            defaultLabel: 'tv',
            showInContextMenu: true,
            httpAuth: { username: 'proxy-user' },
        });
        expect(safe.httpAuth).not.toHaveProperty('password');
        expect(safe).not.toHaveProperty('password');
    });

    it('keeps only client options the client definition declares as settings', () => {
        const qb: ServerConfig = {
            ...loaded,
            type: 'qbittorrent',
            application: 'qbittorrent',
            clientOptions: { sequentialDownload: true, contentLayout: 'Subfolder', apiKey: 'QB-API-KEY', retryConfig: { maxAttempts: 9 } },
        };
        const safe = sanitizeServerForExport(qb);
        expect(safe.clientOptions).toEqual({ sequentialDownload: true, contentLayout: 'Subfolder' });
    });

    it('drops unknown client options for clients without declared settings', () => {
        const safe = sanitizeServerForExport({ ...loaded, type: 'transmission', clientOptions: { anything: 'x' } });
        expect(safe.clientOptions).toEqual({});
    });

    it('does not mutate the input', () => {
        const copy = JSON.parse(JSON.stringify(loaded));
        sanitizeServersForExport([loaded]);
        expect(loaded).toEqual(copy);
    });
});
