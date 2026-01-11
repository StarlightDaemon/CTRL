import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

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

    return (
        <SettingsCard
            title="Theme"
            headerActions={
                previewTheme !== settings.appearance.theme && (
                    <button
                        onClick={applyTheme}
                        className="bg-accent text-white px-3 py-1.5 rounded text-sm hover:bg-accent-hover transition-colors"
                        {...applyBtnDebug}
                    >
                        Apply Theme
                    </button>
                )
            }
        >
            <div className="space-y-4">
                <select
                    value={previewTheme}
                    onChange={(e) => setPreviewTheme(e.target.value)}
                    className="block w-full rounded-md border-border bg-surface text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                    {...themeSelectDebug}
                >
                    <optgroup label="Standard (Main Line)">
                        <option value="light">Light</option>
                        <option value="gray">Gray (Default)</option>
                        <option value="dark">Dark</option>
                        <option value="oled">OLED (Pure Black)</option>
                    </optgroup>
                    <optgroup label="Color Edition (CE)">
                        <option value="midnight">Midnight (Purple)</option>
                        <option value="forest">Forest (Green)</option>
                        <option value="ocean">Ocean (Blue)</option>
                        <option value="sky_blue">Sky Blue</option>
                    </optgroup>
                </select>

                {/* Theme Preview (Mock Popup) */}
                <div
                    className="mt-4 border border-border rounded-lg overflow-hidden relative transition-colors duration-300"
                    style={{ height: '200px' }}
                    data-theme={previewTheme}
                >
                    <div className="absolute inset-0 bg-background p-4 flex flex-col">
                        <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                            <span className="font-bold text-text-primary text-sm">Torrent Control</span>
                            <span className="text-accent text-xs">v2.0</span>
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className={`bg-panel p-2 rounded border border-border flex justify-between items-center ${settings.appearance.performance !== 'low' ? 'animate-pulse' : ''}`}>
                                <div className="text-xs text-text-primary">Linux ISO.iso</div>
                                <div className="text-xs text-accent">Downloading</div>
                            </div>
                            <div className="bg-panel p-2 rounded border border-border flex justify-between items-center">
                                <div className="text-xs text-text-primary">Ubuntu 24.04</div>
                                <div className="text-xs text-green-500">Seeding</div>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-end">
                            <button className="bg-accent text-white px-3 py-1 rounded text-xs">Add Torrent</button>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-text-secondary text-center">Live Preview (Mockup)</p>
            </div>
        </SettingsCard>
    );
};
