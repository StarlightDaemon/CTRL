import React, { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { TorrentRow } from '@/entities/torrent/ui/TorrentRow';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

export const VirtualizedTorrentList = () => {
    // Optimization: Only subscribe to totalCount. 
    // Do NOT subscribe to 'torrents' to avoid list-wide re-renders on every update.
    const totalCount = useTorrentStore((state) => state.totalCount);
    const parentRef = useRef<HTMLDivElement>(null);
    const listDebug = useDebugId('torrent-list', 'virtual-viewport', 'container');
    const viewportDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Debounced viewport update to reduce message flooding during scroll
    const sendViewportUpdate = useCallback((start: number, end: number) => {
        if (viewportDebounceRef.current) {
            clearTimeout(viewportDebounceRef.current);
        }
        viewportDebounceRef.current = setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'UPDATE_VIEWPORT',
                data: { start, end }
            }).catch(() => { });
        }, 50); // 50ms debounce
    }, []);

    const rowVirtualizer = useVirtualizer({
        count: totalCount,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 5,
        onChange: (instance) => {
            const range = instance.calculateRange();
            if (range) {
                sendViewportUpdate(range.startIndex, range.endIndex);
            }
        }
    });

    // Trigger initial viewport update on mount
    React.useEffect(() => {
        sendViewportUpdate(0, 50);
    }, [sendViewportUpdate]);

    return (
        <div
            ref={parentRef}
            className="h-full w-full overflow-auto bg-card border border-border rounded-md"
            role="list"
            aria-label="Torrent list"
            aria-rowcount={totalCount}
            {...listDebug}
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
                        key={virtualRow.key}
                        index={virtualRow.index}
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
    );
};
