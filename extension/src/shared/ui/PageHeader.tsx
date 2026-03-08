import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Tabs, TabList, Tab } from '@carbon/react';

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
        <div className="bg-[var(--cds-layer-01)] border-b border-[var(--cds-border-subtle)] sticky top-0 z-20">
            <div className="px-8 pt-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        {Icon && (
                            <div className="p-1.5 rounded-lg bg-[var(--cds-layer-03)] text-[var(--cds-link-primary)]">
                                <Icon size={24} strokeWidth={2} />
                            </div>
                        )}
                        <h1 className="text-2xl font-bold tracking-tight text-[var(--cds-text-primary)]">
                            {title}
                        </h1>
                    </div>
                    {rightContent}
                </div>

                {tabs && tabs.length > 0 && (
                    <div className="-ml-4">
                        <Tabs
                            selectedIndex={tabs.findIndex(t => t.id === activeTab)}
                            onChange={({ selectedIndex }) => onTabChange?.(tabs[selectedIndex].id)}
                        >
                            <TabList aria-label="Page sub-tabs" contained>
                                {tabs.map((tab) => (
                                    <Tab key={tab.id}>{tab.label}</Tab>
                                ))}
                            </TabList>
                        </Tabs>
                    </div>
                )}
            </div>
        </div>
    );
};
