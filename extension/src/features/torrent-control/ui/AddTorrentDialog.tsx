import React, { useState, useEffect } from 'react';
import { ServerConfig } from '@/shared/lib/types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (url: string, options: { path?: string; label?: string; paused?: boolean }) => Promise<void>;
    initialUrl?: string;
    server: ServerConfig;
    labels: string[];
}

export const AddTorrentDialog: React.FC<Props> = ({ isOpen, onClose, onAdd, initialUrl = '', server, labels }) => {
    const [url, setUrl] = useState(initialUrl);
    const [path, setPath] = useState(server.defaultDirectory || ((server.directories || []).length > 0 ? (server.directories || [])[0] : ''));
    const [label, setLabel] = useState(server.defaultLabel || '');
    const [paused, setPaused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl);
            setPath(server.defaultDirectory || ((server.directories || []).length > 0 ? (server.directories || [])[0] : ''));
            setLabel(server.defaultLabel || '');
            setPaused(false);
            setError(null);
        }
    }, [isOpen, initialUrl, server]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setIsSubmitting(true);
        setError(null);
        try {
            await onAdd(url, { path, label, paused });
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to add torrent');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-panel w-full max-w-sm mx-4 rounded-xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-surface px-4 py-3 border-b border-border flex justify-between items-center">
                    <h3 className="font-bold text-text-primary">Add Torrent</h3>
                    <button onClick={onClose} aria-label="Close" className="text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* URL Input */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary uppercase mb-1">Torrent URL / Magnet</label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="magnet:?xt=urn:btih..."
                            className="w-full p-2 bg-input border border-border rounded text-sm text-text-primary focus:ring-accent focus:border-accent"
                            autoFocus
                        />
                    </div>

                    {/* Download Location */}
                    {(server.directories || []).length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-text-secondary uppercase mb-1">Download Location</label>
                            <select
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                className="w-full p-2 bg-input border border-border rounded text-sm text-text-primary focus:ring-accent focus:border-accent"
                            >
                                {(server.directories || []).map((dir, i) => (
                                    <option key={i} value={dir}>{dir}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Label */}
                    {labels.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-text-secondary uppercase mb-1">Label</label>
                            <select
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                className="w-full p-2 bg-input border border-border rounded text-sm text-text-primary focus:ring-accent focus:border-accent"
                            >
                                <option value="">None</option>
                                {labels.map((l, i) => (
                                    <option key={i} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Options */}
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="start-paused"
                            checked={paused}
                            onChange={(e) => setPaused(e.target.checked)}
                            className="rounded text-accent focus:ring-accent bg-input border-border"
                        />
                        <label htmlFor="start-paused" className="text-sm text-text-primary cursor-pointer select-none">Start Paused</label>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded border border-red-500/20">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end space-x-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-text-primary hover:bg-hover rounded transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!url || isSubmitting}
                            className="px-4 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></span>
                                    Adding...
                                </>
                            ) : (
                                'Add Torrent'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
