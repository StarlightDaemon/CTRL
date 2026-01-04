import React, { useEffect, useState } from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { Moon, MousePointer, Layers, Ghost } from 'lucide-react';
import { NyaaOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';

export const NyaaSettings = () => {
    const { settings, updateSettings, loading } = useSettings();
    const [config, setConfig] = useState<NyaaOptions | undefined>(settings?.nyaa);

    useEffect(() => {
        if (settings?.nyaa) {
            setConfig(settings.nyaa);
        }
    }, [settings]);

    if (loading) {
        return <div className="p-8 text-center text-text-secondary">Loading settings...</div>;
    }

    if (!config && settings) {
        return <div className="p-8 text-center text-red-500">Error loading Nyaa settings. Please reset settings.</div>;
    }

    if (!config) return null;

    const handleToggle = async (key: keyof NyaaOptions) => {
        if (!settings || !config) return;

        const newConfig = { ...config, [key]: !config[key] };
        setConfig(newConfig);

        await updateSettings({
            ...settings,
            nyaa: newConfig
        });
    };

    return (
        <SettingsPageLayout
            title="Nyaa (Reloaded) Settings"
            description="Customize your experience on Nyaa.si."
            icon={Ghost}
        >
            <SettingsCard title="Global">
                <SettingsToggle
                    label="Enable Integration"
                    description="Turn on/off all CTRL features for Nyaa"
                    checked={config.enabled}
                    onChange={() => handleToggle('enabled')}
                />
            </SettingsCard>

            <div className={config.enabled ? '' : 'opacity-50 pointer-events-none'}>
                <SettingsCard title="List View Enhancements">
                    <SettingsToggle
                        checked={config.autoDarkMode}
                        onChange={() => handleToggle('autoDarkMode')}
                        label="Auto Dark Mode"
                        description="Automatically switch theme based on system preference"
                        icon={<Moon size={20} className="text-blue-500" />}
                    />

                    <SettingsToggle
                        checked={config.batchActions}
                        onChange={() => handleToggle('batchActions')}
                        label="Batch Actions"
                        description="Select multiple torrents to copy magnet links at once"
                        icon={<Layers size={20} className="text-green-500" />}
                    />

                    <SettingsToggle
                        checked={config.hoverPreviews}
                        onChange={() => handleToggle('hoverPreviews')}
                        label="Hover Previews"
                        description="Show images and description when hovering over torrent links"
                        icon={<MousePointer size={20} className="text-purple-500" />}
                    />

                    <SettingsToggle
                        checked={config.highlightDeadTorrents}
                        onChange={() => handleToggle('highlightDeadTorrents')}
                        label="Highlight Dead Torrents"
                        description="Gray out torrents with 0 seeders"
                        icon={<Ghost size={20} className="text-red-500" />}
                    />
                </SettingsCard>
            </div>
        </SettingsPageLayout>
    );
};
