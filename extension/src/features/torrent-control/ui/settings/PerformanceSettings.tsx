import React from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
}

export const PerformanceSettings: React.FC<Props> = ({ settings, updateSettings }) => {
    // Debug IDs
    const performanceSelectDebug = useDebugId('settings', 'performance', 'mode-select');

    return (
        <SettingsCard title="Performance">
            <div className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-2 rounded mb-2 text-xs">
                    Performance mode is locked to <strong>Standard</strong> for testing purposes.
                </div>
                <select
                    value="standard"
                    disabled
                    className="block w-full rounded-md border-border bg-input text-text-secondary shadow-sm cursor-not-allowed opacity-60 sm:text-sm p-2 border"
                    {...performanceSelectDebug}
                >
                    <option value="low">Low (Disabled)</option>
                    <option value="standard">Standard</option>
                    <option value="fancy">Fancy (Disabled)</option>
                </select>

                <div className="bg-surface p-3 rounded border border-border text-sm text-text-secondary">
                    {settings.appearance.performance === 'low' && (
                        <p><strong>Low:</strong> Disables all animations, transparency, and blur effects. Best for older devices or maximum battery life.</p>
                    )}
                    {settings.appearance.performance === 'standard' && (
                        <p><strong>Standard:</strong> A balanced experience with essential transitions and standard transparency. Recommended for most users.</p>
                    )}
                    {settings.appearance.performance === 'fancy' && (
                        <p><strong>Fancy:</strong> Enables glassmorphism (blur), glow effects, and smooth animations. May impact performance on slower devices.</p>
                    )}
                </div>
            </div>
        </SettingsCard>
    );
};
