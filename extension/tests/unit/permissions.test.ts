import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { checkHostPermission, requestHostPermission, toMatchPattern } from '@/shared/lib/permissions';
import { stubPermissions, type PermissionStub } from './ui/browserStubs';

const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36';
const FIREFOX_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:155.0) Gecko/20100101 Firefox/155.0';

function setUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

describe('toMatchPattern', () => {
    it('keeps the port on Chrome (narrowest grant) and drops it on Firefox (no port support)', () => {
        expect(toMatchPattern('http://192.168.1.235:16800/jsonrpc', false)).toBe('http://192.168.1.235:16800/*');
        expect(toMatchPattern('http://192.168.1.235:16800/jsonrpc', true)).toBe('http://192.168.1.235/*');
        expect(toMatchPattern('https://box.example:8443/apps/tm/', false)).toBe('https://box.example:8443/*');
        expect(toMatchPattern('https://box.example:8443/apps/tm/', true)).toBe('https://box.example/*');
    });

    it('omits default ports and keeps IPv6 literals bracketed', () => {
        expect(toMatchPattern('https://box.example/', false)).toBe('https://box.example/*');
        expect(toMatchPattern('http://box.example:80/', false)).toBe('http://box.example/*');
        expect(toMatchPattern('http://[fd00::5]:9091/', false)).toBe('http://[fd00::5]:9091/*');
        expect(toMatchPattern('http://[fd00::5]:9091/', true)).toBe('http://[fd00::5]/*');
    });

    it('never puts a path, query or credentials into the pattern', () => {
        expect(toMatchPattern('http://nas.local:8080/gui/?x=1#y', false)).toBe('http://nas.local:8080/*');
    });

    it('rejects garbage', () => {
        expect(() => toMatchPattern('not a url', false)).toThrow();
    });
});

describe('checkHostPermission / requestHostPermission', () => {
    let permissions: PermissionStub;
    const originalUa = navigator.userAgent;

    beforeEach(() => {
        permissions = stubPermissions();
    });

    afterEach(() => {
        setUserAgent(originalUa);
    });

    it('asks Chrome for the port-qualified origin', async () => {
        setUserAgent(CHROME_UA);
        expect(await checkHostPermission('http://192.168.1.235:19091/')).toBe(false);
        expect(permissions.contains).toHaveBeenLastCalledWith({ origins: ['http://192.168.1.235:19091/*'] });
        expect(await requestHostPermission('http://192.168.1.235:19091/')).toBe(true);
        expect(permissions.request).toHaveBeenLastCalledWith({ origins: ['http://192.168.1.235:19091/*'] });
        expect(await checkHostPermission('http://192.168.1.235:19091/transmission/')).toBe(true);
    });

    it('asks Firefox for the port-less origin, the only form that exempts fetches from CORS there', async () => {
        setUserAgent(FIREFOX_UA);
        expect(await checkHostPermission('http://192.168.1.235:16800/jsonrpc')).toBe(false);
        expect(permissions.contains).toHaveBeenLastCalledWith({ origins: ['http://192.168.1.235/*'] });
        expect(await requestHostPermission('http://192.168.1.235:16800/jsonrpc')).toBe(true);
        expect(permissions.request).toHaveBeenLastCalledWith({ origins: ['http://192.168.1.235/*'] });
        // A grant made by an earlier build with the port in it does not satisfy the check, so the UI offers to grant again.
        permissions.granted.clear();
        permissions.granted.add('http://192.168.1.235:16800/*');
        expect(await checkHostPermission('http://192.168.1.235:16800/jsonrpc')).toBe(false);
    });

    it('reports false instead of throwing for an invalid address', async () => {
        expect(await checkHostPermission('nope://')).toBe(false);
        expect(await requestHostPermission('')).toBe(false);
    });
});
