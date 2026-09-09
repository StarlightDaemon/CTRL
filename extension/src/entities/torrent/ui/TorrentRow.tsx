import React, { memo, useCallback } from 'react';
import { useTorrentStore, selectTorrentAtIndex } from '../../../stores/useTorrentStore';
import { runTorrentCommand } from '@/features/torrent-control/model/torrentCommands';
import { formatBytes } from '@/shared/lib/format';

interface TorrentRowProps {
    index: number;
    style: React.CSSProperties;
    /** Called when the user asks to remove this torrent; the caller confirms. */
    onRequestRemove: (torrentId: string, name: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
    downloading: 'Downloading',
    seeding: 'Seeding',
    paused: 'Paused',
    completed: 'Completed',
    error: 'Error',
    checking: 'Checking',
    queued: 'Queued',
    stalled: 'Stalled',
    unknown: 'Unknown',
};

const PENDING_LABEL: Record<string, string> = {
    pause: 'Pausing…',
    resume: 'Resuming…',
    remove: 'Removing…',
};

export const TorrentRow = memo(({ index, style, onRequestRemove }: TorrentRowProps) => {
    // Rows resolve their torrent by id through the window's ordered id list,
    // so a reorder on the server can never make this row show another torrent.
    const torrent = useTorrentStore(selectTorrentAtIndex(index));
    const serverId = useTorrentStore((state) => state.serverId);
    const pending = useTorrentStore((state) => (torrent ? state.pending[torrent.id] : undefined));
    const failure = useTorrentStore((state) => (torrent ? state.failures[torrent.id] : undefined));

    const handlePauseResume = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!torrent || !serverId || pending) return;
        const action = torrent.status === 'paused' ? 'resume' : 'pause';
        await runTorrentCommand(serverId, torrent.id, action);
    }, [torrent, serverId, pending]);

    const handleRemove = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (!torrent || pending) return;
        onRequestRemove(torrent.id, torrent.name);
    }, [torrent, pending, onRequestRemove]);

    if (!torrent) {
        return (
            <div
                style={style}
                className="p-3 border-b border-subtle flex items-center justify-center text-text-secondary"
                role="listitem"
                aria-busy="true"
            >
                Loading…
            </div>
        );
    }

    const statusLabel = pending ? PENDING_LABEL[pending] : (STATUS_LABEL[torrent.status] ?? torrent.status);
    const isPaused = torrent.status === 'paused';
    const progress = Math.max(0, Math.min(100, Math.round(torrent.progress * 100) / 100));
    const statusColor =
        torrent.status === 'downloading' ? 'text-interactive' :
            torrent.status === 'seeding' ? 'text-status-success' :
                torrent.status === 'paused' ? 'text-text-helper' :
                    torrent.status === 'error' ? 'text-status-error' : '';
    const barColor =
        torrent.status === 'downloading' ? 'bg-interactive' :
            torrent.status === 'seeding' ? 'bg-status-success' :
                torrent.status === 'paused' ? 'bg-text-helper' : 'bg-layer-03';

    return (
        <div
            style={style}
            className="p-3 border-b border-subtle flex items-center hover:bg-layer-selected-hover transition-colors group cursor-default select-none relative"
            role="listitem"
            aria-label={`${torrent.name}, ${statusLabel}, ${progress}%`}
        >
            {/* Name and Meta */}
            <div className="flex-1 min-w-0 mr-4">
                <div className="text-sm font-medium text-text-primary truncate" title={torrent.name}>
                    {torrent.name}
                </div>
                <div className="flex items-center text-xs text-text-secondary mt-1 space-x-3">
                    <span className={`flex items-center gap-1.5 ${statusColor}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${barColor}`} aria-hidden="true" />
                        <span>{statusLabel}</span>
                    </span>
                    <span className="font-mono">{progress}%</span>
                    <span className="font-mono text-text-helper">{formatBytes(torrent.size)}</span>
                    {failure && (
                        <span className="text-status-error truncate" role="status" title={failure}>
                            {failure}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions: always in the tab order, visually revealed on hover/focus */}
            <div
                className="flex items-center gap-1 mr-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                role="group"
                aria-label={`Actions for ${torrent.name}`}
            >
                <button
                    type="button"
                    onClick={handlePauseResume}
                    disabled={!!pending || !serverId}
                    className="p-1.5 hover:bg-layer-selected-hover rounded-md text-text-secondary hover:text-interactive transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive disabled:opacity-50"
                    aria-label={isPaused ? `Resume ${torrent.name}` : `Pause ${torrent.name}`}
                    title={isPaused ? 'Resume' : 'Pause'}
                >
                    {isPaused ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    )}
                </button>
                <button
                    type="button"
                    onClick={handleRemove}
                    disabled={!!pending || !serverId}
                    className="p-1.5 hover:bg-layer-selected-hover rounded-md text-text-secondary hover:text-status-error transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-interactive disabled:opacity-50"
                    aria-label={`Remove ${torrent.name} from the client`}
                    title="Remove (keeps downloaded files)"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>

            {/* Progress Bar */}
            <div className="w-24">
                <div
                    className="w-full bg-layer-02 h-1.5 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                    aria-label={`${torrent.name} progress`}
                >
                    <div
                        className={`h-full transition-all duration-500 motion-reduce:transition-none ${barColor}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
});

TorrentRow.displayName = 'TorrentRow';
