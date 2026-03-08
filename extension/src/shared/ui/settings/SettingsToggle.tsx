import React from 'react';
import { Toggle, Stack } from '@carbon/react';

interface Props {
    checked: boolean;
    onChange: () => void;
    label?: string;
    description?: string;
    icon?: React.ReactNode;
}

export const SettingsToggle: React.FC<Props> = ({ checked, onChange, label, description, icon }) => {
    return (
        <div className="flex items-center justify-between p-4 rounded bg-[var(--cds-layer-01)] hover:bg-[var(--cds-layer-hover-01)] transition-colors border border-[var(--cds-border-subtle)]">
            <div className="flex items-center space-x-4">
                {icon && (
                    <div className="p-2 rounded bg-[var(--cds-layer-03)] text-[var(--cds-link-primary)]">
                        {icon}
                    </div>
                )}
                <Stack gap={0}>
                    <h4 className="font-medium text-[var(--cds-text-primary)]">{label}</h4>
                    {description && <p className="text-sm text-[var(--cds-text-secondary)]">{description}</p>}
                </Stack>
            </div>
            <Toggle
                id={`toggle-${label?.replace(/\s+/g, '-').toLowerCase() || Math.random()}`}
                labelA=""
                labelB=""
                hideLabel
                toggled={checked}
                onToggle={onChange}
                size="sm"
            />
        </div>
    );
};
