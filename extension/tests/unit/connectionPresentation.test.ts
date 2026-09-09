import { describe, it, expect } from 'vitest';
import { describeConnection } from '@/features/torrent-control/ui/ConnectionBanner';
import { initialConnectionState, type ConnectionState, type ConnectionStatus } from '@/shared/api/messaging/protocol';

const state = (patch: Partial<ConnectionState>): ConnectionState => ({ ...initialConnectionState(), serverName: 'Box', ...patch });

describe('describeConnection', () => {
    it('has a distinct, truthful presentation for every canonical status', () => {
        const statuses: ConnectionStatus[] = [
            'uninitialized', 'locked', 'vault_corrupted', 'no_servers', 'invalid_config',
            'permission_missing', 'connecting', 'connected', 'stale', 'unavailable', 'auth_failed',
        ];
        const titles = new Set<string>();
        for (const status of statuses) {
            const p = describeConnection(state({ status }));
            expect(p.title, status).toBeTruthy();
            expect(p.detail, status).toBeTruthy();
            titles.add(p.title);
        }
        expect(titles.size).toBe(statuses.length);
    });

    it('distinguishes access that was revoked from access never granted', () => {
        const never = describeConnection(state({ status: 'permission_missing', lastErrorType: 'PERMISSION_MISSING' }));
        expect(never.title).toBe('Access not granted');
        expect(never.detail).toContain('Grant access in Settings → Servers');

        const revoked = describeConnection(state({ status: 'permission_missing', lastErrorType: 'PERMISSION_REVOKED' }));
        expect(revoked.title).toBe('Access revoked');
        expect(revoked.detail).toBe('Access to Box was removed in the browser. Grant it again to reconnect.');
        expect(revoked.kind).toBe('warning');
    });

    it('carries the adapter error text for failures', () => {
        expect(describeConnection(state({ status: 'auth_failed', lastError: 'Box rejected the password.' })).detail).toBe('Box rejected the password.');
        expect(describeConnection(state({ status: 'unavailable', lastError: null })).detail).toBe('Box cannot be reached.');
        expect(describeConnection(state({ status: 'stale', lastError: 'timed out' })).detail).toBe('Showing the last data received from Box. timed out');
    });
});
