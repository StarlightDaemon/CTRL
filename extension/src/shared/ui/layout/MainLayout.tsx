import React from 'react';
import { Sidebar, SidebarItem } from './Sidebar';

interface MainLayoutProps {
    children: React.ReactNode;
    activeView: string;
    onViewChange: (view: string) => void;
    items: readonly SidebarItem[];
    bottomItems?: readonly SidebarItem[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, activeView, onViewChange, items, bottomItems }) => {
    return (
        <div className="flex flex-col h-full bg-background text-text-primary">
            {/* Header */}
            <div className="flex-none h-14 border-b border-border bg-panel flex items-center px-4 justify-between z-10">
                {/* Content for header goes here, e.g., title, user info, etc. */}
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
};
