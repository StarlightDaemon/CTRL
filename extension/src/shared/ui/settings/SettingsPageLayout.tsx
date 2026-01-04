import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
    title: string;
    description?: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export const SettingsPageLayout: React.FC<Props> = ({ title, description, icon: Icon, children, actions }) => {
    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-16">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    {Icon && <Icon className="w-8 h-8 text-accent" />}
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
                        {description && <p className="text-text-secondary">{description}</p>}
                    </div>
                </div>
                {actions && <div>{actions}</div>}
            </div>

            <div className="space-y-6">
                {children}
            </div>
        </div>
    );
};
