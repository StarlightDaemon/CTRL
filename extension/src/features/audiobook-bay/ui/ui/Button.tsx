import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', ...props }) => {
    const variants = {
        primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
        secondary: "bg-surface border border-border text-text-primary hover:bg-hover",
        danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
        ghost: "text-text-secondary hover:text-text-primary hover:bg-hover",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base",
    };

    return (
        <button
            className={cn(
                "rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                sizes[size],
                className
            )}
            data-component="Button"
            {...props}
        />
    );
};
