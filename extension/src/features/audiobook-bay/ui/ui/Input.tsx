import React from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input: React.FC<InputProps> = ({ className, label, ...props }) => {
    return (
        <div className="space-y-1" data-component="Input">
            {label && <label className="block text-sm font-medium text-text-secondary">{label}</label>}
            <input
                className={cn(
                    "block w-full rounded-md border-border bg-input text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border transition-colors",
                    className
                )}
                {...props}
            />
        </div>
    );
};
