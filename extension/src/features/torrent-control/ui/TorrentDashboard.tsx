import React from 'react';
import { Tile, Grid, Column } from '@carbon/react';
import { BentoCard } from '@/shared/ui/layout/BentoGrid';
import { VirtualizedTorrentList } from './VirtualizedTorrentList';
import { Activity, HardDrive, Network } from 'lucide-react';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';
import { useTorrentStore } from '../../../stores/useTorrentStore';

const formatSpeed = (bytes: number) => {
    if (bytes === 0) return '0.0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const TorrentDashboard = () => {
    // Debug IDs
    const globalTransferDebug = useDebugId('torrent-dashboard', 'stats', 'global-transfer');
    const storageHealthDebug = useDebugId('torrent-dashboard', 'stats', 'storage-health');
    const systemStatusDebug = useDebugId('torrent-dashboard', 'stats', 'system-status');

    const { globalStats } = useTorrentStore();

    return (

        <Grid className="h-[calc(100vh-140px)]">
            {/* Main Torrent List - 11/16 cols (approx 2/3) */}
            <Column lg={11} md={5} sm={4} className="h-full">
                <Tile className="h-full flex flex-col p-0 overflow-hidden border-none">
                    <div className="p-3 border-b border-subtle bg-layer-01 flex justify-between items-center">
                        <span className="font-medium text-sm text-text-secondary">Active Torrents</span>
                        <span className="text-xs text-text-disabled font-mono">LIVE</span>
                    </div>
                    <div className="flex-1 min-h-[300px] relative bg-layer-01">
                        <VirtualizedTorrentList />
                    </div>
                </Tile>
            </Column>

            {/* Stats Column - 5/16 cols (approx 1/3) */}
            <Column lg={5} md={3} sm={4} className="flex flex-col gap-4 h-full">
                <BentoCard
                    title="Global Transfer"
                    icon={<Activity className="h-4 w-4 text-interactive" />}
                    description={
                        <div className="flex flex-col gap-1 mt-2">
                            <div className="text-xs text-text-secondary uppercase">Download</div>
                            <div className="text-xl font-mono text-text-primary transition-all duration-300">
                                {formatSpeed(globalStats.downloadSpeed)}
                            </div>
                            <div className="text-xs text-text-secondary uppercase mt-2">Upload</div>
                            <div className="text-lg font-mono text-text-primary transition-all duration-300">
                                {formatSpeed(globalStats.uploadSpeed)}
                            </div>
                        </div>
                    }
                    className="flex-1" // Distribute height
                    {...globalTransferDebug}
                />

                <BentoCard
                    title="Storage Health"
                    icon={<HardDrive className="h-4 w-4 text-status-success" />}
                    description={
                        <div className="mt-2 text-xs text-text-secondary">
                            <div className="flex justify-between mb-1">
                                <span>Used</span>
                                <span>Unknown</span>
                            </div>
                            <div className="h-1.5 w-full bg-layer-03 rounded-full overflow-hidden">
                                <div className="h-full bg-status-success w-[0%]" />
                            </div>
                            <div className="mt-2 font-mono">-- Free</div>
                        </div>
                    }
                    className="flex-1"
                    {...storageHealthDebug}
                />

                <BentoCard
                    title="System Status"
                    icon={<Network className="h-4 w-4 text-interactive-hover" />}
                    description={
                        <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                                <div className={`w-1.5 h-1.5 rounded-full ${globalStats.activeCount > 0 ? 'bg-status-success' : 'bg-text-disabled'}`} />
                                <span>Active Downloads: {globalStats.activeCount}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-text-secondary">
                                <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
                                <span>Connection: Online</span>
                            </div>
                        </div>
                    }
                    className="flex-1"
                    {...systemStatusDebug}
                />
            </Column>
        </Grid>
    );
};
