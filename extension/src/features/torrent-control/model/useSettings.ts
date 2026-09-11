import { useState, useEffect, useCallback } from 'react';
import { storage } from 'wxt/utils/storage';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { z } from 'zod';
import { VaultService } from '@/shared/api/security/VaultService';
import { sanitizeServersForExport } from './exportSanitizer';
import {
    AppOptionsSchema,
    BackupSchema,
    GlobalOptionsSchema,
    ServerConfigSchema,
    mergeGlobals,
    normalizeSettings,
} from './settingsSchema';

export const settingsStorage = storage.defineItem<AppOptions>('local:options', {
    defaultValue: DEFAULT_OPTIONS,
});

export function useSettings() {
    const [settings, setSettings] = useState<AppOptions | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const val = await settingsStorage.getValue();
        // Retained keys over defaults; obsolete keys from older versions are dropped.
        const merged = normalizeSettings(val);

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
    }, []);

    useEffect(() => {
        load();

        const unwatch = settingsStorage.watch(() => {
            load(); // Reload on change
        });

        return () => unwatch();
    }, [load]);

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
            /** Marks whether credentials are present so the file is self-describing. */
            containsSecrets: type === 'full' && !sanitize,
            data: {} as Partial<AppOptions>
        };

        if (type === 'full') {
            exportData.data = { ...settings };
            if (sanitize && exportData.data.servers) {
                // Allowlist-based: only known non-secret fields survive.
                exportData.data.servers = sanitizeServersForExport(exportData.data.servers) as unknown as ServerConfig[];
            }
        } else {
            // Settings only: global preferences, never servers.
            exportData.data = { globals: settings.globals };
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

        const serversToExport: unknown[] = sanitize
            ? sanitizeServersForExport(serversToUse)
            : [...serversToUse];

        const exportData = {
            version: 2,
            type: 'server_config',
            timestamp: new Date().toISOString(),
            /** Marks whether credentials are present so the file is self-describing. */
            containsSecrets: !sanitize,
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
                    let raw: {
                        version?: unknown;
                        type?: unknown;
                        subtype?: unknown;
                        globals?: unknown;
                        servers?: unknown;
                        data?: unknown;
                    };
                    try {
                        raw = JSON.parse(content);
                    } catch {
                        throw new Error('Invalid JSON: The file could not be parsed.');
                    }

                    // 1. Identify Format
                    const isLegacy = !raw.version && raw.globals && Array.isArray(raw.servers);
                    const isModern = !!raw.version && typeof raw.type === 'string';

                    if (!isLegacy && !isModern) {
                        throw new Error('Unrecognized or malformed backup format.');
                    }

                    // 2. Full Validation (Zero state changes until this completes).
                    // Obsolete preference keys (appearance, layout, notification
                    // level/style, ...) are stripped by the schemas rather than rejected.
                    let serversToImport: ServerConfig[] | undefined;
                    let globalsToImport: Partial<AppOptions['globals']> | undefined;
                    let successMessage = '';

                    const isVaultInitialized = await VaultService.isInitialized();
                    const isVaultLocked = await VaultService.isLocked();

                    if (isLegacy) {
                        globalsToImport = GlobalOptionsSchema.parse(raw.globals);
                        serversToImport = z.array(ServerConfigSchema).parse(raw.servers) as ServerConfig[];
                        successMessage = 'Legacy full backup imported.';
                    } else {
                        const meta = BackupSchema.parse(raw);

                        if (meta.type === 'server_config') {
                            if (!meta.data || !Array.isArray(meta.data.servers)) {
                                throw new Error('Invalid server config: missing servers data.');
                            }
                            serversToImport = z.array(ServerConfigSchema).parse(meta.data.servers) as ServerConfig[];
                            successMessage = 'Server configuration imported.';
                        } else if (meta.type === 'system_backup') {
                            const validatedData = AppOptionsSchema.parse(meta.data);
                            globalsToImport = validatedData.globals;
                            if (meta.subtype === 'full') {
                                serversToImport = validatedData.servers as ServerConfig[] | undefined;
                                successMessage = 'System backup imported.';
                            } else {
                                // Settings only - servers are never taken from this payload
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
                        if (globalsToImport) {
                            const current = normalizeSettings(await settingsStorage.getValue());
                            const merged: AppOptions = {
                                globals: mergeGlobals(current.globals, globalsToImport),
                                servers: [] // Always empty in local storage
                            };
                            await settingsStorage.setValue(merged);
                        }

                        // 5. Finalize state
                        await load();
                        resolve({ success: true, message: successMessage });
                    } catch (importError) {
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
