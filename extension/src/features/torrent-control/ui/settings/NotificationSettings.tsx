import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { Bell, CheckCircle } from 'lucide-react';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    previewNotification: boolean;
    setPreviewNotification: (enabled: boolean) => void;
    previewNotificationLevel: string;
    setPreviewNotificationLevel: (level: string) => void;
    applyNotifications: () => void;
    updateSettings: (newSettings: AppOptions) => void;
    previewTheme: string;
}

export const NotificationSettings: React.FC<Props> = ({
    settings,
    previewNotification,
    setPreviewNotification,
    previewNotificationLevel,
    setPreviewNotificationLevel,
    applyNotifications,
    updateSettings,
    previewTheme
}) => {
    // Debug IDs
    const applyBtnDebug = useDebugId('settings', 'notifications', 'apply-button');
    const enableToggleDebug = useDebugId('settings', 'notifications', 'enable-toggle');
    const levelSelectDebug = useDebugId('settings', 'notifications', 'level-select');
    const styleSelectDebug = useDebugId('settings', 'notifications', 'style-select');

    return (
        <SettingsCard
            title="Notifications"
            headerActions={
                (previewNotification !== settings.globals.enableNotifications || previewNotificationLevel !== settings.globals.notificationLevel) && (
                    <button
                        onClick={applyNotifications}
                        className="bg-accent text-white px-3 py-1.5 rounded text-sm hover:bg-accent-hover transition-colors"
                        {...applyBtnDebug}
                    >
                        Apply
                    </button>
                )
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <SettingsToggle
                        checked={previewNotification}
                        onChange={() => setPreviewNotification(!previewNotification)}
                        label="Enable Notifications"
                        {...enableToggleDebug}
                    />

                    {previewNotification && (
                        <div className="space-y-4 pt-4 border-t border-border">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Notification Level</label>
                                <select
                                    value={previewNotificationLevel}
                                    onChange={(e) => setPreviewNotificationLevel(e.target.value)}
                                    className="block w-full rounded-md border-border bg-surface text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                    {...levelSelectDebug}
                                >
                                    <option value="standard">Standard (Success & Errors)</option>
                                    <option value="verbose">Verbose (Detailed Steps)</option>
                                    <option value="error">Errors Only</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Notification Style</label>
                                <select
                                    value={settings.globals.notificationStyle}
                                    onChange={(e) => updateSettings({ ...settings, globals: { ...settings.globals, notificationStyle: e.target.value as any } })}
                                    className="block w-full rounded-md border-border bg-surface text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                    {...styleSelectDebug}
                                >
                                    <option value="toast">Toast (Bottom Right)</option>
                                    <option value="banner">Banner (Top Width)</option>
                                    <option value="modal">Modal (Center Alert)</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notification Mockup */}
                <div className="border border-border rounded-lg bg-gray-100 dark:bg-gray-900 p-4 relative h-32 flex items-end justify-end overflow-hidden" data-theme={previewTheme}>
                    {previewNotification ? (
                        <div className={`bg-card border border-border shadow-lg rounded p-3 flex items-start space-x-3 w-64 ${settings.appearance.performance !== 'low' ? 'animate-bounce-in' : ''}`}>
                            <div className="bg-accent rounded-full p-1">
                                <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text-primary">Torrent Added</div>
                                <div className="text-xs text-text-secondary">Linux ISO.iso added to download queue.</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-text-secondary w-full text-center self-center">Notifications Disabled</div>
                    )}
                </div>
            </div>
        </SettingsCard>
    );
};
