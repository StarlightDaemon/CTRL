import React, { useState } from 'react';
import { PrismThemeProvider } from '@/app/providers/ThemeProvider';
import { MainLayout } from '@/shared/ui/layout/MainLayout';
import { Dashboard } from '../../features/torrent-control/ui/Dashboard';
import { Download, Settings, Bug, Activity } from 'lucide-react';
import { VersionOverlay } from '@/shared/ui/VersionOverlay';

type ViewType = 'torrents' | 'settings' | 'debug';

const Popup = () => {
    const [activeView, setActiveView] = useState<ViewType>('torrents');

    const navItems = [
        { id: 'torrents', icon: Activity, label: 'Control' },
        ...(typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__ ? [{ id: 'debug', icon: Bug, label: 'Debug' }] : []),
    ];

    const bottomItems = [
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    const renderContent = () => {
        switch (activeView) {
            case 'torrents':
                return <Dashboard />;
            case 'settings':
                return (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <div className="text-center p-6">
                            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50 text-accent" />
                            <h2 className="text-lg font-bold mb-2 text-text-primary">Global Settings</h2>
                            <p className="text-sm mb-4">Configure extension behavior and integrations.</p>
                            <button
                                onClick={() => chrome.runtime.openOptionsPage()}
                                className="bg-accent text-white px-6 py-2 rounded-full hover:bg-accent-hover transition-all shadow-lg hover:shadow-accent/50 font-medium"
                            >
                                Open Options Dashboard
                            </button>
                        </div>
                    </div>
                );
            case 'debug':
                return (
                    <div className="flex flex-col h-full bg-panel text-text-primary p-4 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            <Bug className="text-accent" />
                            <h2 className="text-lg font-bold">Debug Tools</h2>
                        </div>

                        <div className="bg-surface/50 p-4 rounded-xl border border-border space-y-3">
                            <h3 className="font-medium text-sm text-text-secondary uppercase tracking-wider">UI Inspection</h3>
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('TOGGLE_UI_DEBUG'))}
                                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-lg transition-all flex items-center justify-between group border border-slate-700"
                            >
                                <span className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-green-400" />
                                    <span>Toggle Overlay</span>
                                </span>
                                <span className="bg-slate-900 text-xs px-2 py-1 rounded text-slate-400 group-hover:text-white transition-colors">Ctrl+Shift+U</span>
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    const handleViewChange = (view: string) => {
        if (view === 'settings') {
            // Check if we want to open inline or external
            // For now, keep inline view which offers external button
            setActiveView(view as ViewType);
        } else {
            setActiveView(view as ViewType);
        }
    };

    return (
        <PrismThemeProvider initialTheme="linux">
            <VersionOverlay />
            <MainLayout
                activeView={activeView}
                onViewChange={handleViewChange}
                items={navItems}
                bottomItems={bottomItems}
            >
                {renderContent()}
            </MainLayout>
        </PrismThemeProvider>
    );
};

export default Popup;

