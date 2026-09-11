import React from 'react';
import { Toggle, Stack } from '@carbon/react';

interface Props {
    /**
     * Stable id. The switch gets this id; its visible label is `${id}-label`
     * and its description, when present, `${id}-description`.
     */
    id: string;
    checked: boolean;
    onChange: () => void;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    'data-debug-id'?: string;
    'data-component'?: string;
}

/**
 * A labelled on/off setting. The visible text is a real `<label>` bound to
 * the switch, so clicking it toggles the setting and assistive technology
 * announces the setting's name rather than "On"/"Off".
 */
export const SettingsToggle: React.FC<Props> = ({ id, checked, onChange, label, description, icon, ...rest }) => {
    const labelId = `${id}-label`;
    const descriptionId = description ? `${id}-description` : undefined;
    return (
        <div className="flex items-center justify-between gap-4 p-4 rounded bg-[var(--cds-layer-01)] hover:bg-[var(--cds-layer-hover-01)] transition-colors border border-[var(--cds-border-subtle)]">
            <div className="flex items-center space-x-4 min-w-0">
                {icon && (
                    <div className="p-2 rounded bg-[var(--cds-layer-03)] text-[var(--cds-link-primary)]" aria-hidden="true">
                        {icon}
                    </div>
                )}
                <Stack gap={0}>
                    <label id={labelId} htmlFor={id} className="font-medium text-[var(--cds-text-primary)] cursor-pointer">
                        {label}
                    </label>
                    {description && (
                        <p id={descriptionId} className="text-sm text-[var(--cds-text-secondary)] m-0">{description}</p>
                    )}
                </Stack>
            </div>
            <Toggle
                id={id}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
                labelA="Off"
                labelB="On"
                toggled={checked}
                onToggle={onChange}
                size="sm"
                {...rest}
            />
        </div>
    );
};
