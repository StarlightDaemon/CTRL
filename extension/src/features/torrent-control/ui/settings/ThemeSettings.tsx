import React from 'react';
import { Select, SelectItem, SelectItemGroup, Theme } from '@carbon/react';
import { Button } from '@/shared/ui/components/Button';
import { AppOptions } from '@/shared/lib/types';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';

interface Props {
    settings: AppOptions;
    previewTheme: string;
    setPreviewTheme: (theme: string) => void;
    applyTheme: () => void;
}

export const ThemeSettings: React.FC<Props> = ({ settings, previewTheme, setPreviewTheme, applyTheme }) => {
    // Debug IDs
    const applyBtnDebug = useDebugId('settings', 'theme', 'apply-button');
    const themeSelectDebug = useDebugId('settings', 'theme', 'selector');

    // Map legacy themes to Carbon themes for preview
    const getCarbonTheme = (theme: string): 'white' | 'g10' | 'g90' | 'g100' => {
        if (theme === 'light') return 'white';
        if (theme === 'gray') return 'g90';
        if (theme === 'dark' || theme === 'oled') return 'g100';
        return 'g100'; // Default for color editions in preview
    };

    return (
        <SettingsCard
            title="Theme"
            headerActions={
                previewTheme !== settings.appearance.theme && (
                    <Button
                        onClick={applyTheme}
                        size="sm"
                        variant="primary"
                        {...applyBtnDebug}
                    >
                        Apply Theme
                    </Button>
                )
            }
        >
            <div className="space-y-4">
                <Select
                    id="theme-selector"
                    labelText="Choose Theme"
                    hideLabel
                    value={previewTheme}
                    onChange={(e) => setPreviewTheme(e.target.value)}
                    className="w-full"
                    {...themeSelectDebug}
                >
                    <SelectItemGroup label="Standard (Main Line)">
                        <SelectItem value="light" text="Light" />
                        <SelectItem value="gray" text="Gray (Default)" />
                        <SelectItem value="dark" text="Dark" />
                        <SelectItem value="oled" text="OLED (Pure Black)" />
                    </SelectItemGroup>
                    <SelectItemGroup label="Color Edition (CE)">
                        <SelectItem value="midnight" text="Midnight (Purple)" />
                        <SelectItem value="forest" text="Forest (Green)" />
                        <SelectItem value="ocean" text="Ocean (Blue)" />
                        <SelectItem value="sky_blue" text="Sky Blue" />
                    </SelectItemGroup>
                </Select>

                {/* Theme Preview (Mock Popup) */}
                <div className="mt-4 border border-[var(--cds-border-subtle)] rounded-lg overflow-hidden relative">
                    <Theme theme={getCarbonTheme(previewTheme)}>
                        <div className="h-[200px] bg-[var(--cds-background)] p-4 flex flex-col text-[var(--cds-text-primary)]">
                            <div className="flex justify-between items-center mb-4 border-b border-[var(--cds-border-subtle)] pb-2">
                                <span className="font-bold text-sm">Torrent Control</span>
                                <span className="text-[var(--cds-link-primary)] text-xs font-bold">v2.0</span>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="bg-[var(--cds-layer-01)] p-2 rounded border border-[var(--cds-border-subtle)] flex justify-between items-center">
                                    <div className="text-xs">Linux ISO.iso</div>
                                    <div className="text-xs text-[var(--cds-link-primary)]">Downloading</div>
                                </div>
                                <div className="bg-[var(--cds-layer-01)] p-2 rounded border border-[var(--cds-border-subtle)] flex justify-between items-center">
                                    <div className="text-xs">Ubuntu 24.04</div>
                                    <div className="text-xs text-[var(--cds-support-success)]">Seeding</div>
                                </div>
                            </div>
                            <div className="mt-2 flex justify-end">
                                <Button size="sm">Add Torrent</Button>
                            </div>
                        </div>
                    </Theme>
                </div>
                <p className="text-xs text-[var(--cds-text-helper)] text-center">Live Preview (Mockup)</p>
            </div>
        </SettingsCard>
    );
};
