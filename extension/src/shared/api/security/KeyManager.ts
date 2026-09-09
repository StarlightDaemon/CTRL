import { storage } from 'wxt/utils/storage';

const KEY_STORAGE_KEY = 'session:encryptionKey';

/**
 * Legacy Firefox fallback location.
 *
 * Older builds mirrored the derived AES-GCM vault key here, in plaintext JWK
 * form, so it would survive event-page suspension. That placed the raw key on
 * disk in `storage.local` — the same area that holds `local:vaultData`, the
 * ciphertext it decrypts — so read access to the profile directory yielded
 * every stored credential without the master password, bypassing PBKDF2
 * entirely.
 *
 * Nothing writes or reads this key any more. The constant survives solely so
 * existing installs can be scrubbed; see {@link KeyManager.purgeLegacyFallbackKey}.
 */
const LEGACY_FALLBACK_STORAGE_KEY = 'local:session_encryptionKey';

export class KeyManager {
    /**
     * Reads the session key from `storage.session` only.
     *
     * `storage.session` is in-memory and scoped to the browser session, not to
     * the lifetime of the background context, so this survives event-page and
     * service-worker suspension on every supported browser. If it is absent the
     * vault is locked and the user must re-enter the master password.
     */
    static async getSessionKey(): Promise<CryptoKey | null> {
        const rawKey = await storage.getItem<JsonWebKey>(KEY_STORAGE_KEY);

        if (!rawKey) return null;

        return await crypto.subtle.importKey(
            'jwk',
            rawKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Persists the session key to `storage.session` and nowhere else.
     *
     * The key must never reach a disk-backed area. There is no secure way for
     * an extension to persist it: any wrapping key would need the same
     * storage, which only moves the exposure rather than removing it.
     */
    static async setSessionKey(key: CryptoKey): Promise<void> {
        // Export to JWK to store in storage
        const rawKey = await crypto.subtle.exportKey('jwk', key);
        await storage.setItem(KEY_STORAGE_KEY, rawKey);
    }

    static async clearSessionKey(): Promise<void> {
        await storage.removeItem(KEY_STORAGE_KEY);
    }

    static async hasSessionKey(): Promise<boolean> {
        return (await storage.getItem(KEY_STORAGE_KEY)) !== null;
    }

    /**
     * Removes the plaintext key left in `storage.local` by earlier Firefox
     * builds. Runs on every browser, since a profile may have been carried
     * across browsers, and is safe when the key was never present.
     */
    static async purgeLegacyFallbackKey(): Promise<void> {
        await storage.removeItem(LEGACY_FALLBACK_STORAGE_KEY);
    }
}
