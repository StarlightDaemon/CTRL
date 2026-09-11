import { describe, it, expect } from 'vitest';
import {
    CLIENT_LIST,
    PUBLIC_CLIENT_LIST,
    DEFAULT_CLIENT_ID,
    getClientCapability,
    isPublicClient,
} from '@/shared/lib/constants';
import { ClientFactory } from '@/entities/client/lib/ClientFactory';

describe('v1 client catalog', () => {
    it('offers exactly the v1 candidate clients for new configurations', () => {
        expect(PUBLIC_CLIENT_LIST.map((c) => c.id)).toEqual(['transmission', 'qbittorrent', 'aria2']);
        expect(DEFAULT_CLIENT_ID).toBe('transmission');
        PUBLIC_CLIENT_LIST.forEach((c) => expect(c.v1Status).toBe('candidate'));
    });

    it('keeps the experimental adapters in the catalog but hidden', () => {
        const hidden = CLIENT_LIST.filter((c) => c.v1Status === 'experimental').map((c) => c.id).sort();
        expect(hidden).toEqual(['biglybt', 'deluge', 'flood', 'rutorrent', 'utorrent', 'vuze_remoteui']);
        hidden.forEach((id) => {
            expect(isPublicClient(id)).toBe(false);
            expect(getClientCapability(id)?.name).toBeTruthy();
        });
        expect(isPublicClient(undefined)).toBe(false);
        expect(isPublicClient('nonexistent')).toBe(false);
    });

    it('still instantiates an existing configuration of a hidden client', async () => {
        const factory = new ClientFactory();
        const client = await factory.create({
            id: 'legacy-deluge',
            name: 'Old Deluge box',
            application: 'deluge',
            type: 'deluge',
            hostname: 'http://192.168.1.50:8112/',
            directories: [],
            clientOptions: {},
        });
        expect(client).toBeDefined();
        expect(typeof client.getTorrents).toBe('function');
    });

    it('every catalogued client id resolves in ClientFactory', async () => {
        const factory = new ClientFactory();
        for (const c of CLIENT_LIST) {
            const client = await factory.create({
                id: `test-${c.id}`,
                name: c.name,
                application: c.id,
                type: c.id,
                hostname: c.addressPlaceholder,
                directories: [],
                clientOptions: {},
            });
            expect(client).toBeDefined();
        }
    });
});
