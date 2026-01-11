import React from 'react';
import { LucideIcon } from 'lucide-react';

interface TabItem {
    id: string;
    label: string;
}

interface Props {
    title: string;
    icon?: LucideIcon;
    tabs?: TabItem[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    rightContent?: React.ReactNode;
}

export const PageHeader: React.FC<Props> = ({
    title,
    icon: Icon,
    tabs,
    activeTab,
    onTabChange,
    rightContent
}) => {
    return (
        <div className="bg-panel/80 backdrop-blur-md border-b border-border sticky top-0 z-20 transition-all duration-300">
            <div className="px-8 pt-6 pb-0">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        {Icon && (
                            <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/20 text-accent neon-icon">
                                <Icon size={24} strokeWidth={2.5} />
                            </div>
                        )}
                        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
                            {title}
                        </h1>
                    </div>
                    {rightContent}
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="flex gap-6 relative">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange?.(tab.id)}
                                    className={`
                                        group relative pb-4 px-1 text-sm font-medium transition-colors duration-200
                                        ${isActive ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}
                                    `}
                                >
                                    {tab.label}

                                    {/* Neon Active Indicator */}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-accent shadow-[0_0_10px_var(--accent)] neon-underline"></div>
                                    )}

                                    {/* Hover Indicator (Subtler) */}
                                    {!isActive && (
                                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-border scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left"></div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
