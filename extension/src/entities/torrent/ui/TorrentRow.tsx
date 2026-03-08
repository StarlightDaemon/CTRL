import React, { memo, useCallback } from 'react';
import { useTorrentStore } from '../../../stores/useTorrentStore';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface TorrentRowProps {
    index: number;
    style: React.CSSProperties;
}

export const TorrentRow = memo(({ index, style }: TorrentRowProps) => {
    // Granular selectors: Only re-render if THIS torrent changes
    // Note: These are stable references from Zustand
    const torrent = useTorrentStore((state) => state.torrents[index]);
    const optimisticUpdate = useTorrentStore((state) => state.optimisticUpdate);

    // Debug ID
    const rowDebug = useDebugId('torrent-list', 'row', torrent?.id ? String(torrent.id) : `index-${index}`);

    // Stable action handler using useCallback
    const handleAction = useCallback(async (e: React.MouseEvent, action: 'pause' | 'resume' | 'delete') => {
        e.stopPropagation();
        if (!torrent) return;

        if (action === 'pause') {
            optimisticUpdate(torrent.id, { status: 'paused' });
            chrome.runtime.sendMessage({ type: 'PAUSE_TORRENT', id: torrent.id });
        } else if (action === 'resume') {
            optimisticUpdate(torrent.id, { status: 'downloading' });
            chrome.runtime.sendMessage({ type: 'RESUME_TORRENT', id: torrent.id });
        } else if (action === 'delete') {
            chrome.runtime.sendMessage({ type: 'REMOVE_TORRENT', id: torrent.id, deleteData: false });
        }
    }, [torrent, optimisticUpdate]);

    // Loading/Empty State
    if (!torrent) {
        return (
            <div
                style={style}
                className="p-3 border-b border-subtle flex items-center justify-center text-text-secondary animate-pulse"
            >
                Loading...
            </div>
        );
    }

    return (
        <div
            style={style}
            className="p-3 border-b border-subtle flex items-center hover:bg-layer-selected-hover transition-colors group cursor-default select-none active:bg-layer-selected relative"
            role="listitem"
            {...rowDebug}
        >
            {/* Name and Meta */}
            <div className="flex-1 min-w-0 mr-4">
                <div className="text-sm font-medium text-text-primary truncate" title={torrent.name}>
                    {torrent.name}
                </div>
                <div className="flex items-center text-xs text-text-secondary mt-1 space-x-3">
                    <div className={`flex items-center gap-1.5 ${torrent.status === 'downloading' ? 'text-interactive' :
                        torrent.status === 'seeding' ? 'text-status-success' :
                            torrent.status === 'paused' ? 'text-text-helper' :
                                torrent.status === 'error' ? 'text-status-error' : ''
                        }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${torrent.status === 'downloading' ? 'bg-interactive' :
                            torrent.status === 'seeding' ? 'bg-status-success' :
                                torrent.status === 'paused' ? 'bg-text-helper' :
                                    torrent.status === 'error' ? 'bg-status-error' : 'bg-layer-03'
                            }`} />
                        <span className="capitalize">{torrent.status}</span>
                    </div>
                    <span className="font-mono">{Math.round(torrent.progress * 100) / 100}%</span>
                    <span className="font-mono text-text-helper">{torrent.size}</span>
                </div>
            </div>

            {/* Hover Actions (Linear Style) */}
            <div
                className="absolute right-32 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 focus-within:z-10 transition-opacity bg-layer-01 px-2 py-1 rounded-md shadow-sm border border-subtle"
                role="group"
                aria-label="Torrent actions"
            >
                {torrent.status === 'paused' ? (
                    <button
                        onClick={(e) => handleAction(e, 'resume')}
                        className="p-1.5 hover:bg-layer-selected-hover rounded-md text-text-secondary hover:text-interactive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive"
                        aria-label={`Resume ${torrent.name}`}
                        title="Resume"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                ) : (
                    <button
                        onClick={(e) => handleAction(e, 'pause')}
                        className="p-1.5 hover:bg-layer-selected-hover rounded-md text-text-secondary hover:text-interactive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive"
                        aria-label={`Pause ${torrent.name}`}
                        title="Pause"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                )}
                <button
                    onClick={(e) => handleAction(e, 'delete')}
                    className="p-1.5 hover:bg-layer-selected-hover rounded-md text-text-secondary hover:text-status-error transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive"
                    aria-label={`Delete ${torrent.name}`}
                    title="Delete"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>

            {/* Progress Bar */}
            <div className="w-24 mr-4">
                <div className="w-full bg-layer-02 h-1.5 rounded-full overflow-hidden">
                    <div
                        className={`h-full transition-all duration-500 relative ${torrent.status === 'downloading' ? 'bg-interactive' :
                            torrent.status === 'seeding' ? 'bg-status-success' :
                                torrent.status === 'paused' ? 'bg-text-helper' : 'bg-layer-03'
                            }`}
                        style={{ width: `${torrent.progress}%` }}
                    >
                        {torrent.status === 'downloading' && (
                            <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});

TorrentRow.displayName = 'TorrentRow';
