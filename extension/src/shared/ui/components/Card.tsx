import React from 'react';
import { cn } from '@/shared/lib/cn';


export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
    return (
        <div className={cn("bg-layer-01 shadow rounded-lg p-6 border border-subtle", className)} {...props}>
            {children}
        </div>
    );
};
