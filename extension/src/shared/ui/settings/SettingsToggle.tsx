import React from 'react';

interface Props {
    checked: boolean;
    onChange: () => void;
    label?: string;
    description?: string;
    icon?: React.ReactNode;
}

export const SettingsToggle: React.FC<Props> = ({ checked, onChange, label, description, icon }) => {
    const renderSwitch = () => (
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
            <input
                type="checkbox"
                className="sr-only peer"
                checked={checked}
                onChange={onChange}
            />
            <div className="ctrl-toggle-track w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
        </label>
    );

    if (!label) {
        return renderSwitch();
    }

    return (
        <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors">
            <div className="flex items-center space-x-4">
                {icon && (
                    <div className="p-2 rounded-lg bg-accent/10 text-accent">
                        {icon}
                    </div>
                )}
                <div>
                    <h4 className="font-medium text-text-primary">{label}</h4>
                    {description && <p className="text-sm text-text-secondary">{description}</p>}
                </div>
            </div>
            {renderSwitch()}
        </div>
    );
};
