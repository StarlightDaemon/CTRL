import React, { useEffect, useState } from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { Magnet, Layers, Type, Image, Film, Ban, Maximize, Zap } from 'lucide-react';
import { OneThreeThreeSevenXOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';

export const OneThreeThreeSevenXSettings = () => {
    const { settings, updateSettings, loading } = useSettings();
    const [config, setConfig] = useState<OneThreeThreeSevenXOptions | undefined>(settings?.['1337x']);

    useEffect(() => {
        if (settings?.['1337x']) {
            setConfig(settings['1337x']);
        }
    }, [settings]);

    if (loading) {
        return <div className="p-8 text-center text-text-secondary">Loading settings...</div>;
    }

    if (!config && settings) {
        return <div className="p-8 text-center text-red-500">Error loading 1337x settings. Please reset settings.</div>;
    }

    if (!config) return null;

    const handleToggle = async (section: keyof OneThreeThreeSevenXOptions | 'enabled', key?: string | boolean) => {
        if (!settings || !config) return;

        let newConfig: OneThreeThreeSevenXOptions;

        if (section === 'enabled') {
            newConfig = { ...config, enabled: key as boolean };
        } else {
            const subSection = config[section] as any;
            const newSection = { ...subSection, [key as string]: !subSection[key as string] };
            newConfig = { ...config, [section]: newSection };
        }

        setConfig(newConfig);

        await updateSettings({
            ...settings,
            '1337x': newConfig
        });
    };

    const handleNestedToggle = (section: 'listView' | 'detailPage', key: string) => {
        handleToggle(section, key);
    };

    return (
        <SettingsPageLayout
            title="1337x Settings"
            description="Customize your experience on 1337x.to."
            icon={Zap}
        >
            <SettingsCard title="Global">
                <SettingsToggle
                    label="Enable Integration"
                    description="Turn on/off all CTRL features for 1337x"
                    checked={config.enabled}
                    onChange={() => handleToggle('enabled', !config.enabled)}
                />
            </SettingsCard>

            <div className={config.enabled ? '' : 'opacity-50 pointer-events-none'}>
                <SettingsCard title="List View Enhancements">
                    <SettingsToggle
                        checked={config.listView.addMagnetLinks}
                        onChange={() => handleNestedToggle('listView', 'addMagnetLinks')}
                        label="Magnet Links"
                        description="Add direct magnet download buttons to list items"
                        icon={<Magnet size={20} className="text-red-500" />}
                    />

                    <SettingsToggle
                        checked={config.listView.batchActions}
                        onChange={() => handleNestedToggle('listView', 'batchActions')}
                        label="Batch Actions"
                        description="Select multiple torrents to copy magnet links at once"
                        icon={<Layers size={20} className="text-blue-500" />}
                    />

                    <SettingsToggle
                        checked={config.listView.cleanTitles}
                        onChange={() => handleNestedToggle('listView', 'cleanTitles')}
                        label="Clean Titles"
                        description="Highlight the release name and dim other tags"
                        icon={<Type size={20} className="text-green-500" />}
                    />

                    <SettingsToggle
                        checked={config.listView.showImages}
                        onChange={() => handleNestedToggle('listView', 'showImages')}
                        label="Show Images"
                        description="Display thumbnail previews in the list (if available)"
                        icon={<Image size={20} className="text-purple-500" />}
                    />
                </SettingsCard>

                <SettingsCard title="Detail Page Enhancements">
                    <SettingsToggle
                        checked={config.detailPage.showImdb}
                        onChange={() => handleNestedToggle('detailPage', 'showImdb')}
                        label="Show IMDb Info"
                        description="Fetch and display IMDb rating and summary"
                        icon={<Film size={20} className="text-yellow-500" />}
                    />



                    <SettingsToggle
                        checked={config.detailPage.fullWidth}
                        onChange={() => handleNestedToggle('detailPage', 'fullWidth')}
                        label="Full Width Layout"
                        description="Expand the container to use full screen width"
                        icon={<Maximize size={20} className="text-cyan-500" />}
                    />
                </SettingsCard>
            </div>
        </SettingsPageLayout>
    );
};
