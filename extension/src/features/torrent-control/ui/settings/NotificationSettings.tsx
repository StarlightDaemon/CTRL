import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { CheckCircle } from 'lucide-react';
import { Select, SelectItem, Button, Stack } from '@carbon/react';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    previewNotification: boolean;
    setPreviewNotification: (enabled: boolean) => void;
    previewNotificationLevel: string;
    setPreviewNotificationLevel: (level: string) => void;
    applyNotifications: () => void;
    updateSettings: (newSettings: AppOptions) => Promise<void> | void;
}

export const NotificationSettings: React.FC<Props> = ({
    settings,
    previewNotification,
    setPreviewNotification,
    previewNotificationLevel,
    setPreviewNotificationLevel,
    applyNotifications,
    updateSettings
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
                    <Button
                        onClick={applyNotifications}
                        size="sm"
                        {...applyBtnDebug}
                    >
                        Apply
                    </Button>
                )
            }
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Stack gap={5}>
                    <SettingsToggle
                        checked={previewNotification}
                        onChange={() => setPreviewNotification(!previewNotification)}
                        label="Enable Notifications"
                        {...enableToggleDebug}
                    />

                    {previewNotification && (
                        <Stack gap={5} className="pt-4 border-t border-[var(--cds-border-subtle)]">
                            <Select
                                id="notification-level"
                                labelText="Notification Level"
                                value={previewNotificationLevel}
                                onChange={(e) => setPreviewNotificationLevel(e.target.value)}
                                {...levelSelectDebug}
                            >
                                <SelectItem value="standard" text="Standard (Success & Errors)" />
                                <SelectItem value="verbose" text="Verbose (Detailed Steps)" />
                                <SelectItem value="error" text="Errors Only" />
                            </Select>

                            <Select
                                id="notification-style"
                                labelText="Notification Style"
                                value={settings.globals.notificationStyle}
                                onChange={(e) => updateSettings({ ...settings, globals: { ...settings.globals, notificationStyle: e.target.value as any } })}
                                {...styleSelectDebug}
                            >
                                <SelectItem value="toast" text="Toast (Bottom Right)" />
                                <SelectItem value="banner" text="Banner (Top Width)" />
                                <SelectItem value="modal" text="Modal (Center Alert)" />
                            </Select>
                        </Stack>
                    )}
                </Stack>

                {/* Notification Mockup */}
                <div className="border border-[var(--cds-border-subtle)] rounded-lg bg-[var(--cds-layer-01)] p-4 relative h-32 flex items-end justify-end overflow-hidden">
                    {previewNotification ? (
                        <div className="bg-[var(--cds-layer-03)] border border-[var(--cds-border-subtle)] shadow-lg rounded p-3 flex items-start space-x-3 w-64 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-[var(--cds-support-success)] rounded-full p-1">
                                <CheckCircle className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-[var(--cds-text-primary)]">Torrent Added</div>
                                <div className="text-xs text-[var(--cds-text-secondary)]">Linux ISO.iso added to download queue.</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-[var(--cds-text-helper)] w-full text-center self-center">Notifications Disabled</div>
                    )}
                </div>
            </div>
        </SettingsCard>
    );
};
