import React from 'react';
import { cn } from '@/shared/lib/cn';

interface BentoGridProps {
    className?: string;
    children?: React.ReactNode;
}

export const BentoGrid = ({ className, children }: BentoGridProps) => {
    return (
        <div
            className={cn(
                "grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto",
                className
            )}
        >
            {children}
        </div>
    );
};

interface BentoCardProps {
    className?: string;
    title?: string;
    description?: React.ReactNode;
    header?: React.ReactNode;
    children?: React.ReactNode;
    icon?: React.ReactNode;
    headerAction?: React.ReactNode;
}

export const BentoCard = ({ className, title, description, header, children, icon, headerAction }: BentoCardProps) => {
    return (
        <div
            className={cn(
                "row-span-1 rounded-xl group/bento hover:shadow-xl transition duration-200 shadow-input dark:shadow-none p-4 bg-panel border-white/[0.1] border justify-between flex flex-col space-y-4",
                className
            )}
        >
            {header}
            <div className="group-hover/bento:translate-x-2 transition duration-200">
                {(title || icon || headerAction) && (
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 text-text-primary font-bold">
                            {icon}
                            <span>{title}</span>
                        </div>
                        {headerAction}
                    </div>
                )}
                <div className="font-sans font-normal text-text-secondary text-xs">
                    {description}
                </div>
                {children}
            </div>
        </div>
    );
};
