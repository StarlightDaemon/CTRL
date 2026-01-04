import React, { useState } from 'react';
import { useABBSettings } from '@/features/audiobook-bay/model/useABBSettings';
import { CategoryList } from './CategoryList';
import { GeneralSettings } from './GeneralSettings';
import { MirrorManager } from './MirrorManager';
import { DiagnosticsTab } from './DiagnosticsTab';
import { PageHeader } from '@/shared/ui/PageHeader';
import { BookHeadphones } from 'lucide-react';

export const Dashboard = () => {
    const { settings, updateSettings, loading } = useABBSettings();
    const [activeTab, setActiveTab] = useState<'categories' | 'settings' | 'mirrors' | 'diagnostics'>('categories');

    const tabs = [
        { id: 'categories', label: 'Categories' },
        { id: 'mirrors', label: 'Mirrors' },
        { id: 'settings', label: 'Settings' },
        ...(settings?.showDiagnostics ? [{ id: 'diagnostics', label: 'Diagnostics' }] : [])
    ];

    if (loading || !settings) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background relative">
            <PageHeader
                title="AudioBook Bay"
                icon={BookHeadphones}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={(t) => setActiveTab(t as any)}
            />

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <div className="max-w-5xl mx-auto space-y-6">
                    {activeTab === 'categories' && (
                        <CategoryList settings={settings} updateSettings={updateSettings} />
                    )}
                    {activeTab === 'mirrors' && (
                        <MirrorManager settings={settings} updateSettings={updateSettings} />
                    )}
                    {activeTab === 'settings' && (
                        <GeneralSettings settings={settings} updateSettings={updateSettings} />
                    )}
                    {activeTab === 'diagnostics' && (
                        <DiagnosticsTab settings={settings} />
                    )}
                </div>
            </div>
        </div>
    );
};
