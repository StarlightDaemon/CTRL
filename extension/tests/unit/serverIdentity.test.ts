import { describe, it, expect } from 'vitest';
import { ensureServerIds, legacyServerId, newServerId, serverFingerprint } from '@/entities/server/lib/serverIdentity';
import type { ServerConfig } from '@/shared/lib/types';

const base = (overrides: Partial<ServerConfig> = {}): ServerConfig => ({
    name: 'Home',
    application: 'transmission',
    type: 'transmission',
    hostname: 'http://192.168.1.10:9091/',
    directories: [],
    clientOptions: {},
    ...overrides,
});

describe('serverIdentity', () => {
    it('assigns deterministic ids to legacy entries so every context agrees', () => {
        const a = ensureServerIds([base(), base({ name: 'Seedbox', hostname: 'https://box.example/' })]);
        const b = ensureServerIds([base(), base({ name: 'Seedbox', hostname: 'https://box.example/' })]);
        expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
        expect(a[0].id).toMatch(/^legacy-[0-9a-f]{8}$/);
        expect(a[0].id).not.toBe(a[1].id);
    });

    it('preserves existing ids untouched', () => {
        const servers = ensureServerIds([base({ id: 'keep-me' }), base()]);
        expect(servers[0].id).toBe('keep-me');
        expect(servers[0]).toBe(servers[0]); // same object when no change needed
    });

    it('disambiguates duplicate ids by position', () => {
        const servers = ensureServerIds([base({ id: 'dup' }), base({ id: 'dup' })]);
        expect(servers[0].id).toBe('dup');
        expect(servers[1].id).toBe('dup-1');
    });

    it('treats blank ids as missing', () => {
        const servers = ensureServerIds([base({ id: '   ' })]);
        expect(servers[0].id).toBe(legacyServerId(base({ id: '   ' }), 0));
    });

    it('generates unique random ids for new servers', () => {
        const ids = new Set(Array.from({ length: 50 }, () => newServerId()));
        expect(ids.size).toBe(50);
    });

    it('changes the fingerprint when credentials or endpoint change', () => {
        const original = serverFingerprint(base({ id: 'x', password: 'a' }));
        expect(serverFingerprint(base({ id: 'x', password: 'b' }))).not.toBe(original);
        expect(serverFingerprint(base({ id: 'x', password: 'a', hostname: 'http://other/' }))).not.toBe(original);
        expect(serverFingerprint(base({ id: 'x', password: 'a', name: 'renamed' }))).toBe(original);
    });
});
