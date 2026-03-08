import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Stack } from '@carbon/react';

interface Props {
    title: string;
    description?: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export const SettingsPageLayout: React.FC<Props> = ({ title, description, icon: Icon, children, actions }) => {
    return (
        <div className="max-w-5xl mx-auto px-8 pb-16 pt-8">
            <Stack gap={8}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        {Icon && (
                            <div className="p-2.5 bg-[var(--cds-layer-03)] rounded text-[var(--cds-link-primary)]">
                                <Icon size={24} />
                            </div>
                        )}
                        <Stack gap={1}>
                            <h2 className="text-2xl font-semibold text-[var(--cds-text-primary)]">{title}</h2>
                            {description && <p className="text-[var(--cds-text-secondary)]">{description}</p>}
                        </Stack>
                    </div>
                    {actions && <div>{actions}</div>}
                </div>

                <Stack gap={7}>
                    {children}
                </Stack>
            </Stack>
        </div>
    );
};
