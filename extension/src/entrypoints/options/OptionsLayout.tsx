import React from 'react';
import { Sidebar, SidebarItem } from '@/shared/ui/layout/Sidebar';

interface OptionsLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onViewChange: (view: string) => void;
    items: readonly SidebarItem[];
    bottomItems?: readonly SidebarItem[];
}

export const OptionsLayout: React.FC<OptionsLayoutProps> = ({ children, activeView, onViewChange, items, bottomItems }) => {
    return (
        <div className="flex h-screen w-full bg-background text-text-primary overflow-hidden">
            <Sidebar items={items} activeId={activeView} onSelect={onViewChange} bottomItems={bottomItems} />
            <div className="flex-1 flex flex-col overflow-auto min-h-0 bg-background">
                <div className="min-w-[600px] min-h-[500px] h-full flex flex-col">
                    {children}
                </div>
            </div>
        </div>
    );
};
