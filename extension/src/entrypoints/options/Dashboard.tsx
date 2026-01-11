import React, { useState, useEffect } from 'react';
import { OptionsLayout } from './OptionsLayout';
import { ServerConfigPanel } from '../../features/torrent-control/ui/ServerConfigPanel';
import { FunctionSettings } from '../../features/torrent-control/ui/FunctionSettings';
import { AppearanceSettings } from '../../features/torrent-control/ui/AppearanceSettings';
import { DiagnosticsSettings } from '../../features/torrent-control/ui/DiagnosticsSettings';
import { DataManagement } from '../../features/torrent-control/ui/DataManagement';
import { AboutTab } from '../../features/torrent-control/ui/AboutTab';
import { SystemSettings } from '@/shared/ui/SystemSettings';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { TorrentDashboard } from '../../features/torrent-control/ui/TorrentDashboard';
import { CommandPalette } from '@/shared/ui/ui/CommandPalette';
import { Download, Palette, Info, CircleDashed, Wrench, Magnet, Lock } from 'lucide-react';
import { ContextMenuSettings } from '../../features/torrent-control/ui/settings/ContextMenuSettings';
import { NotificationSettings } from '../../features/torrent-control/ui/settings/NotificationSettings';
import { useTorrentPoller } from '../../features/torrent-control/model/useTorrentPoller';
import { Utilities } from '../../features/torrent-control/ui/Utilities';
import { AppSettings } from '@/shared/lib/types';
import { PageHeader } from '@/shared/ui/PageHeader';

interface DashboardProps {
    settings: AppSettings | null;
    updateSettings: (settings: AppSettings) => Promise<void>;
    loading: boolean;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    exportServerConfig: (sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
    lockVault: () => Promise<void>;
}

export const Dashboard: React.FC<DashboardProps> = ({
    settings,
    updateSettings,
    loading,
    exportSystemBackup,
    exportServerConfig,
    importBackup,
    lockVault
}) => {
    const [activeView, setActiveView] = useState('torrents');
    const [activeSubTab, setActiveSubTab] = useState('dashboard');

    // Start polling for torrents
    useTorrentPoller();

    const defaultCustomOptions = { addToClient: true, pauseResume: true, openWebUI: true };
    const [previewContextMenu, setPreviewContextMenu] = useState(1);
    const [previewCustomOptions, setPreviewCustomOptions] = useState(defaultCustomOptions);
    const [previewServers, setPreviewServers] = useState<any[]>([]);

    // Notification Preview State
    const [previewNotification, setPreviewNotification] = useState(false);
    const [previewNotificationLevel, setPreviewNotificationLevel] = useState('standard');

    useEffect(() => {
        if (settings) {
            setPreviewContextMenu(settings.globals.contextMenu);
            setPreviewCustomOptions(settings.globals.contextMenuCustomOptions || defaultCustomOptions);
            setPreviewServers(settings.servers || []);
            setPreviewNotification(settings.globals.enableNotifications);
            setPreviewNotificationLevel(settings.globals.notificationLevel);
        }
    }, [settings]);

    // Handle Lock Action
    useEffect(() => {
        if (activeView === 'lock') {
            lockVault().then(() => {
                setActiveView('torrents');
            });
        }
    }, [activeView, lockVault]);

    const applyContextMenu = async () => {
        if (!settings) return;
        await updateSettings({
            ...settings,
            globals: {
                ...settings.globals,
                contextMenu: previewContextMenu,
                contextMenuCustomOptions: previewCustomOptions
            },
            servers: previewServers
        });
    };

    const applyNotifications = async () => {
        if (!settings) return;
        await updateSettings({
            ...settings,
            globals: {
                ...settings.globals,
                enableNotifications: previewNotification,
                notificationLevel: previewNotificationLevel as any
            }
        });
    };

    const getIcon = (id: string) => {
        switch (id) {
            case 'torrents': return Download;
            case 'utilities': return Magnet;
            default: return CircleDashed;
        }
    };

    const getLabel = (id: string) => {
        switch (id) {
            case 'torrents': return 'Torrent Control';
            case 'utilities': return 'Utilities';
            default: return 'Coming Soon';
        }
    };

    // Dynamic Navigation Structure (simplified - no site integrations)
    const defaultOrder = ['torrents', 'utilities'];

    // Merge stored settings with new defaults (handling upgrades for existing users)
    const effectiveSidebar = React.useMemo(() => {
        if (!settings?.layout?.sidebar) return [];

        let items = [...settings.layout.sidebar];

        // Filter out removed items (audiobooks, sites)
        items = items.filter(item => defaultOrder.includes(item.id));

        // Check for missing items
        const existingIds = new Set(items.map(i => i.id));

        defaultOrder.forEach((id, index) => {
            if (!existingIds.has(id)) {
                items.push({ id, visible: true, order: index });
            }
        });

        // Sort by order
        items.sort((a, b) => a.order - b.order);

        return items;
    }, [settings?.layout?.sidebar]);

    const navItems = effectiveSidebar
        .filter(item => item.visible)
        .map(item => {
            return {
                id: item.id,
                icon: getIcon(item.id),
                label: getLabel(item.id)
            };
        });

    const bottomItems = [
        { id: 'appearance', icon: Palette, label: 'Appearance' },
        { id: 'system', icon: Wrench, label: 'System' },
        { id: 'about', icon: Info, label: 'About' },
        { id: 'lock', icon: Lock, label: 'Lock Vault' },
    ];

    const renderContent = () => {
        if (loading || !settings) {
            return (
                <div className="flex items-center justify-center h-full bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            );
        }

        switch (activeView) {
            case 'torrents':
                return (
                    <div className="h-full flex flex-col bg-background">
                        <PageHeader
                            title="Torrent Control"
                            icon={Download}
                            tabs={[
                                { id: 'dashboard', label: 'Dashboard' },
                                { id: 'general', label: 'General' },
                                { id: 'servers', label: 'Servers' },
                                { id: 'context_menu', label: 'Context Menu' },
                                { id: 'notifications', label: 'Notifications' },
                                ...(settings?.globals.showDiagnostics ? [{ id: 'diagnostics', label: 'Diagnostics' }] : []),
                            ]}
                            activeTab={activeSubTab}
                            onTabChange={setActiveSubTab}
                        />

                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            <div className="max-w-5xl mx-auto">
                                {activeSubTab === 'dashboard' && (
                                    <TorrentDashboard />
                                )}
                                {activeSubTab === 'general' && (
                                    <FunctionSettings
                                        settings={settings!}
                                        updateSettings={updateSettings}
                                    />
                                )}
                                {activeSubTab === 'servers' && (
                                    <ServerConfigPanel
                                        settings={settings!}
                                        updateSettings={updateSettings}
                                        exportServerConfig={exportServerConfig}
                                        importBackup={importBackup}
                                    />
                                )}
                                {activeSubTab === 'context_menu' && (
                                    <ContextMenuSettings
                                        settings={settings!}
                                        previewContextMenu={previewContextMenu}
                                        setPreviewContextMenu={setPreviewContextMenu}
                                        previewCustomOptions={previewCustomOptions}
                                        setPreviewCustomOptions={setPreviewCustomOptions}
                                        applyContextMenu={applyContextMenu}
                                        previewTheme={settings!.appearance.theme}
                                        previewServers={previewServers}
                                        setPreviewServers={setPreviewServers}
                                    />
                                )}
                                {activeSubTab === 'notifications' && (
                                    <NotificationSettings
                                        settings={settings!}
                                        previewNotification={previewNotification}
                                        setPreviewNotification={setPreviewNotification}
                                        previewNotificationLevel={previewNotificationLevel}
                                        setPreviewNotificationLevel={setPreviewNotificationLevel}
                                        applyNotifications={applyNotifications}
                                        updateSettings={updateSettings}
                                        previewTheme={settings!.appearance.theme}
                                    />
                                )}
                                {activeSubTab === 'diagnostics' && (
                                    <DiagnosticsSettings settings={settings!} />
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'utilities':
                return (
                    <div className="h-full flex flex-col bg-primary/30">
                        <PageHeader title="Utilities" icon={Magnet} />
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto">
                                <Utilities />
                            </div>
                        </div>
                    </div>
                );
            case 'appearance':
                return (
                    <div className="h-full flex flex-col bg-background">
                        <PageHeader title="Appearance" icon={Palette} />
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto">
                                <AppearanceSettings settings={settings!} updateSettings={updateSettings} />
                            </div>
                        </div>
                    </div>
                );
            case 'system':
                return (
                    <div className="h-full flex flex-col bg-background">
                        <PageHeader title="System" icon={Wrench} />
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto">
                                <SystemSettings
                                    settings={settings!}
                                    updateSettings={updateSettings}
                                    exportSystemBackup={exportSystemBackup}
                                    importBackup={importBackup}
                                />
                            </div>
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="h-full flex flex-col bg-background">
                        <PageHeader title="About" icon={Info} />
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto">
                                <AboutTab
                                    settings={settings!}
                                    updateSettings={updateSettings}
                                />
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="h-full flex flex-col">
                        <h1 className="text-2xl font-bold mb-4">Module not found</h1>
                    </div>
                );
        }
    };

    if (loading || !settings) {
        return (
            <ErrorBoundary>
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <>
                <CommandPalette />
                <OptionsLayout
                    items={navItems}
                    bottomItems={bottomItems}
                    activeView={activeView === 'lock' ? 'torrents' : activeView}
                    onViewChange={setActiveView}
                >
                    {renderContent()}
                </OptionsLayout>
            </>
        </ErrorBoundary>
    );
};
