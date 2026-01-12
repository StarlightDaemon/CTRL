import React from 'react';
import { cn } from '@/shared/lib/cn';


export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
    return (
        <div className={cn("bg-panel shadow rounded-lg p-6 border border-border", className)} {...props}>
            {children}
        </div>
    );
};
