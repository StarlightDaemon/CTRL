import React from 'react';

interface PageHeaderProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, action }) => {
    return (
        <div className="flex justify-between items-start mb-6">
            <div>
                <h2 className="text-2xl font-bold text-text-primary">{title}</h2>
                {description && <p className="text-text-secondary mt-1">{description}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
};
