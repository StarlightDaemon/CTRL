import React from 'react';
import { Grid, Tile } from '@carbon/react';
import { cn } from '@/shared/lib/cn';

// BentoGrid container wrapper removed in favor of direct Grid usage
// BentoCard remains as a convenience wrapper around Tile for title/icon headers

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
        <Tile
            className={cn(
                "h-full flex flex-col justify-between transition duration-200 p-4",
                "bg-layer-01 border-none", // Explicit Carbon Layer 01
                className
            )}
        >
            {header}
            <div className="group-hover/bento:translate-x-2 transition duration-200">
                {(title || icon || headerAction) && (
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2 text-text-primary font-bold">
                            {icon}
                            <span>{title}</span>
                        </div>
                        {headerAction}
                    </div>
                )}
                {description && (
                    <div className="font-sans font-normal text-text-secondary text-xs mb-2">
                        {description}
                    </div>
                )}
                {children}
            </div>
        </Tile>
    );
};
