import React, { useState } from 'react';
import { MainLayout } from '@/shared/ui/layout/MainLayout';
import { Dashboard } from '../../features/torrent-control/ui/Dashboard';
import { Settings, Bug, Activity } from 'lucide-react';
import { VersionOverlay } from '@/shared/ui/VersionOverlay';
import { Tabs, TabList, Tab } from '@carbon/react';
import { browser } from 'wxt/browser';

type ViewType = 'torrents' | 'settings' | 'debug';

const Popup = () => {
    const [activeView, setActiveView] = useState<ViewType>('torrents');

    const handleTabChange = ({ selectedIndex }: { selectedIndex: number }) => {
        const views: ViewType[] = ['torrents', 'settings', 'debug'];
        setActiveView(views[selectedIndex]);
    };

    const renderContent = () => {
        switch (activeView) {
            case 'torrents':
                return <Dashboard />;
            case 'settings':
                return (
                    <div className="flex items-center justify-center h-full text-text-secondary">
                        <div className="text-center p-6">
                            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50 text-link-primary" />
                            <h2 className="text-lg font-bold mb-2 text-text-primary">{browser.i18n.getMessage('popupGlobalSettings')}</h2>
                            <p className="text-sm mb-4">{browser.i18n.getMessage('popupDescription')}</p>
                            <button
                                onClick={() => chrome.runtime.openOptionsPage()}
                                className="bg-interactive text-text-on-color px-6 py-2 rounded-full hover:bg-interactive-hover focus:ring-2 focus:ring-[var(--cds-focus)] focus:ring-offset-2 focus:outline-none transition-all shadow-lg font-medium"
                            >
                                {browser.i18n.getMessage('popupOpenOptions')}
                            </button>
                        </div>
                    </div>
                );
            case 'debug':
                return (
                    <div className="flex flex-col h-full bg-layer-01 text-text-primary p-4 space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                            <Bug className="text-link-primary" />
                            <h2 className="text-lg font-bold">{browser.i18n.getMessage('popupDebugTools')}</h2>
                        </div>

                        <div className="bg-layer-02 p-4 rounded-lg border border-border-subtle space-y-3">
                            <h3 className="font-medium text-sm text-text-helper uppercase tracking-wider">{browser.i18n.getMessage('popupUiInspection')}</h3>
                            <button
                                onClick={() => window.dispatchEvent(new CustomEvent('TOGGLE_UI_DEBUG'))}
                                className="w-full bg-layer-03 hover:bg-layer-selected-hover focus:ring-2 focus:ring-[var(--cds-focus)] focus:ring-offset-[-2px] focus:outline-none text-text-primary px-4 py-3 rounded transition-all flex items-center justify-between group border border-border-strong"
                            >
                                <span className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-[var(--cds-support-success)]" />
                                    <span>{browser.i18n.getMessage('popupToggleOverlay')}</span>
                                </span>
                                <span className="bg-background text-xs px-2 py-1 rounded text-text-secondary group-hover:text-text-primary transition-colors">Ctrl+Shift+U</span>
                            </button>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <>
            <VersionOverlay />
            <MainLayout>
                <div className="flex-none border-b border-border-subtle bg-layer-01">
                    <Tabs
                        selectedIndex={(['torrents', 'settings', 'debug'] as ViewType[]).indexOf(activeView)}
                        onChange={handleTabChange}
                    >
                        <TabList aria-label="Popup Navigation" contained>
                            <Tab>{browser.i18n.getMessage('popupTabControl')}</Tab>
                            <Tab>{browser.i18n.getMessage('popupTabSettings')}</Tab>
                            <Tab>{browser.i18n.getMessage('popupTabDebug')}</Tab>
                        </TabList>
                    </Tabs>
                </div>
                <div className="flex-1 overflow-hidden">
                    {renderContent()}
                </div>
            </MainLayout>
        </>
    );
};

export default Popup;

