import React from 'react';
import { LucideIcon } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

export interface SidebarItem {
    id: string;
    icon: LucideIcon;
    label: string;
}

interface SidebarProps {
    items: readonly SidebarItem[];
    activeId: string;
    onSelect: (id: string) => void;
    bottomItems?: readonly SidebarItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ items, activeId, onSelect, bottomItems }) => {
    return (
        <div className="w-16 bg-card border-r border-border flex flex-col items-center py-4 space-y-4 h-full flex-shrink-0">
            {items?.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={twMerge(
                        "p-2 rounded-lg transition-colors relative group",
                        activeId === item.id
                            ? "bg-accent text-white"
                            : "text-text-secondary hover:bg-hover hover:text-text-primary"
                    )}
                    title={item.label}
                >
                    <item.icon size={20} />
                </button>
            ))}

            <div className="flex-1" />

            {bottomItems?.map((item) => (
                <button
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    className={twMerge(
                        "p-2 rounded-lg transition-colors",
                        activeId === item.id
                            ? "bg-accent text-white"
                            : "text-text-secondary hover:bg-hover hover:text-text-primary"
                    )}
                    title={item.label}
                >
                    <item.icon size={20} />
                </button>
            ))}
        </div>
    );
};
