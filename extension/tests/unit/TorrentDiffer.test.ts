import { describe, it, expect } from 'vitest';
import {
    computeTorrentDiff,
    applyTorrentPatches,
    estimateSavings,
    JsonPatchOperation
} from '@/shared/lib/diff/TorrentDiffer';
import { Torrent } from '@/entities/torrent/model/Torrent';

// Helper to create test torrents
const createTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
    id: 'hash123',
    name: 'Test Torrent',
    status: 'downloading',
    progress: 50,
    size: 1000000,
    downloadSpeed: 1000,
    uploadSpeed: 500,
    eta: 3600,
    savePath: '/downloads',
    addedDate: Date.now(),
    ...overrides
});

describe('TorrentDiffer', () => {
    describe('computeTorrentDiff', () => {
        it('should return empty patches when no changes', () => {
            const torrents = [createTorrent()];
            const result = computeTorrentDiff(torrents, torrents);

            expect(result.hasChanges).toBe(false);
            expect(result.patches).toHaveLength(0);
        });

        it('should detect progress changes', () => {
            const previous = [createTorrent({ id: 'a', progress: 50 })];
            const current = [createTorrent({ id: 'a', progress: 75 })];

            const result = computeTorrentDiff(previous, current);

            expect(result.hasChanges).toBe(true);
            expect(result.patches).toContainEqual({
                op: 'replace',
                path: '/0/progress',
                value: 75
            });
        });

        it('should detect status changes', () => {
            const previous = [createTorrent({ id: 'a', status: 'downloading' })];
            const current = [createTorrent({ id: 'a', status: 'seeding' })];

            const result = computeTorrentDiff(previous, current);

            expect(result.hasChanges).toBe(true);
            expect(result.patches).toContainEqual({
                op: 'replace',
                path: '/0/status',
                value: 'seeding'
            });
        });

        it('should detect new torrents', () => {
            const previous: Torrent[] = [];
            const current = [createTorrent({ id: 'new' })];

            const result = computeTorrentDiff(previous, current);

            expect(result.hasChanges).toBe(true);
            expect(result.patches).toHaveLength(1);
            expect(result.patches[0].op).toBe('add');
            expect(result.patches[0].path).toBe('/0');
        });

        it('should detect removed torrents', () => {
            const previous = [createTorrent({ id: 'old' })];
            const current: Torrent[] = [];

            const result = computeTorrentDiff(previous, current);

            expect(result.hasChanges).toBe(true);
            expect(result.patches).toContainEqual({
                op: 'remove',
                path: '/0'
            });
        });

        it('should handle multiple changes in one torrent', () => {
            const previous = [createTorrent({ id: 'a', progress: 50, status: 'downloading', downloadSpeed: 1000 })];
            const current = [createTorrent({ id: 'a', progress: 100, status: 'seeding', downloadSpeed: 0 })];

            const result = computeTorrentDiff(previous, current);

            expect(result.hasChanges).toBe(true);
            expect(result.patches.length).toBeGreaterThanOrEqual(3);
        });

        it('should use correct startIndex for paths', () => {
            const previous = [createTorrent({ id: 'a', progress: 50 })];
            const current = [createTorrent({ id: 'a', progress: 75 })];

            const result = computeTorrentDiff(previous, current, 10);

            expect(result.patches).toContainEqual({
                op: 'replace',
                path: '/10/progress',
                value: 75
            });
        });
    });

    describe('applyTorrentPatches', () => {
        it('should apply replace patches', () => {
            const torrents: Record<number, Torrent> = {
                0: createTorrent({ id: 'a', progress: 50 })
            };
            const patches: JsonPatchOperation[] = [
                { op: 'replace', path: '/0/progress', value: 75 }
            ];

            const result = applyTorrentPatches(torrents, patches, 0);

            expect(result[0].progress).toBe(75);
        });

        it('should apply add patches', () => {
            const torrents: Record<number, Torrent> = {};
            const newTorrent = createTorrent({ id: 'new' });
            const patches: JsonPatchOperation[] = [
                { op: 'add', path: '/0', value: newTorrent }
            ];

            const result = applyTorrentPatches(torrents, patches, 0);

            expect(result[0]).toEqual(newTorrent);
        });

        it('should apply remove patches', () => {
            const torrents: Record<number, Torrent> = {
                0: createTorrent({ id: 'a' })
            };
            const patches: JsonPatchOperation[] = [
                { op: 'remove', path: '/0' }
            ];

            const result = applyTorrentPatches(torrents, patches, 0);

            expect(result[0]).toBeUndefined();
        });

        it('should preserve other torrents when patching', () => {
            const torrents: Record<number, Torrent> = {
                0: createTorrent({ id: 'a', progress: 50 }),
                1: createTorrent({ id: 'b', progress: 100 })
            };
            const patches: JsonPatchOperation[] = [
                { op: 'replace', path: '/0/progress', value: 75 }
            ];

            const result = applyTorrentPatches(torrents, patches, 0);

            expect(result[0].progress).toBe(75);
            expect(result[1].progress).toBe(100);
        });
    });

    describe('estimateSavings', () => {
        it('should calculate bandwidth savings', () => {
            const torrents = [createTorrent(), createTorrent({ id: 'b' })];
            const patches: JsonPatchOperation[] = [
                { op: 'replace', path: '/0/progress', value: 75 }
            ];

            const result = estimateSavings(torrents, patches);

            expect(result.fullSize).toBeGreaterThan(0);
            expect(result.patchSize).toBeGreaterThan(0);
            expect(result.patchSize).toBeLessThan(result.fullSize);
            expect(result.savedPercent).toBeGreaterThan(0);
        });

        it('should return 0 savings for empty payload', () => {
            const result = estimateSavings([], []);

            expect(result.savedPercent).toBe(0);
        });
    });
});
