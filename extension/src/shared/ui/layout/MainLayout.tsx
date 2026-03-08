import React from 'react';

interface MainLayoutProps {
    children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    return (
        <div className="flex flex-col h-full bg-background text-text-primary">
            {/* Header */}
            <div className="flex-none h-14 border-b border-subtle bg-layer-01 flex items-center px-4 justify-between z-10">
                {/* Content for header goes here, e.g., title, user info, etc. */}
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
                {children}
            </div>
        </div>
    );
};
