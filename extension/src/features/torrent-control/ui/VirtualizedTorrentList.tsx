import React, { useRef, useCallback, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Modal, Stack } from '@carbon/react';
import { PackageOpen } from 'lucide-react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { TorrentRow } from '@/entities/torrent/ui/TorrentRow';
import { runTorrentCommand } from '../model/torrentCommands';
import { ConnectionBanner } from './ConnectionBanner';

interface Props {
    /** Reports the visible row range to the background subscription. */
    onViewportChange: (start: number, end: number) => void;
}

const ROW_HEIGHT = 60;
const OVERSCAN = 5;

export const VirtualizedTorrentList: React.FC<Props> = ({ onViewportChange }) => {
    // Subscribe to totals and connection only; rows subscribe to themselves.
    const totalCount = useTorrentStore((state) => state.totalCount);
    const connection = useTorrentStore((state) => state.connection);
    const serverId = useTorrentStore((state) => state.serverId);
    const isLoading = useTorrentStore((state) => state.isLoading);

    const parentRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [pendingRemove, setPendingRemove] = useState<{ id: string; name: string } | null>(null);

    const reportViewport = useCallback((start: number, end: number) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            // The virtualizer's end index is inclusive; the protocol's is exclusive.
            onViewportChange(Math.max(0, start - OVERSCAN), end + 1 + OVERSCAN);
        }, 50);
    }, [onViewportChange]);

    const rowVirtualizer = useVirtualizer({
        count: totalCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: OVERSCAN,
        onChange: (instance) => {
            const range = instance.calculateRange();
            if (range) reportViewport(range.startIndex, range.endIndex);
        },
    });

    const handleRequestRemove = useCallback((id: string, name: string) => {
        setPendingRemove({ id, name });
    }, []);

    const confirmRemove = useCallback(async () => {
        const target = pendingRemove;
        setPendingRemove(null);
        if (!target || !serverId) return;
        await runTorrentCommand(serverId, target.id, 'remove');
    }, [pendingRemove, serverId]);

    const hasQueue = connection.status === 'connected' || connection.status === 'stale';

    return (
        <div className="h-full w-full flex flex-col">
            <ConnectionBanner connection={connection} />

            {!hasQueue || (totalCount === 0 && !isLoading) ? (
                <div className="flex-1 w-full flex items-center justify-center bg-layer-01 border border-subtle rounded-md" role="status">
                    <Stack gap={4} className="items-center text-center p-8">
                        <PackageOpen size={48} className="text-text-placeholder opacity-50" aria-hidden="true" />
                        <Stack gap={1}>
                            <h3 className="text-lg font-medium text-text-primary">
                                {hasQueue ? 'No torrents' : 'No queue to show'}
                            </h3>
                            <p className="text-sm text-text-secondary max-w-[280px]">
                                {hasQueue
                                    ? 'The connected client has no torrents. Add a magnet link to get started.'
                                    : 'The queue appears once CTRL is unlocked and connected to a server.'}
                            </p>
                        </Stack>
                    </Stack>
                </div>
            ) : (
                <div
                    ref={parentRef}
                    className="flex-1 w-full overflow-auto bg-transparent"
                    role="list"
                    aria-label={`Torrents on ${connection.serverName ?? 'server'} (${totalCount})`}
                >
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                            <TorrentRow
                                key={virtualRow.key.toString()}
                                index={virtualRow.index}
                                onRequestRemove={handleRequestRemove}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}

            <Modal
                open={pendingRemove !== null}
                danger
                modalHeading="Remove torrent?"
                modalLabel={connection.serverName ?? undefined}
                primaryButtonText="Remove"
                secondaryButtonText="Cancel"
                onRequestClose={() => setPendingRemove(null)}
                onRequestSubmit={confirmRemove}
                size="sm"
            >
                <p className="text-sm">
                    Remove <strong>{pendingRemove?.name}</strong> from {connection.serverName ?? 'the client'}?
                    Downloaded files are kept on the server.
                </p>
            </Modal>
        </div>
    );
};
