import { storage } from 'wxt/utils/storage';
import { SecurityService } from './SecurityService';
import { KeyManager } from './KeyManager';
import { ServerConfig } from '@/shared/lib/types';
import { ensureServerIds } from '@/entities/server/lib/serverIdentity';

/**
 * Storage layout
 * --------------
 * `local:vault` holds one authenticated envelope (`VaultEnvelope`). Salt, IV
 * and ciphertext are written together in a single storage call, so an
 * interrupted write can never leave a salt without its ciphertext.
 *
 * Builds before v1 wrote `local:vaultSalt` and `local:vaultData` separately.
 * Those keys are read only to migrate: the first successful unlock rewrites
 * the data as an envelope and removes the legacy keys. A legacy salt without
 * its data (or vice versa) is reported as `corrupted` and never unlocks.
 *
 * The session key lives in `session:encryptionKey` (see KeyManager) and is
 * the only thing that distinguishes `locked` from `unlocked`.
 */
export const VAULT_KEY = 'local:vault';
export const LEGACY_VAULT_SALT_KEY = 'local:vaultSalt';
export const LEGACY_VAULT_DATA_KEY = 'local:vaultData';
export const LEGACY_OPTIONS_KEY = 'local:options';
export const SESSION_KEY_KEY = 'session:encryptionKey';

/** Watch these to observe vault changes from any context. */
export const VAULT_DATA_KEY = VAULT_KEY;
export const VAULT_SALT_KEY = LEGACY_VAULT_SALT_KEY;

export const VAULT_FORMAT_VERSION = 2;

export type VaultState = 'uninitialized' | 'locked' | 'unlocked' | 'corrupted';

export interface VaultEnvelope {
    version: number;
    kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number };
    salt: number[];
    iv: number[];
    ciphertext: number[];
    /** Monotonic counter incremented on every successful write. */
    revision: number;
    updatedAt: number;
}

interface LegacyVaultData {
    iv: number[];
    ciphertext: number[];
}

export class VaultCorruptedError extends Error {
    constructor(message = 'The stored vault data is incomplete or damaged.') {
        super(message);
        this.name = 'VaultCorruptedError';
    }
}

export class VaultLockedError extends Error {
    constructor() {
        super('Vault is locked');
        this.name = 'VaultLockedError';
    }
}

export class VaultConflictError extends Error {
    constructor(public readonly currentRevision: number) {
        super('The vault was changed elsewhere. Reload and try again.');
        this.name = 'VaultConflictError';
    }
}

function isByteArray(value: unknown, minLength = 1): value is number[] {
    return Array.isArray(value) && value.length >= minLength && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}

function isEnvelope(value: unknown): value is VaultEnvelope {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return (
        v.version === VAULT_FORMAT_VERSION &&
        isByteArray(v.salt, 16) &&
        isByteArray(v.iv, 12) &&
        isByteArray(v.ciphertext, 1) &&
        typeof v.revision === 'number'
    );
}

function isLegacyData(value: unknown): value is LegacyVaultData {
    if (!value || typeof value !== 'object') return false;
    const v = value as Record<string, unknown>;
    return isByteArray(v.iv, 12) && isByteArray(v.ciphertext, 1);
}

function parseServers(plaintext: string): ServerConfig[] {
    let parsed: unknown;
    try {
        parsed = JSON.parse(plaintext);
    } catch {
        throw new VaultCorruptedError('The vault decrypted to unreadable data.');
    }
    if (!Array.isArray(parsed)) {
        throw new VaultCorruptedError('The vault decrypted to an unexpected shape.');
    }
    return ensureServerIds(parsed as ServerConfig[]);
}

interface Loaded {
    kind: 'envelope';
    envelope: VaultEnvelope;
}
interface LoadedLegacy {
    kind: 'legacy';
    salt: number[];
    data: LegacyVaultData;
}

export class VaultService {
    /**
     * Reads the stored material and classifies it. Never throws.
     */
    private static async load(): Promise<Loaded | LoadedLegacy | { kind: 'none' } | { kind: 'corrupted' }> {
        const envelope = await storage.getItem<unknown>(VAULT_KEY);
        if (envelope !== null && envelope !== undefined) {
            return isEnvelope(envelope) ? { kind: 'envelope', envelope } : { kind: 'corrupted' };
        }

        const [salt, data] = await Promise.all([
            storage.getItem<unknown>(LEGACY_VAULT_SALT_KEY),
            storage.getItem<unknown>(LEGACY_VAULT_DATA_KEY),
        ]);
        const hasSalt = salt !== null && salt !== undefined;
        const hasData = data !== null && data !== undefined;
        if (!hasSalt && !hasData) return { kind: 'none' };
        if (hasSalt && hasData && isByteArray(salt, 16) && isLegacyData(data)) {
            return { kind: 'legacy', salt, data };
        }
        return { kind: 'corrupted' };
    }

    static async getState(): Promise<VaultState> {
        const loaded = await this.load();
        if (loaded.kind === 'none') return 'uninitialized';
        if (loaded.kind === 'corrupted') return 'corrupted';
        return (await KeyManager.hasSessionKey()) ? 'unlocked' : 'locked';
    }

    static async isInitialized(): Promise<boolean> {
        const state = await this.getState();
        return state !== 'uninitialized';
    }

    static async isLocked(): Promise<boolean> {
        return (await this.getState()) !== 'unlocked';
    }

    /**
     * Initializes the vault with a master password.
     * Optionally accepts initial data to encrypt (e.g., during migration).
     */
    static async initialize(password: string, initialData: ServerConfig[] = []): Promise<void> {
        const salt = SecurityService.generateSalt();
        const key = await SecurityService.deriveKey(password, salt);
        await this.writeEnvelope(key, salt, ensureServerIds(initialData), 1);
        await storage.removeItems([LEGACY_VAULT_SALT_KEY, LEGACY_VAULT_DATA_KEY]);
        await KeyManager.setSessionKey(key);
    }

    /**
     * Verifies the password against the stored ciphertext. Returns false for a
     * wrong password. Throws VaultCorruptedError when the stored material is
     * incomplete or malformed; it never "succeeds" on partial data.
     */
    static async unlock(password: string): Promise<boolean> {
        const loaded = await this.load();
        if (loaded.kind === 'none') throw new Error('Vault not initialized');
        if (loaded.kind === 'corrupted') throw new VaultCorruptedError();

        const saltArray = loaded.kind === 'envelope' ? loaded.envelope.salt : loaded.salt;
        const ivArray = loaded.kind === 'envelope' ? loaded.envelope.iv : loaded.data.iv;
        const cipherArray = loaded.kind === 'envelope' ? loaded.envelope.ciphertext : loaded.data.ciphertext;

        const salt = new Uint8Array(saltArray);
        const key = await SecurityService.deriveKey(password, salt);

        let plaintext: string;
        try {
            plaintext = await SecurityService.decrypt(new Uint8Array(cipherArray).buffer as ArrayBuffer, new Uint8Array(ivArray), key);
        } catch {
            return false; // wrong password (or tampered ciphertext): fail closed
        }

        const servers = parseServers(plaintext); // throws VaultCorruptedError on bad shape

        if (loaded.kind === 'legacy') {
            // Migrate to the authenticated envelope now that the key is known.
            await this.writeEnvelope(key, salt, servers, 1);
            await storage.removeItems([LEGACY_VAULT_SALT_KEY, LEGACY_VAULT_DATA_KEY]);
        }

        await KeyManager.setSessionKey(key);
        return true;
    }

    static async lock(): Promise<void> {
        await KeyManager.clearSessionKey();
    }

    /**
     * Destroys the stored vault and session key. Used to recover from a
     * corrupted vault. Callers must confirm with the user first.
     */
    static async reset(): Promise<void> {
        await KeyManager.clearSessionKey();
        await storage.removeItems([VAULT_KEY, LEGACY_VAULT_SALT_KEY, LEGACY_VAULT_DATA_KEY]);
    }

    /**
     * Returns the current revision, or 0 when the vault holds no envelope yet.
     */
    static async getRevision(): Promise<number> {
        const loaded = await this.load();
        return loaded.kind === 'envelope' ? loaded.envelope.revision : 0;
    }

    /**
     * Decrypts and returns the servers together with the revision they were
     * read at. Pass the revision back to `saveServers` to detect concurrent
     * writes from another window.
     */
    static async getServersWithRevision(overrideKey?: CryptoKey): Promise<{ servers: ServerConfig[]; revision: number }> {
        const key = overrideKey || await KeyManager.getSessionKey();
        if (!key) throw new VaultLockedError();

        const loaded = await this.load();
        if (loaded.kind === 'none') return { servers: [], revision: 0 };
        if (loaded.kind === 'corrupted') throw new VaultCorruptedError();

        const ivArray = loaded.kind === 'envelope' ? loaded.envelope.iv : loaded.data.iv;
        const cipherArray = loaded.kind === 'envelope' ? loaded.envelope.ciphertext : loaded.data.ciphertext;
        const revision = loaded.kind === 'envelope' ? loaded.envelope.revision : 0;

        const plaintext = await SecurityService.decrypt(new Uint8Array(cipherArray).buffer as ArrayBuffer, new Uint8Array(ivArray), key);
        return { servers: parseServers(plaintext), revision };
    }

    static async getServers(overrideKey?: CryptoKey): Promise<ServerConfig[]> {
        return (await this.getServersWithRevision(overrideKey)).servers;
    }

    /**
     * Encrypts and stores the server list.
     *
     * @param expectedRevision When provided, the write is refused with
     *   VaultConflictError if the stored revision differs, so a window holding
     *   a stale snapshot cannot silently overwrite a newer one.
     */
    static async saveServers(servers: ServerConfig[], expectedRevision?: number): Promise<number> {
        const key = await KeyManager.getSessionKey();
        if (!key) throw new VaultLockedError();

        const loaded = await this.load();
        if (loaded.kind === 'corrupted') throw new VaultCorruptedError();

        const currentRevision = loaded.kind === 'envelope' ? loaded.envelope.revision : 0;
        if (expectedRevision !== undefined && expectedRevision !== currentRevision) {
            throw new VaultConflictError(currentRevision);
        }

        const saltArray = loaded.kind === 'envelope' ? loaded.envelope.salt
            : loaded.kind === 'legacy' ? loaded.salt
                : null;
        if (!saltArray) {
            // No vault material at all: nothing to attach this data to.
            throw new Error('Vault not initialized');
        }

        const nextRevision = currentRevision + 1;
        await this.writeEnvelope(key, new Uint8Array(saltArray), ensureServerIds(servers), nextRevision);
        if (loaded.kind === 'legacy') {
            await storage.removeItems([LEGACY_VAULT_SALT_KEY, LEGACY_VAULT_DATA_KEY]);
        }
        return nextRevision;
    }

    private static async writeEnvelope(key: CryptoKey, salt: Uint8Array, servers: ServerConfig[], revision: number): Promise<void> {
        const { iv, ciphertext } = await SecurityService.encrypt(JSON.stringify(servers), key);
        const envelope: VaultEnvelope = {
            version: VAULT_FORMAT_VERSION,
            kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: SecurityService.ITERATIONS },
            salt: Array.from(salt),
            iv: Array.from(iv),
            ciphertext: Array.from(new Uint8Array(ciphertext)),
            revision,
            updatedAt: Date.now(),
        };
        await storage.setItem(VAULT_KEY, envelope);
    }

    /**
     * Checks if there are legacy servers in local:options that need migration.
     */
    static async hasLegacyData(): Promise<boolean> {
        const settings = await storage.getItem<{ servers?: ServerConfig[] }>(LEGACY_OPTIONS_KEY);
        return !!(settings && settings.servers && settings.servers.length > 0);
    }

    static async migrateLegacyData(password: string): Promise<void> {
        const settings = await storage.getItem<{ servers?: ServerConfig[] } & Record<string, unknown>>(LEGACY_OPTIONS_KEY);
        if (!settings || !settings.servers) return;

        await this.initialize(password, settings.servers);

        // Clear legacy servers to prevent double-read, but keep other settings
        settings.servers = [];
        await storage.setItem(LEGACY_OPTIONS_KEY, settings);
    }
}
