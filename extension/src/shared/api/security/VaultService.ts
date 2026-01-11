import { storage } from 'wxt/storage';
import { SecurityService } from './SecurityService';
import { KeyManager } from './KeyManager';
import { ServerConfig } from '@/shared/lib/types';

// Export keys for watchers
export const VAULT_SALT_KEY = 'local:vaultSalt';
export const VAULT_DATA_KEY = 'local:vaultData';
export const LEGACY_OPTIONS_KEY = 'local:options';
export const SESSION_KEY_KEY = 'session:encryptionKey';

interface EncryptedData {
    iv: number[]; // stored as array for JSON compatibility
    ciphertext: string; // Base64 or specific encoding
}

export class VaultService {
    static async isInitialized(): Promise<boolean> {
        return (await storage.getItem(VAULT_SALT_KEY)) !== null;
    }

    static async isLocked(): Promise<boolean> {
        const hasKey = await KeyManager.hasSessionKey();
        return !hasKey;
    }

    /**
     * Initializes the vault with a master password.
     * Optionally accepts initial data to encrypt (e.g., during migration).
     */
    static async initialize(password: string, initialData: ServerConfig[] = []): Promise<void> {
        const salt = SecurityService.generateSalt();
        const key = await SecurityService.deriveKey(password, salt);

        // Encrypt the initial data
        const plaintext = JSON.stringify(initialData);
        const { iv, ciphertext } = await SecurityService.encrypt(plaintext, key);

        // Store artifacts
        // We need to convert ArrayBuffers to storable formats (Arrays/Base64) if WXT storage doesn't auto-handle them.
        // Assuming WXT handles JSON-serializable objects.
        // Uint8Array/ArrayBuffer -> Array for simple JSON serialization.
        await storage.setItem(VAULT_SALT_KEY, Array.from(salt));

        // Convert arraybuffer to base64 for reliable storage
        const cipherArray = Array.from(new Uint8Array(ciphertext));

        await storage.setItem(VAULT_DATA_KEY, {
            iv: Array.from(iv),
            ciphertext: cipherArray
        });

        // Set session key
        await KeyManager.setSessionKey(key);
    }

    static async unlock(password: string): Promise<boolean> {
        const saltArray = await storage.getItem<number[]>(VAULT_SALT_KEY);
        if (!saltArray) throw new Error('Vault not initialized');

        const salt = new Uint8Array(saltArray);
        const key = await SecurityService.deriveKey(password, salt);

        // Verify key by attempting to decrypt
        try {
            await this.getServers(key); // Pass key explicitly to test it
            await KeyManager.setSessionKey(key);
            return true;
        } catch (e) {
            return false;
        }
    }

    static async lock(): Promise<void> {
        await KeyManager.clearSessionKey();
    }

    /**
     * Retrives servers.
     * If key is provided, uses it (for unlock verification).
     * Otherwise attempts to get session key.
     */
    static async getServers(overrideKey?: CryptoKey): Promise<ServerConfig[]> {
        const key = overrideKey || await KeyManager.getSessionKey();
        if (!key) throw new Error('Vault is locked');

        const encrypted = await storage.getItem<{ iv: number[], ciphertext: number[] }>(VAULT_DATA_KEY);
        if (!encrypted) return []; // Empty vault OR no data? (Empty vault implies initialized but empty)
        // If uninitialized, storage returns null.

        const iv = new Uint8Array(encrypted.iv);
        const ciphertext = new Uint8Array(encrypted.ciphertext).buffer;

        const plaintext = await SecurityService.decrypt(ciphertext as ArrayBuffer, iv, key);
        return JSON.parse(plaintext);
    }

    static async saveServers(servers: ServerConfig[]): Promise<void> {
        const key = await KeyManager.getSessionKey();
        if (!key) throw new Error('Vault is locked');

        const plaintext = JSON.stringify(servers);
        const { iv, ciphertext } = await SecurityService.encrypt(plaintext, key);

        await storage.setItem(VAULT_DATA_KEY, {
            iv: Array.from(iv),
            ciphertext: Array.from(new Uint8Array(ciphertext))
        });
    }

    /**
     * Checks if there are legacy servers in local:options that need migration.
     */
    static async hasLegacyData(): Promise<boolean> {
        const settings = await storage.getItem<any>(LEGACY_OPTIONS_KEY);
        return settings && settings.servers && settings.servers.length > 0;
    }

    static async migrateLegacyData(password: string): Promise<void> {
        const settings = await storage.getItem<any>(LEGACY_OPTIONS_KEY);
        if (!settings || !settings.servers) return;

        await this.initialize(password, settings.servers);

        // Clear legacy servers to prevent double-read, but keep other settings
        settings.servers = [];
        await storage.setItem(LEGACY_OPTIONS_KEY, settings);
    }
}
