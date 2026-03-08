import React from 'react';
import { Select, SelectItem, InlineNotification } from '@carbon/react';
import { AppOptions } from '@/shared/lib/types';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';

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
                <InlineNotification
                    kind="warning"
                    lowContrast
                    title="Locked"
                    subtitle="Performance mode is locked to Standard for testing purposes."
                    hideCloseButton
                />

                <Select
                    id="performance-select"
                    labelText="Performance Mode"
                    hideLabel
                    value="standard"
                    disabled
                    className="w-full"
                    {...performanceSelectDebug}
                >
                    <SelectItem value="low" text="Low (Disabled)" />
                    <SelectItem value="standard" text="Standard" />
                    <SelectItem value="fancy" text="Fancy (Disabled)" />
                </Select>

                <div className="bg-[var(--cds-layer-03)] p-3 rounded border border-[var(--cds-border-subtle)] text-sm text-[var(--cds-text-secondary)]">
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
