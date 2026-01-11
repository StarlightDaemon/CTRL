import { storage } from 'wxt/storage';
import { SecurityService } from './SecurityService';

const KEY_STORAGE_KEY = 'session:encryptionKey';

export class KeyManager {
    static async getSessionKey(): Promise<CryptoKey | null> {
        // Retrieve raw JSON-web-key (JWK) from session storage
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
}
