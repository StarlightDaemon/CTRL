import React from 'react';

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
        <div className={`prism-panel p-6 space-y-6 shadow-sm ${className}`}>
            {(title || headerActions || icon) && (
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-start gap-4">
                        {icon && (
                            <div className="p-2 bg-surface rounded-lg mt-1">
                                {icon}
                            </div>
                        )}
                        <div>
                            {title && <h3 className="text-lg font-medium text-primary">{title}</h3>}
                            {description && <p className="text-sm text-secondary">{description}</p>}
                        </div>
                    </div>
                    {headerActions && <div>{headerActions}</div>}
                </div>
            )}
            {children}
        </div>
    );
};
