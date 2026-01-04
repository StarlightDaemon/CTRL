import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { Settings, AlertTriangle, Download, Link, Info } from 'lucide-react';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
}

export const FunctionSettings: React.FC<Props> = ({ settings, updateSettings }) => {
    const handleChange = (field: keyof AppOptions['globals'], value: any) => {
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
    const catchTorrentsDebug = useDebugId('settings', 'function', 'catch-torrents-toggle');
    const badgeInfoDebug = useDebugId('settings', 'function', 'badge-info-select');

    return (
        <SettingsPageLayout
            title="Functions & Behavior"
            description="Configure how the extension behaves, interacts with the browser, and handles downloads."
            icon={Settings}
        >
            <SettingsCard>
                <div className="bg-surface p-3 rounded border border-border text-sm text-text-secondary flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-accent flex-shrink-0" />
                    <p>These settings are <strong>global</strong> and apply to all configured servers and clients.</p>
                </div>
            </SettingsCard>

            <SettingsCard title="General Behavior">
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
            </SettingsCard>

            <SettingsCard title="Browser Integration">
                <SettingsToggle
                    checked={settings.globals.catchTorrents}
                    onChange={() => handleChange('catchTorrents', !settings.globals.catchTorrents)}
                    label="Automatically catch .torrent downloads"
                    description="When enabled, clicking on a .torrent file will automatically open the 'Add Torrent' dialog instead of downloading the file."
                    icon={<Link size={20} />}
                    {...catchTorrentsDebug}
                />
            </SettingsCard>

            <SettingsCard title="Extension Badge">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                        <p className="text-sm text-text-secondary mb-2">Choose what information to display on the extension icon.</p>
                        <select
                            value={settings.globals.badgeInfo}
                            onChange={(e) => handleChange('badgeInfo', e.target.value as any)}
                            className="block w-full rounded-md border-border bg-input text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                            {...badgeInfoDebug}
                        >
                            <option value="none">None</option>
                            <option value="count">Active Torrent Count</option>
                            <option value="speed">Download Speed</option>
                        </select>
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-surface rounded border border-border">
                        <div className="relative">
                            <div className="w-10 h-10 bg-accent rounded-md flex items-center justify-center shadow-lg">
                                <Download className="w-6 h-6 text-white" />
                            </div>
                            {settings.globals.badgeInfo !== 'none' && (
                                <div className="absolute -bottom-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white dark:border-gray-800">
                                    {settings.globals.badgeInfo === 'count' ? '3' : '2.5M'}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-text-secondary mt-2">Preview</p>
                    </div>
                </div>
            </SettingsCard>
        </SettingsPageLayout >
    );
};
