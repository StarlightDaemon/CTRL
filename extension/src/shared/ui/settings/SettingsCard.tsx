import React from 'react';
import { Tile, Stack } from '@carbon/react';
import { cn } from '@/shared/lib/cn';

interface Props {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    headerActions?: React.ReactNode;
    icon?: React.ReactNode;
}

export const SettingsCard: React.FC<Props> = ({ title, description, children, className = '', headerActions, icon }) => {
    return (
        <Tile className={cn("p-6", className)}>
            <Stack gap={6}>
                {(title || headerActions || icon) && (
                    <div className="flex justify-between items-start">
                        <div className="flex items-start gap-4">
                            {icon && (
                                <div className="p-2 bg-[var(--cds-layer-03)] rounded-lg mt-1">
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && <h3 className="text-lg font-medium text-[var(--cds-text-primary)]">{title}</h3>}
                                {description && <p className="text-sm text-[var(--cds-text-secondary)]">{description}</p>}
                            </div>
                        </div>
                        {headerActions && <div>{headerActions}</div>}
                    </div>
                )}
                <div className="w-full">
                    {children}
                </div>
            </Stack>
        </Tile>
    );
};
