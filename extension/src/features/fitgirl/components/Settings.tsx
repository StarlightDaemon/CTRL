import React, { useEffect, useState } from 'react';
import { useSettings } from '@/features/torrent-control/model/useSettings';
import { Moon, MousePointer, Image, Film, ShieldAlert, Magnet, Infinity as InfinityIcon } from 'lucide-react';
import { FitGirlOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';

export const FitGirlSettings = () => {
    const { settings, updateSettings, loading } = useSettings();
    const [config, setConfig] = useState<FitGirlOptions | undefined>(settings?.fitgirl);

    useEffect(() => {
        if (settings?.fitgirl) {
            setConfig(settings.fitgirl);
        }
    }, [settings]);

    if (loading) {
        return <div className="p-8 text-center text-text-secondary">Loading settings...</div>;
    }

    if (!config && settings) {
        return <div className="p-8 text-center text-red-500">Error loading FitGirl settings. Please reset settings.</div>;
    }

    if (!config) return null;

    const handleToggle = async (key: keyof FitGirlOptions) => {
        if (!settings || !config) return;

        const newConfig = { ...config, [key]: !config[key] };
        setConfig(newConfig);

        await updateSettings({
            ...settings,
            fitgirl: newConfig
        });
    };

    return (
        <SettingsPageLayout
            title="FitGirl Repacks Settings"
            description="Customize your experience on FitGirl-Repacks.site."
            icon={Image}
        >
            <SettingsCard title="Global">
                <SettingsToggle
                    label="Enable Integration"
                    description="Turn on/off all CTRL features for FitGirl"
                    checked={config.enabled}
                    onChange={() => handleToggle('enabled')}
                />
            </SettingsCard>

            <div className={config.enabled ? '' : 'opacity-50 pointer-events-none'}>
                <SettingsCard title="Browsing Enhancements">
                    <SettingsToggle
                        checked={config.autoDarkMode}
                        onChange={() => handleToggle('autoDarkMode')}
                        label="Auto Dark Mode"
                        description="Automatically switch to a dark theme based on system preference"
                        icon={<Moon size={20} className="text-blue-500" />}
                    />

                    <SettingsToggle
                        checked={config.infiniteScroll}
                        onChange={() => handleToggle('infiniteScroll')}
                        label="Infinite Scroll"
                        description="Automatically load the next page of results as you scroll down"
                        icon={<InfinityIcon size={20} className="text-purple-500" />}
                    />

                    <SettingsToggle
                        checked={config.redirectFakeSites}
                        onChange={() => handleToggle('redirectFakeSites')}
                        label="Anti-Fake Redirect"
                        description="Automatically redirect from known fake sites to the official one"
                        icon={<ShieldAlert size={20} className="text-red-500" />}
                    />
                </SettingsCard>

                <SettingsCard title="Content Enhancements">
                    <SettingsToggle
                        checked={config.magnetLinks}
                        onChange={() => handleToggle('magnetLinks')}
                        label="Enhance Magnet Links"
                        description="Add direct magnet buttons where missing and improve visibility"
                        icon={<Magnet size={20} className="text-green-500" />}
                    />

                    <SettingsToggle
                        checked={config.showTrailers}
                        onChange={() => handleToggle('showTrailers')}
                        label="YouTube Trailer Links"
                        description="Add a quick link to search for the game's trailer on YouTube"
                        icon={<Film size={20} className="text-red-500" />}
                    />
                </SettingsCard>
            </div>
        </SettingsPageLayout>
    );
};
