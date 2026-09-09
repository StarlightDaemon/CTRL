import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import { KeyManager } from '@/shared/api/security/KeyManager';
import { SecurityService } from '@/shared/api/security/SecurityService';

/**
 * Regression coverage for the Firefox plaintext-key defect.
 *
 * Earlier builds mirrored the derived AES-GCM vault key into `storage.local`
 * whenever `navigator.userAgent` contained "Firefox". That put the raw key on
 * disk beside `local:vaultData`, the ciphertext it decrypts. These tests assert
 * the key reaches `storage.session` and no persistent area, on both a
 * Chrome-like and a Firefox-like user agent.
 *
 * They run against the real WebCrypto implementation and the real
 * `@webext-core/fake-browser` storage areas rather than mocks, so a
 * reintroduced write would have to actually land somewhere to pass.
 */

const CHROME_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const FIREFOX_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0';

/** Areas that survive a browser restart. The key must never appear in any of them. */
const PERSISTENT_AREAS = ['local', 'sync', 'managed'] as const;

const LEGACY_LOCAL_KEY = 'session_encryptionKey';
const SESSION_KEY = 'encryptionKey';

function setUserAgent(ua: string): void {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function restoreUserAgent(): void {
    delete (window.navigator as unknown as Record<string, unknown>).userAgent;
}

async function dumpArea(area: (typeof PERSISTENT_AREAS)[number] | 'session') {
    return (await fakeBrowser.storage[area].get(null)) as Record<string, unknown>;
}

/** Serialized contents of every persistent area, for substring scanning. */
async function dumpPersistent(): Promise<string> {
    const areas = await Promise.all(PERSISTENT_AREAS.map((a) => dumpArea(a)));
    return JSON.stringify(Object.fromEntries(PERSISTENT_AREAS.map((a, i) => [a, areas[i]])));
}

let vaultKey: CryptoKey;
let secretMaterial: string;

beforeAll(async () => {
    // A real PBKDF2-derived key, matching what VaultService hands to KeyManager.
    const salt = SecurityService.generateSalt();
    vaultKey = await SecurityService.deriveKey('correct horse battery staple', salt);

    // The raw AES key bytes, base64url-encoded. This is the value that must not
    // reach disk; scanning for it catches a copy written under any key name.
    const jwk = await crypto.subtle.exportKey('jwk', vaultKey);
    secretMaterial = jwk.k as string;
    expect(secretMaterial).toBeTruthy();
});

afterEach(() => {
    restoreUserAgent();
});

describe('KeyManager.setSessionKey', () => {
    describe.each([
        ['Chrome-like', CHROME_UA],
        ['Firefox-like', FIREFOX_UA],
    ])('on a %s user agent', (_label, ua) => {
        beforeEach(() => {
            setUserAgent(ua);
        });

        it('writes the key to storage.session', async () => {
            await KeyManager.setSessionKey(vaultKey);

            const session = await dumpArea('session');
            expect(Object.keys(session)).toEqual([SESSION_KEY]);
            expect((session[SESSION_KEY] as JsonWebKey).k).toBe(secretMaterial);
        });

        it('leaves every persistent storage area untouched', async () => {
            await KeyManager.setSessionKey(vaultKey);

            for (const area of PERSISTENT_AREAS) {
                expect(await dumpArea(area)).toEqual({});
            }
        });

        it('never writes the raw key material to a persistent area', async () => {
            await KeyManager.setSessionKey(vaultKey);

            expect(await dumpPersistent()).not.toContain(secretMaterial);
        });

        it('does not write the legacy local fallback key', async () => {
            await KeyManager.setSessionKey(vaultKey);

            const local = await dumpArea('local');
            expect(local).not.toHaveProperty(LEGACY_LOCAL_KEY);
        });

        it('keeps the key out of persistent storage across repeated unlocks', async () => {
            // The old write fired on every unlock, not just the first.
            await KeyManager.setSessionKey(vaultKey);
            await KeyManager.clearSessionKey();
            await KeyManager.setSessionKey(vaultKey);
            await KeyManager.setSessionKey(vaultKey);

            expect(await dumpPersistent()).not.toContain(secretMaterial);
        });
    });

    it('behaves identically regardless of user agent', async () => {
        setUserAgent(CHROME_UA);
        await KeyManager.setSessionKey(vaultKey);
        const chromeSession = await dumpArea('session');
        const chromeLocal = await dumpArea('local');

        fakeBrowser.reset();

        setUserAgent(FIREFOX_UA);
        await KeyManager.setSessionKey(vaultKey);

        expect(await dumpArea('session')).toEqual(chromeSession);
        expect(await dumpArea('local')).toEqual(chromeLocal);
    });
});

describe('KeyManager read path', () => {
    it('round-trips a key that decrypts data encrypted by the original', async () => {
        setUserAgent(FIREFOX_UA);
        await KeyManager.setSessionKey(vaultKey);

        const { iv, ciphertext } = await SecurityService.encrypt('{"servers":[]}', vaultKey);

        const restored = await KeyManager.getSessionKey();
        expect(restored).not.toBeNull();
        await expect(SecurityService.decrypt(ciphertext, iv, restored!)).resolves.toBe('{"servers":[]}');
    });

    it('reads from storage.session only, and reports locked when it is empty', async () => {
        setUserAgent(FIREFOX_UA);

        expect(await KeyManager.getSessionKey()).toBeNull();
        expect(await KeyManager.hasSessionKey()).toBe(false);
    });

    it('ignores a legacy plaintext key left in storage.local by an older build', async () => {
        // An upgraded Firefox profile still carries this until the purge runs.
        const legacyJwk = await crypto.subtle.exportKey('jwk', vaultKey);
        await fakeBrowser.storage.local.set({ [LEGACY_LOCAL_KEY]: legacyJwk });

        setUserAgent(FIREFOX_UA);

        // The vault must present as locked, not silently unlock from disk.
        expect(await KeyManager.getSessionKey()).toBeNull();
        expect(await KeyManager.hasSessionKey()).toBe(false);
    });

    it('clearSessionKey removes the session entry', async () => {
        setUserAgent(FIREFOX_UA);
        await KeyManager.setSessionKey(vaultKey);
        expect(await KeyManager.hasSessionKey()).toBe(true);

        await KeyManager.clearSessionKey();

        expect(await KeyManager.hasSessionKey()).toBe(false);
        expect(await KeyManager.getSessionKey()).toBeNull();
        expect(await dumpArea('session')).toEqual({});
    });
});

describe('KeyManager.purgeLegacyFallbackKey', () => {
    it('removes a plaintext key left by an older Firefox build', async () => {
        const legacyJwk = await crypto.subtle.exportKey('jwk', vaultKey);
        await fakeBrowser.storage.local.set({ [LEGACY_LOCAL_KEY]: legacyJwk });
        expect(await dumpPersistent()).toContain(secretMaterial);

        await KeyManager.purgeLegacyFallbackKey();

        expect(await dumpArea('local')).not.toHaveProperty(LEGACY_LOCAL_KEY);
        expect(await dumpPersistent()).not.toContain(secretMaterial);
    });

    it('runs on Chrome too, since a profile may have been carried across browsers', async () => {
        setUserAgent(CHROME_UA);
        const legacyJwk = await crypto.subtle.exportKey('jwk', vaultKey);
        await fakeBrowser.storage.local.set({ [LEGACY_LOCAL_KEY]: legacyJwk });

        await KeyManager.purgeLegacyFallbackKey();

        expect(await dumpArea('local')).not.toHaveProperty(LEGACY_LOCAL_KEY);
    });

    it('is a no-op when no legacy key is present', async () => {
        await fakeBrowser.storage.local.set({ vaultSalt: [1, 2, 3] });

        await expect(KeyManager.purgeLegacyFallbackKey()).resolves.toBeUndefined();

        expect(await dumpArea('local')).toEqual({ vaultSalt: [1, 2, 3] });
    });
});
