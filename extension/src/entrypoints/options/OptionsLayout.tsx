import React from 'react';
import { Tabs, TabList, Tab, Content } from '@carbon/react';
import { LucideIcon } from 'lucide-react';

export interface NavItem {
    id: string;
    icon?: LucideIcon;
    label: string;
}

interface OptionsLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onViewChange: (view: string) => void;
    primaryItems: readonly NavItem[];
    secondaryItems?: readonly NavItem[];
    headerContent?: React.ReactNode;
}

export const OptionsLayout: React.FC<OptionsLayoutProps> = ({
    children,
    activeView,
    onViewChange,
    primaryItems,
    secondaryItems = [],
    headerContent
}) => {
    const primarySelectedIndex = primaryItems.findIndex(item => item.id === activeView);
    const secondaryActiveId = secondaryItems.find(item => item.id === activeView)?.id;
    const selectedPrimaryIndex = secondaryActiveId ? -1 : (primarySelectedIndex !== -1 ? primarySelectedIndex : 0);

    return (
        <div className="flex flex-col bg-[var(--cds-background)] text-[var(--cds-text-primary)] min-h-screen">
            <div className="sticky top-0 z-50 bg-[var(--cds-layer-01)] border-b border-[var(--cds-border-subtle)] flex items-end">
                <div className="flex-1 flex items-end justify-between overflow-hidden">
                    <Tabs
                        selectedIndex={selectedPrimaryIndex}
                        onChange={({ selectedIndex }) => {
                            const newId = primaryItems[selectedIndex]?.id;
                            if (newId) onViewChange(newId);
                        }}
                    >
                        <TabList aria-label="Global Navigation" contained>
                            {primaryItems.map(item => (
                                <Tab
                                    key={item.id}
                                >
                                    {item.label}
                                </Tab>
                            ))}
                        </TabList>
                    </Tabs>

                    <div className="flex items-center">
                        {secondaryItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => onViewChange(item.id)}
                                aria-pressed={secondaryActiveId === item.id}
                                className={`
                                    h-[40px] px-4 flex items-center gap-2 text-sm font-medium transition-colors
                                    hover:bg-[var(--cds-layer-hover)]
                                    focus:outline focus:outline-2 focus:outline-[var(--cds-focus)] focus:outline-offset-[-2px]
                                    ${secondaryActiveId === item.id
                                        ? 'text-[var(--cds-link-primary)] border-b-[3px] border-b-[var(--cds-interactive-01)]'
                                        : 'text-[var(--cds-text-secondary)] border-b border-[var(--cds-border-subtle)]'}
                                `}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
                {headerContent && (
                    <div className="px-4 border-l border-[var(--cds-border-subtle)] h-[40px] flex items-center bg-[var(--cds-layer-01)] border-b border-[var(--cds-border-subtle)]">
                        {headerContent}
                    </div>
                )}
            </div>

            <Content className="p-0 w-full bg-[var(--cds-background)] flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto bg-[var(--cds-background)]">
                    {children}
                </div>
            </Content>
        </div>
    );
};
