import React, { useState } from 'react';
import { TorrentGalaxySettings } from '../../features/site-integrations/torrent-galaxy/components/Settings';
import { OneThreeThreeSevenXSettings } from '../../features/one-three-three-seven-x/components/Settings';
import { NyaaSettings } from '../../features/nyaa/components/Settings';
import { FitGirlSettings } from '../../features/fitgirl/components/Settings';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Globe } from 'lucide-react';

export const SitesDashboard = () => {
    const [activeTab, setActiveTab] = useState('torrent_galaxy');

    const tabs = [
        { id: 'torrent_galaxy', label: 'TorrentGalaxy' },
        { id: '1337x', label: '1337x' },
        { id: 'nyaa', label: 'Nyaa' },
        { id: 'fitgirl', label: 'FitGirl' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'torrent_galaxy': return <TorrentGalaxySettings />;
            case '1337x': return <OneThreeThreeSevenXSettings />;
            case 'nyaa': return <NyaaSettings />;
            case 'fitgirl': return <FitGirlSettings />;
            default: return null;
        }
    };

    return (
        <div className="h-full flex flex-col bg-background">
            <PageHeader
                title="Site Integrations"
                icon={Globe}
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={setActiveTab}
            />

            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                <div className="max-w-5xl mx-auto neon-container">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
