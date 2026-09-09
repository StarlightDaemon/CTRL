import { describe, it, expect } from 'vitest';
import {
    normalizeSettings,
    normalizeContextMenuMode,
    mergeGlobals,
    GlobalOptionsSchema,
    AppOptionsSchema,
} from '@/features/torrent-control/model/settingsSchema';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

/** A `local:options` blob as written by the 0.2.0-beta.1 build, with every removed key present. */
const legacyStoredOptions = {
    globals: {
        contextMenu: 3,
        addPaused: true,
        addAdvanced: true,
        enableNotifications: false,
        notificationLevel: 'verbose',
        debugMode: true,
        matchRegExp: ['.*\\.torrent$'],
        labels: ['tv', 'movies'],
        currentServer: 1,
        showDiagnostics: true,
        badgeInfo: 'speed',
        notificationStyle: 'modal',
        contextMenuCustomOptions: { addToClient: false, pauseResume: true, openWebUI: true },
    },
    appearance: { theme: 'cyberpunk', performance: 'fancy' },
    layout: { sidebar: [{ id: 'torrents', visible: true, order: 0 }, { id: 'utilities', visible: false, order: 1 }] },
    servers: [],
};

describe('normalizeSettings', () => {
    it('returns defaults for empty, null, or malformed storage', () => {
        expect(normalizeSettings(undefined)).toEqual(DEFAULT_OPTIONS);
        expect(normalizeSettings(null)).toEqual(DEFAULT_OPTIONS);
        expect(normalizeSettings('garbage')).toEqual(DEFAULT_OPTIONS);
        expect(normalizeSettings({ globals: 'garbage' })).toEqual(DEFAULT_OPTIONS);
    });

    it('drops every obsolete key and keeps the retained ones from an old install', () => {
        const result = normalizeSettings(legacyStoredOptions);

        expect(result.globals).toEqual({
            contextMenu: 1, // legacy custom mode folded into full
            addPaused: true,
            addAdvanced: true,
            enableNotifications: false,
            labels: ['tv', 'movies'],
            currentServer: 1,
            badgeInfo: 'speed',
        });
        expect(result).not.toHaveProperty('appearance');
        expect(result).not.toHaveProperty('layout');
        expect(Object.keys(result.globals).sort()).toEqual(Object.keys(DEFAULT_OPTIONS.globals).sort());
    });

    it('does not fail when a retained key has the wrong type; it falls back to the default for the whole group', () => {
        const result = normalizeSettings({ globals: { badgeInfo: 'rainbow', addPaused: true } });
        // Zod rejects the object as a whole; defaults win rather than a crash.
        expect(result.globals).toEqual(DEFAULT_OPTIONS.globals);
    });

    it('never surfaces stored servers into globals and preserves the servers array shape', () => {
        const result = normalizeSettings({ servers: [{ name: 'x' }], globals: {} });
        expect(result.servers).toEqual([{ name: 'x' }]);
        expect(normalizeSettings({ servers: 'nope' }).servers).toEqual([]);
    });
});

describe('normalizeContextMenuMode', () => {
    it('keeps 0/1/2, accepts numeric strings, folds 3 into full, defaults otherwise', () => {
        expect(normalizeContextMenuMode(0)).toBe(0);
        expect(normalizeContextMenuMode(1)).toBe(1);
        expect(normalizeContextMenuMode(2)).toBe(2);
        expect(normalizeContextMenuMode('2')).toBe(2);
        expect(normalizeContextMenuMode(3)).toBe(1);
        expect(normalizeContextMenuMode('3')).toBe(1);
        expect(normalizeContextMenuMode(undefined)).toBe(DEFAULT_OPTIONS.globals.contextMenu);
        expect(normalizeContextMenuMode('nonsense')).toBe(DEFAULT_OPTIONS.globals.contextMenu);
        expect(normalizeContextMenuMode(42)).toBe(DEFAULT_OPTIONS.globals.contextMenu);
    });
});

describe('import schemas', () => {
    it('GlobalOptionsSchema strips obsolete keys from a backup instead of rejecting it', () => {
        const parsed = GlobalOptionsSchema.parse(legacyStoredOptions.globals);
        expect(parsed).toEqual({
            contextMenu: 1,
            addPaused: true,
            addAdvanced: true,
            enableNotifications: false,
            labels: ['tv', 'movies'],
            currentServer: 1,
            badgeInfo: 'speed',
        });
    });

    it('AppOptionsSchema ignores appearance/layout sections of an old full backup', () => {
        const parsed = AppOptionsSchema.parse(legacyStoredOptions);
        expect(parsed).not.toHaveProperty('appearance');
        expect(parsed).not.toHaveProperty('layout');
        expect(parsed.globals?.badgeInfo).toBe('speed');
    });

    it('mergeGlobals layers incoming over current over defaults without reintroducing removed keys', () => {
        const merged = mergeGlobals(
            { addPaused: true, labels: ['a'] },
            { labels: ['b'], badgeInfo: 'none' },
        );
        expect(merged).toEqual({
            ...DEFAULT_OPTIONS.globals,
            addPaused: true,
            labels: ['b'],
            badgeInfo: 'none',
        });
    });
});
