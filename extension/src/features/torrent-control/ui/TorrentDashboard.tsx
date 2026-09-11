import React from 'react';
import { Tile, Grid, Column } from '@carbon/react';
import { BentoCard } from '@/shared/ui/layout/BentoGrid';
import { VirtualizedTorrentList } from './VirtualizedTorrentList';
import { Activity, Network } from 'lucide-react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { describeConnection } from './ConnectionBanner';
import { formatSpeed } from '@/shared/lib/format';

interface Props {
    onViewportChange: (start: number, end: number) => void;
}

const formatAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'never';
    const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
};

export const TorrentDashboard: React.FC<Props> = ({ onViewportChange }) => {
    const globalStats = useTorrentStore((s) => s.globalStats);
    const connection = useTorrentStore((s) => s.connection);
    const presentation = describeConnection(connection);
    const live = connection.status === 'connected';

    return (
        <Grid className="h-[calc(100vh-140px)]">
            {/* Main Torrent List */}
            <Column lg={11} md={5} sm={4} className="h-full">
                <Tile className="h-full flex flex-col p-0 overflow-hidden border-none">
                    <div className="p-3 border-b border-subtle bg-layer-01 flex justify-between items-center">
                        <span className="font-medium text-sm text-text-secondary">
                            {connection.serverName ? `Torrents on ${connection.serverName}` : 'Torrents'}
                        </span>
                        <span
                            className={`text-xs font-mono ${live ? 'text-status-success' : 'text-text-disabled'}`}
                            role="status"
                            aria-live="polite"
                        >
                            {live ? 'LIVE' : presentation.title.toUpperCase()}
                        </span>
                    </div>
                    <div className="flex-1 min-h-[300px] relative bg-layer-01 p-2">
                        <VirtualizedTorrentList onViewportChange={onViewportChange} />
                    </div>
                </Tile>
            </Column>

            {/* Stats Column */}
            <Column lg={5} md={3} sm={4} className="flex flex-col gap-4 h-full">
                <BentoCard
                    title="Transfer"
                    icon={<Activity className="h-4 w-4 text-interactive" aria-hidden="true" />}
                    description={
                        <div className="flex flex-col gap-1 mt-2">
                            <div className="text-xs text-text-secondary uppercase">Download</div>
                            <div className="text-xl font-mono text-text-primary">
                                {live ? formatSpeed(globalStats.downloadSpeed) : '—'}
                            </div>
                            <div className="text-xs text-text-secondary uppercase mt-2">Upload</div>
                            <div className="text-lg font-mono text-text-primary">
                                {live ? formatSpeed(globalStats.uploadSpeed) : '—'}
                            </div>
                        </div>
                    }
                    className="flex-1"
                />

                <BentoCard
                    title="Connection"
                    icon={<Network className="h-4 w-4 text-interactive-hover" aria-hidden="true" />}
                    description={
                        <div className="mt-2 space-y-2 text-xs text-text-secondary">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-1.5 h-1.5 rounded-full ${presentation.kind === 'success' ? 'bg-status-success' : presentation.kind === 'error' ? 'bg-status-error' : 'bg-text-disabled'}`}
                                    aria-hidden="true"
                                />
                                <span>{presentation.title}</span>
                            </div>
                            {connection.status !== 'connected' && (
                                <div className="text-text-helper">{presentation.detail}</div>
                            )}
                            <div>Active: {live ? globalStats.activeCount : '—'} · Total: {live ? globalStats.total : '—'}</div>
                            <div>Last update: {formatAgo(connection.lastSuccessAt)}</div>
                        </div>
                    }
                    className="flex-1"
                />
            </Column>
        </Grid>
    );
};
