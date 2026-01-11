import React from 'react';
import { AppOptions } from '@/shared/lib/types';

interface SidebarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    settings: AppOptions;
}

import { Logo } from '@/shared/ui/Logo';

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, settings }) => {
    const navItems = [
        { id: 'servers', label: 'Servers', icon: '🖥️' },
        { id: 'functions', label: 'Functions', icon: '⚡' },
        { id: 'appearance', label: 'Appearance', icon: '🎨' },
        { id: 'backup', label: 'Backup & Restore', icon: '💾' },
        ...(settings?.globals?.showDiagnostics ? [{ id: 'diagnostics', label: 'Diagnostics', icon: '🔧' }] : []),
        { id: 'about', label: 'About', icon: 'ℹ️' },
    ];

    return (
        <nav className="w-64 bg-secondary text-text-primary h-screen flex flex-col fixed left-0 top-0 border-r border-border">
            <div className="p-6 flex items-center space-x-3 border-b border-border">
                <Logo className="w-8 h-8 text-text-primary" />
                <span className="font-bold text-lg">Torrent Control</span>
            </div>

            <ul className="flex-1 py-4">
                {navItems.map((item) => (
                    <li key={item.id}>
                        <button
                            className={`w-full px-6 py-3 cursor-pointer flex items-center space-x-3 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${activeTab === item.id
                                ? 'bg-accent text-white'
                                : 'text-text-secondary hover:bg-card hover:text-primary'
                                }`}
                            onClick={() => setActiveTab(item.id)}
                            aria-label={item.label}
                            aria-current={activeTab === item.id ? 'page' : undefined}
                        >
                            <span aria-hidden="true">{item.icon}</span>
                            <span>{item.label}</span>
                        </button>
                    </li>
                ))}
            </ul>

            <div className="p-4 border-t border-border">
                <div className="text-xs text-text-secondary text-center">
                    v{chrome.runtime.getManifest().version}
                </div>
            </div>
        </nav>
    );
};
