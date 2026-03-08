import { useState, useEffect } from 'react';
import { storage } from 'wxt/storage';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

import { z } from 'zod'; // Add Zod import

export const settingsStorage = storage.defineItem<AppOptions>('local:options', {
    defaultValue: DEFAULT_OPTIONS,
});

import { VaultService } from '@/shared/api/security/VaultService';

// Zod Schemas for Validation
const ServerConfigSchema = z.object({
    name: z.string().default('New Server'),
    application: z.string(),
    type: z.string(),
    hostname: z.string(),
    username: z.string().optional(),
    password: z.string().optional(),
    directories: z.array(z.string()).default([]),
    clientOptions: z.record(z.any()).default({}),
    httpAuth: z.object({
        username: z.string(),
        password: z.string().optional()
    }).optional()
}).passthrough();

const GlobalOptionsSchema = z.object({
    contextMenu: z.number().optional(),
    addPaused: z.boolean().optional(),
    addAdvanced: z.boolean().optional(),
    enableNotifications: z.boolean().optional(),
    notificationLevel: z.enum(['standard', 'verbose', 'error']).optional(),
    debugMode: z.boolean().optional(),
    matchRegExp: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
    currentServer: z.number().optional(),
    showDiagnostics: z.boolean().optional(),
    badgeInfo: z.enum(['none', 'count', 'speed']).optional(),
    notificationStyle: z.enum(['toast', 'banner', 'modal']).optional(),
    contextMenuCustomOptions: z.object({
        addToClient: z.boolean(),
        pauseResume: z.boolean(),
        openWebUI: z.boolean(),
    }).optional(),
}).passthrough();

const AppearanceSchema = z.object({
    theme: z.string().optional(),
    performance: z.enum(['low', 'standard', 'fancy']).optional(),
}).passthrough();

const LayoutSchema = z.object({
    sidebar: z.array(z.object({
        id: z.string(),
        visible: z.boolean(),
        order: z.number(),
    })).optional()
}).passthrough();

const AppOptionsSchema = z.object({
    globals: GlobalOptionsSchema.optional(),
    appearance: AppearanceSchema.optional(),
    layout: LayoutSchema.optional(),
    servers: z.array(ServerConfigSchema).optional(),
}).passthrough();

const BackupSchema = z.object({
    version: z.number().optional(),
    type: z.enum(['system_backup', 'server_config']).optional(),
    subtype: z.enum(['full', 'settings']).optional(),
    timestamp: z.string().optional(),
    data: z.record(z.any())
});

export function useSettings() {
    const [settings, setSettings] = useState<AppOptions | null>(null);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const val = await settingsStorage.getValue();
        // Deep merge logic
        const merged = {
            ...DEFAULT_OPTIONS,
            ...val,
            globals: { ...DEFAULT_OPTIONS.globals, ...val?.globals },
            appearance: { ...DEFAULT_OPTIONS.appearance, ...val?.appearance },
            layout: { ...DEFAULT_OPTIONS.layout, ...val?.layout }
        } as AppOptions;

        // Try to load servers from Vault
        try {
            if (await VaultService.isInitialized() && !await VaultService.isLocked()) {
                const servers = await VaultService.getServers();
                merged.servers = servers;

                // One-time migration: Check for stuck plaintext servers ONLY if not already migrated
                // This prevents spurious storage writes on every load that could trigger background watchers
                if (val && val.servers && val.servers.length > 0) {
                    const migrationKey = 'local:plaintext_servers_migrated';
                    const migrated = await storage.getItem<boolean>(migrationKey);

                    if (!migrated) {
                        // This is a one-time cleanup, not triggered on every load
                        await settingsStorage.setValue({ ...val, servers: [] });
                        await storage.setItem(migrationKey, true);
                        if (__UI_DEBUG_MODE__) {
                            console.log('[Migration] Cleaned up stuck plaintext servers from storage (one-time).');
                        }
                    }
                }
            }
        } catch (e) {
            if (__UI_DEBUG_MODE__) {
                console.warn('Failed to load servers from vault in hook', e);
            }
        }

        setSettings(merged);
        setLoading(false);
    };

    useEffect(() => {
        load();

        const unwatch = settingsStorage.watch(() => {
            load(); // Reload on change
        });

        // Listen for vault unlock (custom event or polling? For now, we rely on parent re-render or polling)
        // Ideally we'd watch a Vault state but WXT storage watch covers session key if we used storage.

        return () => unwatch();
    }, []);

    const updateSettings = async (newSettings: AppOptions) => {
        // 1. Handle Vault (Servers) - write first so if it fails, state remains unchanged
        if (newSettings.servers) {
            try {
                if (!await VaultService.isInitialized()) {
                    throw new Error('Vault is not initialized.');
                }
                if (await VaultService.isLocked()) {
                    throw new Error('Vault is locked. Cannot save server settings.');
                }
                await VaultService.saveServers(newSettings.servers);
            } catch (e) {
                if (__UI_DEBUG_MODE__) {
                    console.error('Failed to save servers to vault:', e);
                }
                throw e; // Refuse to swallow, let caller show error
            }
        }

        // Only update local UI state if Vault persistence succeeded
        setSettings(newSettings);

        // 2. Handle Storage (Everything else)
        // Ensure we never write servers to local storage here
        const { servers, ...safeSettings } = newSettings;
        await settingsStorage.setValue(safeSettings as AppOptions);
    };

    const exportSystemBackup = (type: 'full' | 'settings' = 'full', sanitize: boolean = true) => {
        if (!settings) return;

        const exportData = {
            version: 2,
            type: 'system_backup',
            subtype: type,
            timestamp: new Date().toISOString(),
            data: {} as Partial<AppOptions>
        };

        const dataToExport = { ...settings };

        // Remove servers from generic backup if sanitizing or if it's settings only
        if (sanitize || type === 'settings') {
            // For 'settings' type we might want to strip servers anyway, but lets be explicit
            // Actually, 'settings' type usually implies no servers. 
            // If type is 'full' and sanitize is true, we should probably strip sensitive fields from servers or remove them entirely?
            // The user wanted "clearly different parts". 
            // Let's decide: System Backup (Full) includes everything. Sanitize strips passwords.
        }

        if (type === 'full') {
            exportData.data = dataToExport;
            if (sanitize && exportData.data.servers) {
                exportData.data.servers = exportData.data.servers.map((s: ServerConfig) => ({
                    ...s,
                    password: '', // Clear password
                    httpAuth: s.httpAuth ? { ...s.httpAuth, password: '' } : undefined
                }));
            }
        } else {
            // Settings Only (Global + Appearance)
            exportData.data = {
                globals: settings.globals,
                appearance: settings.appearance
            };
        }

        downloadJson(exportData, `ctrl-backup-${type}-${new Date().toISOString().split('T')[0]}.json`);
    };

    const exportServerConfig = (sanitize: boolean = true, overrideServers?: ServerConfig[]) => {
        const serversToUse = overrideServers || settings?.servers;

        // Check if we actually have servers to export
        if (!serversToUse || serversToUse.length === 0) {
            if (__UI_DEBUG_MODE__) {
                console.warn('exportServerConfig: No servers to export.');
            }
            return;
        }

        let serversToExport = [...serversToUse];

        if (sanitize) {
            serversToExport = serversToExport.map(s => ({
                ...s,
                password: '', // Clear main password
                httpAuth: s.httpAuth ? { ...s.httpAuth, password: '' } : undefined
            }));
        }

        const exportData = {
            version: 2,
            type: 'server_config',
            timestamp: new Date().toISOString(),
            data: {
                servers: serversToExport
            }
        };

        const date = new Date();
        const timestamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
        const mode = sanitize ? 'safe' : 'full';

        downloadJson(exportData, `ctrl-servers-${mode}-${timestamp}.json`);
    };

    const downloadJson = (data: Record<string, unknown>, filename: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const importBackup = async (file: File): Promise<{ success: boolean; message: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const content = e.target?.result as string;
                    let raw: any;
                    try {
                        raw = JSON.parse(content);
                    } catch (err) {
                        throw new Error('Invalid JSON: The file could not be parsed.');
                    }

                    // 1. Identify Format
                    const isLegacy = !raw.version && raw.globals && Array.isArray(raw.servers);
                    const isModern = !!raw.version && typeof raw.type === 'string';

                    if (!isLegacy && !isModern) {
                        throw new Error('Unrecognized or malformed backup format.');
                    }

                    // 2. Full Validation (Zero state changes until this completes)
                    let serversToImport: ServerConfig[] | undefined;
                    let settingsToImport: any; // Collector for validated settings, using any to handle partial shapes before merge
                    let successMessage = '';

                    const isVaultInitialized = await VaultService.isInitialized();
                    const isVaultLocked = await VaultService.isLocked();

                    if (isLegacy) {
                        // Validate legacy payload
                        const validatedGlobals = GlobalOptionsSchema.parse(raw.globals);
                        const validatedServers = z.array(ServerConfigSchema).parse(raw.servers);

                        const validatedAppearance = raw.appearance ? AppearanceSchema.parse(raw.appearance) : undefined;
                        const validatedLayout = raw.layout ? LayoutSchema.parse(raw.layout) : undefined;

                        settingsToImport = {
                            globals: validatedGlobals,
                            appearance: validatedAppearance,
                            layout: validatedLayout
                        };
                        serversToImport = validatedServers;
                        successMessage = 'Legacy full backup imported.';
                    } else {
                        // Validate modern payload
                        const meta = BackupSchema.parse(raw);

                        if (meta.type === 'server_config') {
                            if (!meta.data || !Array.isArray(meta.data.servers)) {
                                throw new Error('Invalid server config: missing servers data.');
                            }
                            serversToImport = z.array(ServerConfigSchema).parse(meta.data.servers);
                            successMessage = 'Server configuration imported.';
                        } else if (meta.type === 'system_backup') {
                            const validatedData = AppOptionsSchema.parse(meta.data);
                            if (meta.subtype === 'full') {
                                settingsToImport = validatedData;
                                serversToImport = validatedData.servers;
                                successMessage = 'System backup imported.';
                            } else {
                                // Settings only - explicitly ensure servers are NOT in the import payload
                                const { servers: _, ...rest } = validatedData;
                                settingsToImport = rest;
                                successMessage = 'System settings imported.';
                            }
                        } else {
                            throw new Error(`Unsupported backup type: ${meta.type}`);
                        }
                    }

                    // 3. Pre-flight checks (Vault state)
                    if (serversToImport && serversToImport.length > 0) {
                        if (!isVaultInitialized) {
                            throw new Error('Vault is not set up. Please initialize it before importing servers.');
                        }
                        if (isVaultLocked) {
                            throw new Error('Vault is locked. Please unlock it before importing servers.');
                        }
                    }

                    // 4. ATOMIC COMMIT (Mutation Phase)
                    // If we reach here, validation passed and state is ready for mutation.

                    // Snapshot current state for rollback on partial failure
                    const vaultSnapshot = isVaultInitialized && !isVaultLocked
                        ? await VaultService.getServers()
                        : [];
                    const optionsSnapshot = await settingsStorage.getValue() || DEFAULT_OPTIONS;

                    try {
                        // A. Update servers in Vault
                        if (serversToImport && serversToImport.length > 0) {
                            await VaultService.saveServers(serversToImport);
                        }

                        // B. Update settings in local storage
                        if (settingsToImport) {
                            const current = await settingsStorage.getValue() || DEFAULT_OPTIONS;
                            const { servers: _, ...safeIncoming } = settingsToImport;

                            const merged = {
                                ...current,
                                ...safeIncoming,
                                globals: safeIncoming.globals ? { ...current.globals, ...safeIncoming.globals } : current.globals,
                                appearance: safeIncoming.appearance ? { ...current.appearance, ...safeIncoming.appearance } : current.appearance,
                                layout: safeIncoming.layout ? { ...current.layout, ...safeIncoming.layout } : current.layout,
                                servers: [] // Always empty in local storage
                            } as AppOptions;

                            await settingsStorage.setValue(merged);
                        }

                        // 5. Finalize state
                        await load();
                        resolve({ success: true, message: successMessage });
                    } catch (importError) {
                        // Rollback on failure
                        if (__UI_DEBUG_MODE__) {
                            console.error('[Import] Atomic commit failed, rolling back:', importError);
                        }

                        // Best-effort rollback (don't throw if rollback fails)
                        try {
                            if (vaultSnapshot.length > 0 || serversToImport) {
                                await VaultService.saveServers(vaultSnapshot);
                            }
                            await settingsStorage.setValue(optionsSnapshot);
                        } catch (rollbackError) {
                            console.error('[Import] Rollback also failed:', rollbackError);
                        }

                        reject(new Error(`Import failed: ${importError instanceof Error ? importError.message : 'Unknown error'}`));
                    }

                } catch (error: unknown) {
                    let message = 'Import failed.';
                    if (error instanceof z.ZodError) {
                        message = 'Invalid backup data shape: ' + error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
                    } else if (error instanceof Error) {
                        message = error.message;
                    }
                    reject(new Error(message));
                }
            };
            reader.readAsText(file);
        });
    };

    return { settings, updateSettings, loading, exportSystemBackup, exportServerConfig, importBackup };
}
