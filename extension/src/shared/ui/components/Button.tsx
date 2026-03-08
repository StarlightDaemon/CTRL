import React from 'react';
import { Button as CarbonButton } from '@carbon/react';
import { cn } from '@/shared/lib/cn';

interface ButtonProps extends Omit<React.ComponentProps<typeof CarbonButton>, 'kind' | 'size'> {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ className, variant = 'primary', size = 'md', children, ...props }) => {
    const kindMap: Record<string, 'primary' | 'secondary' | 'danger' | 'ghost'> = {
        primary: 'primary',
        secondary: 'secondary',
        danger: 'danger',
        ghost: 'ghost',
    };

    return (
        <CarbonButton
            kind={kindMap[variant]}
            size={size}
            className={cn("ctrl-carbon-button-adapter", className)}
            data-component="Button"
            {...props}
        >
            {children}
        </CarbonButton>
    );
};
