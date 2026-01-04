import React from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { Layers, Magnet, Type, Zap } from 'lucide-react';
import { TorrentGalaxyOptions } from '@/shared/lib/types';

export const TorrentGalaxySettings = () => {
    const { settings, updateSettings, loading } = useSettings();

    // Default config if missing
    const defaultConfig: TorrentGalaxyOptions = {
        enabled: true,
        qualityFilter: true,
        magnetEnhancer: true,
        titleNormalizer: true
    };

    const config = settings?.torrent_galaxy || defaultConfig;

    if (loading) {
        return <div className="p-8 text-center text-text-secondary">Loading settings...</div>;
    }

    if (!settings) return null;

    const handleUpdate = async (key: keyof TorrentGalaxyOptions, value: boolean) => {
        const newConfig = { ...config, [key]: value };
        await updateSettings({
            ...settings,
            torrent_galaxy: newConfig
        });
    };

    return (
        <SettingsPageLayout
            title="TorrentGalaxy Settings"
            description="Customize your experience on torrentgalaxy.to"
            icon={Zap}
        >
            <SettingsCard title="Global">
                <SettingsToggle
                    label="Enable Integration"
                    description="Turn on/off all CTRL features for TorrentGalaxy"
                    checked={config.enabled}
                    onChange={() => handleUpdate('enabled', !config.enabled)}
                />
            </SettingsCard>

            <div className={config.enabled ? '' : 'opacity-50 pointer-events-none'}>
                <SettingsCard title="Features">
                    <SettingsToggle
                        label="Quality Filter Sidebar"
                        description="Show the 1080p/4K filter panel on search results"
                        checked={config.qualityFilter}
                        onChange={() => handleUpdate('qualityFilter', !config.qualityFilter)}
                        icon={<Layers size={20} className="text-blue-500" />}
                    />
                    <SettingsToggle
                        label="Magnet Enhancer"
                        description="Inject 'Add to CTRL' buttons and healthy trackers"
                        checked={config.magnetEnhancer}
                        onChange={() => handleUpdate('magnetEnhancer', !config.magnetEnhancer)}
                        icon={<Magnet size={20} className="text-red-500" />}
                    />
                    <SettingsToggle
                        label="Title Normalizer"
                        description="Clean up torrent titles (remove 'TGx:' prefix, fix spacing)"
                        checked={config.titleNormalizer}
                        onChange={() => handleUpdate('titleNormalizer', !config.titleNormalizer)}
                        icon={<Type size={20} className="text-green-500" />}
                    />
                </SettingsCard>
            </div>
        </SettingsPageLayout>
    );
};
