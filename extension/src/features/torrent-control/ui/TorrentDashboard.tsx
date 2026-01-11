import React from 'react';
import { BentoGrid, BentoCard } from '@/shared/ui/layout/BentoGrid';
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
        <BentoGrid className="h-[calc(100vh-140px)] md:grid-rows-3 auto-rows-auto">
            {/* Main Torrent List - Spans 2 cols, 3 rows (Full Height on Desktop) */}
            <div className="col-span-1 md:col-span-2 row-span-1 md:row-span-3 bg-panel border-subtle border rounded-xl overflow-hidden flex flex-col shadow-sm">
                <div className="p-3 border-b border-subtle bg-surface/50 backdrop-blur-sm flex justify-between items-center">
                    <span className="font-medium text-sm text-secondary">Active Torrents</span>
                    <span className="text-xs text-tertiary font-mono">LIVE</span>
                </div>
                <div className="flex-1 min-h-[300px] relative">
                    <VirtualizedTorrentList />
                </div>
            </div>

            {/* Stats Column */}
            <BentoCard
                title="Global Transfer"
                icon={<Activity className="h-4 w-4 text-accent-primary" />}
                description={
                    <div className="flex flex-col gap-1 mt-2">
                        <div className="text-xs text-tertiary uppercase">Download</div>
                        <div className="text-xl font-mono text-primary transition-all duration-300">
                            {formatSpeed(globalStats.downloadSpeed)}
                        </div>
                        <div className="text-xs text-tertiary uppercase mt-2">Upload</div>
                        <div className="text-lg font-mono text-secondary transition-all duration-300">
                            {formatSpeed(globalStats.uploadSpeed)}
                        </div>
                    </div>
                }
                className="col-span-1 row-span-1"
                {...globalTransferDebug}
            />

            <BentoCard
                title="Storage Health"
                icon={<HardDrive className="h-4 w-4 text-status-success" />}
                description={
                    <div className="mt-2 text-xs text-secondary">
                        <div className="flex justify-between mb-1">
                            <span>Used</span>
                            <span>Unknown</span>
                        </div>
                        <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden">
                            <div className="h-full bg-status-success w-[0%]" />
                        </div>
                        <div className="mt-2 font-mono">-- Free</div>
                    </div>
                }
                className="col-span-1 row-span-1"
                {...storageHealthDebug}
            />

            <BentoCard
                title="System Status"
                icon={<Network className="h-4 w-4 text-accent-hover" />}
                description={
                    <div className="mt-2 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-secondary">
                            <div className={`w-1.5 h-1.5 rounded-full ${globalStats.activeCount > 0 ? 'bg-status-success' : 'bg-tertiary'}`} />
                            <span>Active Downloads: {globalStats.activeCount}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-secondary">
                            <div className="w-1.5 h-1.5 rounded-full bg-status-success" />
                            <span>Connection: Online</span>
                        </div>
                    </div>
                }
                className="col-span-1 row-span-1"
                {...systemStatusDebug}
            />
        </BentoGrid>
    );
};
