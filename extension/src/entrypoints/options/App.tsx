import React, { useMemo } from 'react';
import { useSettings } from '../../features/torrent-control/model/useSettings';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { VersionOverlay } from '@/shared/ui/VersionOverlay';
import { VaultGuard } from '@/shared/ui/security/VaultGuard';
import { Dashboard } from './Dashboard';
import { AppSettings, ServerConfig } from '@/shared/lib/types';

// Internal component to handle the authenticated state
// This ensures hooks (useMemo) are only initialized when this component is actually mounted by VaultGuard
const SecureContent: React.FC<{
    vaultServers: ServerConfig[];
    saveServers: (servers: ServerConfig[]) => Promise<void>;
    lock: () => Promise<void>;
    settings: AppSettings | null;
    updateSettings: (settings: AppSettings) => Promise<void>;
    loading: boolean;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    exportServerConfig: (sanitize?: boolean, overrideServers?: ServerConfig[]) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}> = ({
    vaultServers,
    saveServers,
    lock,
    settings,
    updateSettings,
    loading,
    exportSystemBackup,
    exportServerConfig,
    importBackup
}) => {
        // Merge global settings with decrypted servers
        const mergedSettings: AppSettings | null = useMemo(() => {
            if (!settings) return null;
            return { ...settings, servers: vaultServers };
        }, [settings, vaultServers]);

        // Intercept updateSettings to split servers from other settings
        const handleUpdateSettings = async (newSettings: AppSettings) => {
            if (!newSettings) return;

            // Check if servers changed
            const newServers = newSettings.servers || [];
            const oldServers = vaultServers || [];

            // Simple comparison
            if (JSON.stringify(newServers) !== JSON.stringify(oldServers)) {
                await saveServers(newServers);
            }

            // Update global settings, ensuring servers is excluded/empty in storage
            await updateSettings({ ...newSettings, servers: [] });
        };

        return (
            <Dashboard
                settings={mergedSettings}
                updateSettings={handleUpdateSettings}
                loading={loading}
                exportSystemBackup={exportSystemBackup}
                exportServerConfig={(sanitize) => exportServerConfig(sanitize, mergedSettings?.servers)}
                importBackup={importBackup}
                lockVault={lock}
            />
        );
    };

const App = () => {
    const {
        settings,
        updateSettings,
        loading,
        exportSystemBackup,
        exportServerConfig,
        importBackup
    } = useSettings();

    return (
        <ErrorBoundary>
            <VaultGuard>
                {({ servers: vaultServers, saveServers, lock }) => (
                    <SecureContent
                        vaultServers={vaultServers}
                        saveServers={saveServers}
                        lock={lock}
                        settings={settings}
                        updateSettings={updateSettings}
                        loading={loading}
                        exportSystemBackup={exportSystemBackup}
                        exportServerConfig={exportServerConfig}
                        importBackup={importBackup}
                    />
                )}
            </VaultGuard>
            <VersionOverlay />
        </ErrorBoundary>
    );
};

export default App;
