import { z } from 'zod';
import { AppOptions, ContextMenuMode, GlobalOptions } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

/**
 * Persisted-settings contract for v1.
 *
 * Only keys with a runtime consumer are retained. Anything else found in
 * `local:options` or in an imported backup — the removed appearance, layout,
 * notification level/style, debug, regex, diagnostics and custom
 * context-menu keys, or keys from a future version — is dropped on load and
 * on import so that stale preferences can never make configuration loading
 * fail or resurrect removed behaviour.
 */

/** Context-menu mode value that used to select the removed "custom" menu. */
export const LEGACY_CUSTOM_CONTEXT_MENU_MODE = 3;

export function normalizeContextMenuMode(value: unknown): ContextMenuMode {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (parsed === 0 || parsed === 1 || parsed === 2) return parsed;
    // The custom mode had no retained runtime behaviour beyond a subset of
    // the full menu; users who had it now get the full menu.
    if (parsed === LEGACY_CUSTOM_CONTEXT_MENU_MODE) return 1;
    return DEFAULT_OPTIONS.globals.contextMenu;
}

export const ServerConfigSchema = z.object({
    id: z.string().optional(),
    name: z.string().default('New Server'),
    application: z.string(),
    type: z.string(),
    hostname: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    directories: z.array(z.string()).default([]),
    defaultDirectory: z.string().optional(),
    defaultLabel: z.string().optional(),
    clientOptions: z.record(z.unknown()).default({}),
    httpAuth: z.object({
        username: z.string(),
        password: z.string().optional()
    }).optional(),
    showInContextMenu: z.boolean().optional(),
}).passthrough();

/**
 * Retained global options. Unknown keys are stripped (Zod default), and a
 * legacy custom context-menu value is folded into the full menu.
 */
export const GlobalOptionsSchema = z.object({
    contextMenu: z.unknown().transform(normalizeContextMenuMode).optional(),
    addPaused: z.boolean().optional(),
    addAdvanced: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    labels: z.array(z.string()).optional(),
    currentServer: z.number().int().nonnegative().optional(),
    badgeInfo: z.enum(['none', 'count', 'speed']).optional(),
});

export const AppOptionsSchema = z.object({
    globals: GlobalOptionsSchema.optional(),
    servers: z.array(ServerConfigSchema).optional(),
});

export const BackupSchema = z.object({
    version: z.number().optional(),
    type: z.enum(['system_backup', 'server_config']).optional(),
    subtype: z.enum(['full', 'settings']).optional(),
    timestamp: z.string().optional(),
    data: z.record(z.unknown())
});

/**
 * Merge whatever is in storage with the defaults, keeping only retained keys.
 * Never throws: an unreadable `globals` falls back to the defaults.
 */
export function normalizeSettings(raw: unknown): AppOptions {
    const source = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
    const parsedGlobals = GlobalOptionsSchema.safeParse(source.globals ?? {});
    const globals: GlobalOptions = {
        ...DEFAULT_OPTIONS.globals,
        ...(parsedGlobals.success ? stripUndefined(parsedGlobals.data) : {}),
    };
    const servers = Array.isArray(source.servers) ? source.servers as AppOptions['servers'] : [];
    return { globals, servers };
}

/** Merge validated incoming globals over the current ones, defaults filling gaps. */
export function mergeGlobals(current: Partial<GlobalOptions> | undefined, incoming: Partial<GlobalOptions> | undefined): GlobalOptions {
    return {
        ...DEFAULT_OPTIONS.globals,
        ...stripUndefined(current ?? {}),
        ...stripUndefined(incoming ?? {}),
    };
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}
