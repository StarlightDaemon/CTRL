import React, { useState, useEffect } from 'react';

// Hooks
import { useSettings } from '@/features/torrent-control/model/useSettings';
// import { useTheme } from '@/shared/lib/hooks/useTheme';

// Entities
import { Torrent } from '@/entities/torrent/model/Torrent';

// Components
import { Logo } from '@/shared/ui/Logo';
import { AddTorrentDialog } from './AddTorrentDialog';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

export const Dashboard = () => {
    console.log('Dashboard: Render start');
    const { settings, updateSettings, loading } = useSettings();
    // useTheme hook removed
    const [status, setStatus] = useState<string>('Ready');
    const [statusColor, setStatusColor] = useState<string>('text-green-600');
    const [torrents, setTorrents] = useState<Torrent[]>([]);
    const [addUrl, setAddUrl] = useState('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Debug IDs
    const setupBtnDebug = useDebugId('dashboard', 'global', 'setup-button');
    const serverSelectDebug = useDebugId('dashboard', 'global', 'server-select');
    const addInputDebug = useDebugId('dashboard', 'add-torrent', 'url-input');
    const addBtnDebug = useDebugId('dashboard', 'add-torrent', 'add-button');
    const webUiBtnDebug = useDebugId('dashboard', 'actions', 'web-ui-button');
    const testBtnDebug = useDebugId('dashboard', 'actions', 'test-connection-button');
    const settingsBtnDebug = useDebugId('dashboard', 'actions', 'open-settings-button');

    useEffect(() => {
        if (settings && (settings.servers || []).length > 0) {
            fetchTorrents();
            const interval = setInterval(fetchTorrents, 2000);
            return () => clearInterval(interval);
        }
    }, [settings]);

    const fetchTorrents = async () => {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_TORRENTS' });
            if (response && !response.error) {
                setTorrents(response);
                setStatus('Online');
                setStatusColor('text-green-600');
            } else if (response && response.error) {
                setStatus('Error: ' + response.error);
                setStatusColor('text-red-600');
            }
        } catch (e) {
            setStatus('Connection Failed');
            setStatusColor('text-red-600');
        }
    };

    const handleAddTorrent = async () => {
        if (!addUrl) return;
        setStatus('Adding...');
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_TORRENT_URL',
                url: addUrl
            });
            if (response && response.error) {
                throw new Error(response.error);
            }
            setAddUrl('');
            setStatus('Torrent Added');
            fetchTorrents();
        } catch (e: any) {
            setStatus('Add Failed: ' + e.message);
            setStatusColor('text-red-600');
        }
    };

    if (loading || !settings) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const configured = (settings.servers || []).length > 0 && settings.servers[settings.globals.currentServer]?.hostname;
    const currentServer = settings.servers[settings.globals.currentServer];

    const handleServerChange = (index: number) => {
        updateSettings({
            ...settings,
            globals: {
                ...settings.globals,
                currentServer: index,
            },
        });
    };

    const openWebUI = () => {
        if (currentServer?.hostname) {
            let url = currentServer.hostname;
            if (!url.match(/^http/)) url = 'http://' + url;
            chrome.tabs.create({ url });
        }
    };

    const openOptions = () => {
        chrome.runtime.openOptionsPage();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleAddTorrent();
        }
    };

    const isAdding = status === 'Adding...';



    const handleAddClick = () => {
        if (settings.globals.addAdvanced) {
            setIsDialogOpen(true);
        } else {
            handleAddTorrent();
        }
    };

    const handleDialogAdd = async (url: string, options: { path?: string; label?: string; paused?: boolean }) => {
        setStatus('Adding...');
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'ADD_TORRENT_URL',
                url: url,
                options: options
            });
            if (response && response.error) {
                throw new Error(response.error);
            }
            setAddUrl('');
            setStatus('Torrent Added');
            fetchTorrents();
        } catch (e: any) {
            setStatus('Add Failed: ' + e.message);
            setStatusColor('text-red-600');
            throw e; // Re-throw for dialog to handle
        }
    };

    return (
        <ErrorBoundary>
            <div className="w-full h-full bg-background p-4 font-sans text-text-primary relative overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b border-border pb-2">
                    <h1 className="text-lg font-bold text-text-primary flex items-center">
                        <Logo className="w-6 h-6 mr-2 text-text-primary" />
                        Torrent Control
                    </h1>
                </div>

                {!configured ? (
                    <div className="text-center py-4">
                        <p className="text-text-secondary mb-4">Extension not configured.</p>
                        <button
                            onClick={openOptions}
                            className="w-full bg-accent text-white py-2 px-4 rounded hover:bg-accent-hover transition-colors"
                            {...setupBtnDebug}
                        >
                            ⚙️ Setup Now
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-card p-3 rounded shadow-sm border border-border">
                            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                                Current Server
                            </label>

                            {(settings.servers || []).length > 1 ? (
                                <select
                                    value={settings.globals.currentServer}
                                    onChange={(e) => handleServerChange(Number(e.target.value))}
                                    className="w-full p-2 border border-border bg-input text-text-primary rounded text-sm focus:ring-accent focus:border-accent"
                                    {...serverSelectDebug}
                                >
                                    {(settings.servers || []).map((server, index) => (
                                        <option key={index} value={index}>
                                            {server.name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="font-medium text-text-primary">{currentServer?.name || 'Unknown Server'}</div>
                            )}

                            <div className={`text-xs mt-2 font-medium ${statusColor} truncate flex items-center`}>
                                <span className={`w-2 h-2 rounded-full mr-1.5 ${status === 'Online' ? 'bg-green-500' : status === 'Adding...' ? 'bg-blue-500 animate-pulse' : 'bg-red-500'}`}></span>
                                {status}
                            </div>
                        </div>

                        <div className="bg-card p-3 rounded shadow-sm border border-border">
                            <label className="block text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                                Add Torrent
                            </label>
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={addUrl}
                                    onChange={(e) => setAddUrl(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Magnet link or URL"
                                    className="flex-1 p-2 border border-border bg-input text-text-primary rounded text-sm focus:ring-accent focus:border-accent"
                                    disabled={isAdding}
                                    {...addInputDebug}
                                />
                                <button
                                    onClick={handleAddClick}
                                    disabled={isAdding || !addUrl}
                                    aria-label="Add Torrent"
                                    className={`bg-accent text-white px-3 py-2 rounded hover:bg-accent-hover transition-colors flex items-center justify-center min-w-[40px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent ${isAdding ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    {...addBtnDebug}
                                >
                                    {isAdding ? (
                                        <span className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    ) : (
                                        '+'
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Mini Torrent List (Top 3) */}
                        <div className="bg-card rounded shadow-sm border border-border overflow-hidden">
                            <div className="bg-secondary px-3 py-1 text-xs font-medium text-text-secondary uppercase flex justify-between items-center">
                                <span>Active Torrents</span>
                                <span className="bg-primary px-1.5 rounded text-[10px]">{torrents?.length || 0}</span>
                            </div>
                            <div className="max-h-40 overflow-y-auto">
                                {Array.isArray(torrents) && torrents.length > 0 ? (
                                    torrents.slice(0, 3).map(t => (
                                        <div
                                            key={t.id}
                                            className="p-2 border-b border-border last:border-0 hover:bg-primary/50 transition-colors"
                                            data-debug-id={`dashboard:mini-list:row-${t.id}`}
                                            data-component="MiniTorrentRow"
                                        >
                                            <div className="text-xs font-medium truncate text-text-primary mb-1" title={t.name || 'Unknown'}>{t.name || 'Unknown'}</div>
                                            <div className="flex justify-between text-[10px] text-text-secondary mb-1">
                                                <span className={(t.status as string) === 'Downloading' ? 'text-accent' : ''}>{String(t.status || '')}</span>
                                                <span>{Math.round(t.progress || 0)}%</span>
                                            </div>
                                            <div className="w-full bg-primary h-1 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 ${(t.status as string) === 'Downloading' ? 'bg-accent' : 'bg-gray-400'}`}
                                                    style={{ width: `${t.progress || 0}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center text-xs text-text-secondary italic">
                                        No active torrents
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={openWebUI}
                                className="flex items-center justify-center bg-secondary text-text-primary py-2 px-3 rounded hover:bg-card transition-colors text-sm font-medium border border-border"
                                {...webUiBtnDebug}
                            >
                                🌐 Web UI
                            </button>
                            <button
                                onClick={async () => {
                                    setStatus('Testing...');
                                    setStatusColor('text-orange-500');
                                    const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
                                    if (res) {
                                        setStatus('Online');
                                        setStatusColor('text-green-600');
                                    } else {
                                        setStatus('Failed');
                                        setStatusColor('text-red-600');
                                    }
                                }}
                                className="flex items-center justify-center bg-accent/10 text-accent py-2 px-3 rounded hover:bg-accent/20 transition-colors text-sm font-medium border border-accent/20"
                                {...testBtnDebug}
                            >
                                🔌 Test
                            </button>
                        </div>

                        <div className="pt-2 border-t border-border">
                            <button
                                onClick={openOptions}
                                className="text-xs text-text-secondary hover:text-accent flex items-center justify-center w-full"
                                {...settingsBtnDebug}
                            >
                                Open Settings
                            </button>
                        </div>

                        <AddTorrentDialog
                            isOpen={isDialogOpen}
                            onClose={() => setIsDialogOpen(false)}
                            onAdd={handleDialogAdd}
                            initialUrl={addUrl}
                            server={currentServer}
                            labels={settings.globals.labels || []}
                        />
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};
