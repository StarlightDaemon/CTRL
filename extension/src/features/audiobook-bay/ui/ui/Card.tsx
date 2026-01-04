import React from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> { }

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
    return (
        <div className={cn("bg-panel shadow rounded-lg p-6 border border-border", className)} {...props}>
            {children}
        </div>
    );
};
