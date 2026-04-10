import React, { useState, useEffect } from 'react';
import { OptionsLayout } from './OptionsLayout';
import { ServerConfigPanel } from '../../features/torrent-control/ui/ServerConfigPanel';
import { FunctionSettings } from '../../features/torrent-control/ui/FunctionSettings';
import { AboutTab } from '../../features/torrent-control/ui/AboutTab';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { TorrentDashboard } from '../../features/torrent-control/ui/TorrentDashboard';
import { CommandPalette } from '@/shared/ui/ui/CommandPalette';
import { Lock } from 'lucide-react';
import { useTorrentPoller } from '../../features/torrent-control/model/useTorrentPoller';
import { Utilities } from '../../features/torrent-control/ui/Utilities';
import { AppearanceSettings } from '../../features/torrent-control/ui/AppearanceSettings';
import { SystemSettings } from '@/shared/ui/SystemSettings';
import { AppSettings } from '@/shared/lib/types';
import { Loading } from '@carbon/react';
import { browser } from 'wxt/browser';

interface DashboardProps {
    settings: AppSettings | null;
    updateSettings: (settings: AppSettings) => Promise<void>;
    loading: boolean;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    exportServerConfig: (sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
    lockVault: () => Promise<void>;
}

const defaultCustomOptions = { addToClient: true, pauseResume: true, openWebUI: true };

export const Dashboard: React.FC<DashboardProps> = ({
    settings,
    updateSettings,
    loading,
    exportSystemBackup,
    exportServerConfig,
    importBackup,
    lockVault
}) => {
    const [activeView, setActiveView] = useState('dashboard');

    // Start polling for torrents
    useTorrentPoller();

    const [previewContextMenu, setPreviewContextMenu] = useState(1);
    const [previewCustomOptions, setPreviewCustomOptions] = useState(defaultCustomOptions);
    const [previewServers, setPreviewServers] = useState<AppSettings['servers']>([]);

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
                setActiveView('dashboard');
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
                notificationLevel: previewNotificationLevel as 'standard' | 'verbose' | 'error'
            }
        });
    };

    const primaryNavItems = [
        { id: 'dashboard', label: browser.i18n.getMessage('navDashboard') },
        { id: 'servers', label: browser.i18n.getMessage('navServers') },
        { id: 'settings', label: browser.i18n.getMessage('navSettings') },
    ];

    const secondaryNavItems = [
        { id: 'appearance', label: browser.i18n.getMessage('navAppearance') },
        { id: 'utilities', label: browser.i18n.getMessage('navUtilities') },
        { id: 'system', label: browser.i18n.getMessage('navSystem') },
        { id: 'about', label: browser.i18n.getMessage('navAbout') },
    ];

    const LockButton = (
        <button
            onClick={() => setActiveView('lock')}
            className="flex items-center justify-center p-2 text-[var(--cds-text-secondary)] hover:text-[var(--cds-text-primary)] hover:bg-[var(--cds-layer-hover)] rounded-sm transition-colors"
            title={browser.i18n.getMessage('lockVault')}
            aria-label={browser.i18n.getMessage('lockVault')}
        >
            <Lock size={16} />
        </button>
    );

    const renderContent = () => {
        if (loading || !settings) {
            return (
                <div className="flex items-center justify-center h-full bg-[var(--cds-background)]">
                    <Loading withOverlay={false} />
                </div>
            );
        }

        switch (activeView) {
            case 'dashboard':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <div className="p-8 max-w-7xl mx-auto">
                                <TorrentDashboard />
                            </div>
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <FunctionSettings
                                settings={settings}
                                updateSettings={(s) => updateSettings(s as AppSettings)}
                                previewContextMenu={previewContextMenu}
                                setPreviewContextMenu={setPreviewContextMenu}
                                previewCustomOptions={previewCustomOptions}
                                setPreviewCustomOptions={setPreviewCustomOptions}
                                applyContextMenu={applyContextMenu}
                                previewServers={previewServers}
                                setPreviewServers={setPreviewServers}
                                previewNotification={previewNotification}
                                setPreviewNotification={setPreviewNotification}
                                previewNotificationLevel={previewNotificationLevel}
                                setPreviewNotificationLevel={setPreviewNotificationLevel}
                                applyNotifications={applyNotifications}
                            />
                        </div>
                    </div>
                );
            case 'servers':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <ServerConfigPanel
                                settings={settings}
                                updateSettings={(s) => updateSettings(s as AppSettings)}
                                exportServerConfig={exportServerConfig}
                                importBackup={importBackup}
                            />
                        </div>
                    </div>
                );
            case 'appearance':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <AppearanceSettings
                                settings={settings}
                                updateSettings={(s) => updateSettings(s as AppSettings)}
                            />
                        </div>
                    </div>
                );
            case 'utilities':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <Utilities
                                settings={settings}
                                exportSystemBackup={exportSystemBackup}
                                importBackup={importBackup}
                            />
                        </div>
                    </div>
                );
            case 'system':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <SystemSettings
                                settings={settings}
                                updateSettings={(s) => updateSettings(s as AppSettings)}
                                exportSystemBackup={exportSystemBackup}
                                importBackup={importBackup}
                            />
                        </div>
                    </div>
                );
            case 'about':
                return (
                    <div className="h-full flex flex-col bg-[var(--cds-background)]">
                        <div className="flex-1 overflow-y-auto scrollbar-thin">
                            <AboutTab
                                settings={settings}
                                updateSettings={(s) => updateSettings(s as AppSettings)}
                            />
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="h-full flex flex-col p-8 text-[var(--cds-text-primary)] bg-[var(--cds-background)]">
                        <h1 className="text-2xl font-bold mb-4">Module not found</h1>
                    </div>
                );
        }
    };

    return (
        <ErrorBoundary>
            <>
                <CommandPalette />
                <OptionsLayout
                    primaryItems={primaryNavItems}
                    secondaryItems={secondaryNavItems}
                    headerContent={LockButton}
                    activeView={activeView === 'lock' ? 'dashboard' : activeView}
                    onViewChange={setActiveView}
                >
                    {renderContent()}
                </OptionsLayout>
            </>
        </ErrorBoundary>
    );
};
