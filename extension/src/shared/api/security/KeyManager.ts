import { storage } from 'wxt/utils/storage';
import { SecurityService } from './SecurityService';

const KEY_STORAGE_KEY = 'session:encryptionKey';
const FALLBACK_STORAGE_KEY = 'local:session_encryptionKey';

export class KeyManager {
    static async getSessionKey(): Promise<CryptoKey | null> {
        // Retrieve raw JSON-web-key (JWK) from session storage
        let rawKey = await storage.getItem<JsonWebKey>(KEY_STORAGE_KEY);

        // Firefox Fallback: If session storage is empty, check local fallback
        if (!rawKey && navigator.userAgent.includes('Firefox')) {
            rawKey = await storage.getItem<JsonWebKey>(FALLBACK_STORAGE_KEY);
        }

        if (!rawKey) return null;

        return await crypto.subtle.importKey(
            'jwk',
            rawKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt']
        );
    }

    static async setSessionKey(key: CryptoKey): Promise<void> {
        // Export to JWK to store in storage
        const rawKey = await crypto.subtle.exportKey('jwk', key);
        await storage.setItem(KEY_STORAGE_KEY, rawKey);

        // Firefox Fallback: Also persist to local (survives worker wake/restart)
        if (navigator.userAgent.includes('Firefox')) {
            await storage.setItem(FALLBACK_STORAGE_KEY, rawKey);
        }
    }

    static async clearSessionKey(): Promise<void> {
        await storage.removeItem(KEY_STORAGE_KEY);
        if (navigator.userAgent.includes('Firefox')) {
            await storage.removeItem(FALLBACK_STORAGE_KEY);
        }
    }

    static async hasSessionKey(): Promise<boolean> {
        const hasSession = (await storage.getItem(KEY_STORAGE_KEY)) !== null;
        if (hasSession) return true;

        if (navigator.userAgent.includes('Firefox')) {
            return (await storage.getItem(FALLBACK_STORAGE_KEY)) !== null;
        }

        return false;
    }
}
