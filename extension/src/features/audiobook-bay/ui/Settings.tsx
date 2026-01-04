import React from 'react';
import { useABBSettings } from '@/features/audiobook-bay/model/useABBSettings';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';
import { GeneralSettings } from './GeneralSettings';
import { MirrorManager } from './MirrorManager';
import { CategoryList } from './CategoryList';
import { BookHeadphones, Globe, List } from 'lucide-react';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

export const AudioBookBaySettings = () => {
    const { settings, updateSettings } = useABBSettings();
    const globalToggleDebug = useDebugId('abb', 'settings', 'global-toggle');

    if (!settings) return <div className="p-8 text-center text-text-secondary">Loading settings...</div>;

    const toggleEnabled = () => {
        updateSettings({ ...settings, enabled: !settings.enabled });
    };

    return (
        <SettingsPageLayout
            title="AudioBook Bay Settings"
            description="Manage mirrors, categories, and general preferences."
            icon={BookHeadphones}
        >
            <SettingsCard title="Global">
                <SettingsToggle
                    label="Enable Integration"
                    description="Turn on/off all CTRL features for AudioBook Bay"
                    checked={settings.enabled}
                    onChange={toggleEnabled}
                    {...globalToggleDebug}
                />
            </SettingsCard>

            <div className={`space-y-8 ${settings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
                {/* General Section */}
                <GeneralSettings settings={settings} updateSettings={updateSettings} embed />

                {/* Mirrors Section */}
                <SettingsCard title="Custom Mirrors" icon={<Globe className="w-5 h-5 text-blue-400" />}>
                    <p className="text-sm text-text-secondary mb-4">
                        Add proxy URLs if the main site is blocked in your region.
                    </p>
                    <MirrorManager settings={settings} updateSettings={updateSettings} />
                </SettingsCard>

                {/* Categories Section */}
                <SettingsCard title="Category Visibility" icon={<List className="w-5 h-5 text-green-400" />}>
                    <p className="text-sm text-text-secondary mb-4">
                        Hide specific categories from search results and listings.
                    </p>
                    <CategoryList settings={settings} updateSettings={updateSettings} />
                </SettingsCard>
            </div>
        </SettingsPageLayout>
    );
};
