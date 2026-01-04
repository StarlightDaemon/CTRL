import { useState, useEffect } from 'react';
import { storage } from 'wxt/storage';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';

export const settingsStorage = storage.defineItem<AppOptions>('local:options', {
    defaultValue: DEFAULT_OPTIONS,
});

import { VaultService } from '@/shared/api/security/VaultService';

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
            layout: { ...DEFAULT_OPTIONS.layout, ...val?.layout },
            '1337x': { ...DEFAULT_OPTIONS['1337x'], ...val?.['1337x'] },
            nyaa: { ...DEFAULT_OPTIONS.nyaa, ...val?.nyaa },
            fitgirl: { ...DEFAULT_OPTIONS.fitgirl, ...val?.fitgirl }
        } as AppOptions;

        // Try to load servers from Vault
        try {
            if (await VaultService.isInitialized() && !await VaultService.isLocked()) {
                const servers = await VaultService.getServers();
                merged.servers = servers;

                // CRITICAL FIX: If we successfully loaded from Vault, but 'val' (local storage) has servers,
                // it means we have "stuck" plaintext server data (e.g. from a bad import or previous bug).
                // We must clear this to prevent conflicts, crashes, and security risks.
                if (val && val.servers && val.servers.length > 0) {
                    await settingsStorage.setValue({ ...val, servers: [] });
                    console.log('Cleaned up stuck plaintext servers from storage.');
                }
            }
        } catch (e) {
            console.warn('Failed to load servers from vault in hook', e);
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
        setSettings(newSettings);

        // 1. Handle Vault (Servers)
        if (newSettings.servers) {
            try {
                if (await VaultService.isInitialized() && !await VaultService.isLocked()) {
                    await VaultService.saveServers(newSettings.servers);
                }
            } catch (e) {
                console.error('Failed to save servers to vault:', e);
                // Should we alert user? 
            }
        }

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
            // Settings Only (Global + Appearance + Sites)
            exportData.data = {
                globals: settings.globals,
                appearance: settings.appearance,
                '1337x': settings['1337x'],
                nyaa: settings.nyaa,
                fitgirl: settings.fitgirl,
                audiobook_bay: settings.audiobook_bay,
                torrent_galaxy: settings.torrent_galaxy,
                the_pirate_bay: settings.the_pirate_bay
            };
        }

        downloadJson(exportData, `ctrl-backup-${type}-${new Date().toISOString().split('T')[0]}.json`);
    };

    const exportServerConfig = (sanitize: boolean = true, overrideServers?: ServerConfig[]) => {
        const serversToUse = overrideServers || settings?.servers;

        // Check if we actually have servers to export
        if (!serversToUse || serversToUse.length === 0) {
            alert('No servers to export. If you have servers configured, ensure the Vault is unlocked.');
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
                    const parsed = JSON.parse(content);
                    const isInitialized = await VaultService.isInitialized();
                    const isLocked = await VaultService.isLocked();

                    // Helper to handle server saving
                    const saveImportedServers = async (newServers: ServerConfig[]) => {
                        if (isInitialized && !isLocked) {
                            // Vault is ready, save directly
                            await VaultService.saveServers(newServers);
                        } else if (!isInitialized) {
                            // Vault not set up, we can't save servers securely yet.
                            // But we shouldn't save them to plaintext storage either if we want to enforce vault usage.
                            // However, for first-time import (e.g. legacy), we might allow it?
                            // Better approach: If vault is off, we cannot import servers securely. 
                            throw new Error('Please setup and unlock the Vault before importing servers.');
                        } else {
                            throw new Error('Vault is locked. Please unlock it before importing.');
                        }
                    };

                    if (!parsed.version) {
                        // Legacy handling
                        // Legacy backups contain everything in one object
                        if (parsed.globals && Array.isArray(parsed.servers)) {
                            // Split
                            const { servers, ...rest } = parsed;

                            // Update settings (without servers)
                            await updateSettings({ ...DEFAULT_OPTIONS, ...rest, servers: [] });

                            // Save servers to vault
                            if (servers.length > 0) {
                                await saveImportedServers(servers);
                            }

                            resolve({ success: true, message: 'Legacy full backup imported.' });
                        } else {
                            reject(new Error('Unknown legacy format.'));
                        }
                        return;
                    }

                    if (parsed.type === 'server_config') {
                        if (!parsed.data.servers) throw new Error('Invalid server config file.');
                        await saveImportedServers(parsed.data.servers);

                        // Refresh settings to reflect new vault data
                        await load();

                        resolve({ success: true, message: 'Server configuration imported.' });
                        return;
                    }

                    if (parsed.type === 'system_backup') {
                        const current = await settingsStorage.getValue() || DEFAULT_OPTIONS;

                        if (parsed.subtype === 'full') {
                            const { servers, ...rest } = parsed.data;
                            // Update generic settings
                            await updateSettings({ ...current, ...rest, servers: [] });
                            // Update servers if present
                            if (servers && Array.isArray(servers)) {
                                await saveImportedServers(servers);
                            }
                        } else {
                            // Settings only
                            const merged = {
                                ...current,
                                ...parsed.data,
                                servers: [] // Ensure we don't accidentally write servers to storage
                            };
                            // But wait, if we write servers: [], we wipe existing servers from storage?
                            // No, 'servers' in storage SHOULD be empty.
                            // But 'current' might have come from the hook state which MIGHT have decrypted servers in it?
                            // settingsStorage.getValue() returns raw storage, so 'servers' should be empty there.
                            // So current.servers is likely []. 

                            await updateSettings(merged);
                        }

                        await load(); // Refresh state
                        resolve({ success: true, message: 'System backup imported.' });
                        return;
                    }

                    reject(new Error('Unknown backup file type.'));

                } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'Failed to parse file.';
                    reject(new Error(message));
                }
            };
            reader.readAsText(file);
        });
    };

    return { settings, updateSettings, loading, exportSystemBackup, exportServerConfig, importBackup };
}
