import React, { useState, useEffect } from 'react';
import { AppOptions } from '@/shared/lib/types';
import { ThemeSettings } from './settings/ThemeSettings';
import { PerformanceSettings } from './settings/PerformanceSettings';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { Palette } from 'lucide-react';
import { LayoutSettings } from './LayoutSettings';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
}

export const AppearanceSettings: React.FC<Props> = ({ settings, updateSettings }) => {
    // Local state for previews
    const [previewTheme, setPreviewTheme] = useState(settings.appearance.theme);

    // Sync local state when settings change
    useEffect(() => {
        setPreviewTheme(settings.appearance.theme);
    }, [settings.appearance.theme]);

    const applyTheme = () => {
        updateSettings({
            ...settings,
            appearance: { ...settings.appearance, theme: previewTheme }
        });
    };

    return (
        <SettingsPageLayout
            title="Appearance & Interface"
            description="Customize the look and feel of the extension, including themes and performance options."
            icon={Palette}
        >
            <ThemeSettings
                settings={settings}
                previewTheme={previewTheme}
                setPreviewTheme={setPreviewTheme as (theme: string) => void}
                applyTheme={applyTheme}
            />

            {/* Sidebar Layout */}
            <LayoutSettings />

            <PerformanceSettings
                settings={settings}
                updateSettings={updateSettings}
            />
        </SettingsPageLayout>
    );
};
