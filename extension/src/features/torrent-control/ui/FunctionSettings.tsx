import React from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { Settings as SettingsIcon, Download, Info } from 'lucide-react';
import { Select, SelectItem, Stack } from '@carbon/react';
import { ContextMenuSettings } from './settings/ContextMenuSettings';
import { NotificationSettings } from './settings/NotificationSettings';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => Promise<void> | void;
    previewContextMenu: number;
    setPreviewContextMenu: (value: number) => void;
    previewCustomOptions: {
        addToClient: boolean;
        pauseResume: boolean;
        openWebUI: boolean;
    };
    setPreviewCustomOptions: (options: { addToClient: boolean; pauseResume: boolean; openWebUI: boolean }) => void;
    applyContextMenu: () => Promise<void>;
    previewServers: ServerConfig[];
    setPreviewServers: (servers: ServerConfig[]) => void;
    previewNotification: boolean;
    setPreviewNotification: (enabled: boolean) => void;
    previewNotificationLevel: string;
    setPreviewNotificationLevel: (level: string) => void;
    applyNotifications: () => Promise<void>;
}

export const FunctionSettings: React.FC<Props> = ({
    settings,
    updateSettings,
    previewContextMenu,
    setPreviewContextMenu,
    previewCustomOptions,
    setPreviewCustomOptions,
    applyContextMenu,
    previewServers,
    setPreviewServers,
    previewNotification,
    setPreviewNotification,
    previewNotificationLevel,
    setPreviewNotificationLevel,
    applyNotifications
}) => {
    const handleChange = (field: keyof AppOptions['globals'], value: AppOptions['globals'][keyof AppOptions['globals']]) => {
        updateSettings({
            ...settings,
            globals: {
                ...settings.globals,
                [field]: value,
            },
        });
    };

    // Debug IDs
    const addPausedDebug = useDebugId('settings', 'function', 'add-paused-toggle');
    const addAdvancedDebug = useDebugId('settings', 'function', 'add-advanced-toggle');
    const badgeInfoDebug = useDebugId('settings', 'function', 'badge-info-select');

    return (
        <SettingsPageLayout
            title="Settings"
            description="Configure extension behavior, browser integration, and notifications."
            icon={SettingsIcon}
        >
            <Stack gap={6}>
                <SettingsCard title="General Behavior">
                    <Stack gap={4}>
                        <SettingsToggle
                            checked={settings.globals.addPaused}
                            onChange={() => handleChange('addPaused', !settings.globals.addPaused)}
                            label="Add torrents paused"
                            icon={<Download size={20} />}
                            {...addPausedDebug}
                        />
                        <SettingsToggle
                            checked={settings.globals.addAdvanced}
                            onChange={() => handleChange('addAdvanced', !settings.globals.addAdvanced)}
                            label="Show advanced dialog when adding"
                            icon={<Info size={20} />}
                            {...addAdvancedDebug}
                        />
                    </Stack>
                </SettingsCard>

                <SettingsCard title="Extension Badge">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                        <Stack gap={4}>
                            <p className="text-sm text-[var(--cds-text-secondary)]">Choose what information to display on the extension icon.</p>
                            <Select
                                id="badge-info-select"
                                labelText="Badge Information"
                                hideLabel
                                value={settings.globals.badgeInfo}
                                onChange={(e) => handleChange('badgeInfo', e.target.value as AppOptions['globals']['badgeInfo'])}
                                {...badgeInfoDebug}
                            >
                                <SelectItem value="none" text="None" />
                                <SelectItem value="count" text="Active Torrent Count" />
                                <SelectItem value="speed" text="Download Speed" />
                            </Select>
                        </Stack>

                        <div className="flex flex-col items-center justify-center p-4 bg-[var(--cds-layer-03)] rounded border border-[var(--cds-border-subtle)]">
                            <div className="relative">
                                <div className="w-10 h-10 bg-[var(--cds-link-primary)] rounded-md flex items-center justify-center shadow-lg">
                                    <Download className="w-6 h-6 text-white" />
                                </div>
                                {settings.globals.badgeInfo !== 'none' && (
                                    <div className="absolute -bottom-2 -right-2 bg-[var(--cds-support-error)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                                        {settings.globals.badgeInfo === 'count' ? '3' : '2.5M'}
                                    </div>
                                )}
                            </div>
                            <p className="text-xs text-[var(--cds-text-helper)] mt-2">Preview</p>
                        </div>
                    </div>
                </SettingsCard>

                <ContextMenuSettings
                    settings={settings}
                    previewContextMenu={previewContextMenu}
                    setPreviewContextMenu={setPreviewContextMenu}
                    previewCustomOptions={previewCustomOptions}
                    setPreviewCustomOptions={setPreviewCustomOptions}
                    applyContextMenu={applyContextMenu}
                    previewServers={previewServers}
                    setPreviewServers={setPreviewServers}
                />

                <NotificationSettings
                    settings={settings}
                    previewNotification={previewNotification}
                    setPreviewNotification={setPreviewNotification}
                    previewNotificationLevel={previewNotificationLevel}
                    setPreviewNotificationLevel={setPreviewNotificationLevel}
                    applyNotifications={applyNotifications}
                    updateSettings={updateSettings}
                />
            </Stack >
        </SettingsPageLayout >
    );
};
