import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from '@webext-core/fake-browser';
import {
    VaultService,
    VaultCorruptedError,
    VaultConflictError,
    VaultLockedError,
    VAULT_FORMAT_VERSION,
} from '@/shared/api/security/VaultService';
import { SecurityService } from '@/shared/api/security/SecurityService';
import { KeyManager } from '@/shared/api/security/KeyManager';
import type { ServerConfig } from '@/shared/lib/types';

const PASSWORD = 'correct horse battery staple';

const server = (name: string): ServerConfig => ({
    name,
    application: 'transmission',
    type: 'transmission',
    hostname: `http://${name}.example/`,
    username: 'u',
    password: 'p',
    directories: [],
    clientOptions: {},
});

const local = () => fakeBrowser.storage.local.get(null) as Promise<Record<string, unknown>>;

/** Writes the pre-v1 two-key layout the way old builds did. */
async function writeLegacy(password: string, servers: ServerConfig[]) {
    const salt = SecurityService.generateSalt();
    const key = await SecurityService.deriveKey(password, salt);
    const { iv, ciphertext } = await SecurityService.encrypt(JSON.stringify(servers), key);
    await fakeBrowser.storage.local.set({
        vaultSalt: Array.from(salt),
        vaultData: { iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) },
    });
}

describe('VaultService state machine', () => {
    beforeEach(() => {
        fakeBrowser.reset();
    });

    it('starts uninitialized', async () => {
        expect(await VaultService.getState()).toBe('uninitialized');
        expect(await VaultService.isInitialized()).toBe(false);
    });

    it('initialize writes one authenticated envelope and unlocks', async () => {
        await VaultService.initialize(PASSWORD, [server('a')]);
        const stored = await local();
        expect(Object.keys(stored)).toEqual(['vault']);
        expect(stored.vault).toMatchObject({ version: VAULT_FORMAT_VERSION, revision: 1 });
        expect(await VaultService.getState()).toBe('unlocked');
        const servers = await VaultService.getServers();
        expect(servers).toHaveLength(1);
        expect(servers[0].name).toBe('a');
        expect(servers[0].id).toBeTruthy();
    });

    it('lock removes the session key and unlock with the right password restores access', async () => {
        await VaultService.initialize(PASSWORD, [server('a')]);
        await VaultService.lock();
        expect(await VaultService.getState()).toBe('locked');
        await expect(VaultService.getServers()).rejects.toBeInstanceOf(VaultLockedError);
        expect(await VaultService.unlock(PASSWORD)).toBe(true);
        expect(await VaultService.getState()).toBe('unlocked');
        expect((await VaultService.getServers())[0].name).toBe('a');
    });

    it('a wrong password never unlocks and leaves the vault locked', async () => {
        await VaultService.initialize(PASSWORD, [server('a')]);
        await VaultService.lock();
        expect(await VaultService.unlock('wrong password 123')).toBe(false);
        expect(await VaultService.getState()).toBe('locked');
        expect(await KeyManager.hasSessionKey()).toBe(false);
    });

    it('a wrong password fails even when the vault holds an empty server list', async () => {
        await VaultService.initialize(PASSWORD, []);
        await VaultService.lock();
        expect(await VaultService.unlock('nope nope nope')).toBe(false);
    });

    describe('fails closed on incomplete or malformed material', () => {
        it('legacy salt without ciphertext is corrupted, not an empty vault', async () => {
            await fakeBrowser.storage.local.set({ vaultSalt: Array.from(SecurityService.generateSalt()) });
            expect(await VaultService.getState()).toBe('corrupted');
            await expect(VaultService.unlock('anything at all')).rejects.toBeInstanceOf(VaultCorruptedError);
            expect(await KeyManager.hasSessionKey()).toBe(false);
        });

        it('legacy ciphertext without salt is corrupted', async () => {
            await fakeBrowser.storage.local.set({ vaultData: { iv: new Array(12).fill(1), ciphertext: [1, 2, 3] } });
            expect(await VaultService.getState()).toBe('corrupted');
            await expect(VaultService.unlock(PASSWORD)).rejects.toBeInstanceOf(VaultCorruptedError);
        });

        it.each([
            ['missing ciphertext', { version: 2, salt: new Array(16).fill(1), iv: new Array(12).fill(1), revision: 1 }],
            ['wrong version', { version: 1, salt: new Array(16).fill(1), iv: new Array(12).fill(1), ciphertext: [1], revision: 1 }],
            ['short salt', { version: 2, salt: [1, 2], iv: new Array(12).fill(1), ciphertext: [1], revision: 1 }],
            ['non-byte values', { version: 2, salt: new Array(16).fill(999), iv: new Array(12).fill(1), ciphertext: [1], revision: 1 }],
            ['not an object', 'garbage'],
        ])('envelope with %s is corrupted', async (_label, envelope) => {
            await fakeBrowser.storage.local.set({ vault: envelope });
            expect(await VaultService.getState()).toBe('corrupted');
            await expect(VaultService.unlock(PASSWORD)).rejects.toBeInstanceOf(VaultCorruptedError);
            await expect(VaultService.saveServers([])).rejects.toBeInstanceOf(VaultLockedError);
        });

        it('truncated ciphertext does not unlock', async () => {
            await VaultService.initialize(PASSWORD, [server('a')]);
            await VaultService.lock();
            const stored = await local();
            const vault = stored.vault as { ciphertext: number[] };
            await fakeBrowser.storage.local.set({ vault: { ...vault, ciphertext: vault.ciphertext.slice(0, 8) } });
            // Structurally valid, cryptographically broken: reported as a bad password, never success.
            expect(await VaultService.unlock(PASSWORD)).toBe(false);
            expect(await VaultService.getState()).toBe('locked');
        });

        it('plaintext that is not a server list is rejected', async () => {
            const salt = SecurityService.generateSalt();
            const key = await SecurityService.deriveKey(PASSWORD, salt);
            const { iv, ciphertext } = await SecurityService.encrypt('{"not":"a list"}', key);
            await fakeBrowser.storage.local.set({
                vault: { version: 2, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: 300000 }, salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)), revision: 1, updatedAt: 0 },
            });
            await expect(VaultService.unlock(PASSWORD)).rejects.toBeInstanceOf(VaultCorruptedError);
        });
    });

    describe('legacy migration', () => {
        it('reads the pre-v1 two-key layout and rewrites it as an envelope on first unlock', async () => {
            await writeLegacy(PASSWORD, [server('legacy')]);
            expect(await VaultService.getState()).toBe('locked');
            expect(await VaultService.unlock(PASSWORD)).toBe(true);
            const stored = await local();
            expect(stored.vaultSalt).toBeUndefined();
            expect(stored.vaultData).toBeUndefined();
            expect(stored.vault).toMatchObject({ version: VAULT_FORMAT_VERSION });
            const servers = await VaultService.getServers();
            expect(servers[0].name).toBe('legacy');
            expect(servers[0].id).toMatch(/^legacy-/);
        });

        it('a wrong password against legacy data neither unlocks nor migrates', async () => {
            await writeLegacy(PASSWORD, [server('legacy')]);
            expect(await VaultService.unlock('wrong wrong wrong')).toBe(false);
            const stored = await local();
            expect(stored.vaultSalt).toBeDefined();
            expect(stored.vault).toBeUndefined();
        });

        it('legacy migration preserves the data byte for byte', async () => {
            const original = [server('one'), { ...server('two'), clientOptions: { simpleApiKey: 'k' } }];
            await writeLegacy(PASSWORD, original);
            await VaultService.unlock(PASSWORD);
            const servers = await VaultService.getServers();
            expect(servers.map(({ id: _id, ...rest }) => rest)).toEqual(original);
        });
    });

    describe('revision-aware writes', () => {
        it('rejects a write based on a stale revision', async () => {
            await VaultService.initialize(PASSWORD, [server('a')]);
            const first = await VaultService.getServersWithRevision();
            expect(first.revision).toBe(1);

            // Another window saves first.
            const next = await VaultService.saveServers([server('a'), server('b')], first.revision);
            expect(next).toBe(2);

            // This window still holds revision 1 and tries to overwrite.
            await expect(VaultService.saveServers([server('stale')], first.revision)).rejects.toBeInstanceOf(VaultConflictError);
            const servers = await VaultService.getServers();
            expect(servers.map((s) => s.name)).toEqual(['a', 'b']);
        });

        it('accepts a write without an expected revision (explicit last-writer-wins)', async () => {
            await VaultService.initialize(PASSWORD, [server('a')]);
            await VaultService.saveServers([server('b')]);
            expect((await VaultService.getServers()).map((s) => s.name)).toEqual(['b']);
            expect(await VaultService.getRevision()).toBe(2);
        });

        it('keeps the salt stable across saves so the session key remains valid', async () => {
            await VaultService.initialize(PASSWORD, [server('a')]);
            const before = ((await local()).vault as { salt: number[] }).salt;
            await VaultService.saveServers([server('b')]);
            const after = ((await local()).vault as { salt: number[] }).salt;
            expect(after).toEqual(before);
            await VaultService.lock();
            expect(await VaultService.unlock(PASSWORD)).toBe(true);
        });
    });

    it('reset destroys the vault and the session key', async () => {
        await VaultService.initialize(PASSWORD, [server('a')]);
        await VaultService.reset();
        expect(await VaultService.getState()).toBe('uninitialized');
        expect(await KeyManager.hasSessionKey()).toBe(false);
        expect(await local()).toEqual({});
    });
});
