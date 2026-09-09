import React, { useState, useEffect, useCallback } from 'react';
import {
    Button,
    TextInput,
    Select,
    SelectItem,
    ProgressBar,
    Tile,
    Stack,
    Layer,
    Loading,
    InlineNotification,
} from '@carbon/react';
import { Launch, Settings, Add, Locked } from '@carbon/icons-react';
import { browser } from 'wxt/browser';

import { useSettings } from '@/features/torrent-control/model/useSettings';
import { useVault } from '@/features/torrent-control/model/useVault';
import { useTorrentSubscription } from '@/features/torrent-control/model/useTorrentSubscription';
import { useTorrentStore } from '@/stores/useTorrentStore';
import { describeConnection } from './ConnectionBanner';
import { formatSpeed } from '@/shared/lib/format';
import { requestHostPermission } from '@/shared/lib/permissions';
import type { AddTorrentRequest, CommandResult } from '@/shared/api/messaging/protocol';

import { Logo } from '@/shared/ui/Logo';
import { UnlockVault } from '@/shared/ui/security/UnlockVault';
import { AddTorrentDialog } from './AddTorrentDialog';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const POPUP_ROWS = 5;

type AddState = { kind: 'idle' } | { kind: 'adding' } | { kind: 'added' } | { kind: 'failed'; message: string };

/**
 * Toolbar popup.
 *
 * Renders exactly one of: setup prompt, unlock form, corrupted-vault notice,
 * "add a server" prompt, or the live dashboard. The dashboard subscribes to
 * the background queue over the shared port, so the popup and the options
 * page always show the same data and drive one poll loop.
 */
export const Dashboard = () => {
    const vault = useVault();

    if (vault.status === 'loading') {
        return (
            <div className="w-full h-full flex items-center justify-center p-8">
                <Loading withOverlay={false} description={browser.i18n.getMessage('commonLoading')} />
            </div>
        );
    }

    if (vault.status === 'uninitialized') {
        return (
            <Prompt
                title="Set up CTRL"
                body="Create a master password to store your torrent client credentials encrypted on this device."
                action="Set up now"
                icon={Settings}
                onAction={() => chrome.runtime.openOptionsPage()}
            />
        );
    }

    if (vault.status === 'corrupted') {
        return (
            <Prompt
                title="Vault damaged"
                body="The stored vault data is incomplete or damaged and cannot be unlocked. Open settings to reset it."
                action="Open settings"
                icon={Settings}
                onAction={() => chrome.runtime.openOptionsPage()}
                kind="error"
            />
        );
    }

    if (vault.status === 'locked') {
        return (
            <div className="w-full h-full overflow-y-auto">
                <UnlockVault onUnlock={vault.refresh} compact />
            </div>
        );
    }

    if (vault.servers.length === 0) {
        return (
            <Prompt
                title="No server configured"
                body="Add your torrent client (for example qBittorrent or Transmission) to start sending links to it."
                action="Add a server"
                icon={Add}
                onAction={() => chrome.runtime.openOptionsPage()}
            />
        );
    }

    return (
        <ErrorBoundary>
            <LiveDashboard onLock={vault.lock} />
        </ErrorBoundary>
    );
};

const Prompt: React.FC<{
    title: string;
    body: string;
    action: string;
    icon: React.ComponentType;
    onAction: () => void;
    kind?: 'info' | 'error';
}> = ({ title, body, action, icon, onAction, kind = 'info' }) => (
    <div className="w-full h-full bg-[var(--cds-background)] p-4 text-[var(--cds-text-primary)] overflow-y-auto">
        <Tile className="p-5">
            <Stack gap={6}>
                <div className="flex flex-col items-start gap-3">
                    <Logo className="w-10 h-10" />
                    <h1 className="text-xl font-bold">{title}</h1>
                </div>
                {kind === 'error' ? (
                    <InlineNotification kind="error" title={title} subtitle={body} lowContrast hideCloseButton role="status" />
                ) : (
                    <p className="text-[var(--cds-text-secondary)]">{body}</p>
                )}
                <Button onClick={onAction} renderIcon={icon} size="lg" className="w-full">
                    {action}
                </Button>
            </Stack>
        </Tile>
    </div>
);

const LiveDashboard: React.FC<{ onLock: () => Promise<void> }> = ({ onLock }) => {
    const { settings, updateSettings } = useSettings();
    useTorrentSubscription({ start: 0, end: POPUP_ROWS });

    const connection = useTorrentStore((s) => s.connection);
    const stats = useTorrentStore((s) => s.globalStats);
    const ids = useTorrentStore((s) => s.ids);
    const byId = useTorrentStore((s) => s.byId);
    const totalCount = useTorrentStore((s) => s.totalCount);

    const [addUrl, setAddUrl] = useState('');
    const [addState, setAddState] = useState<AddState>({ kind: 'idle' });
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        if (addState.kind !== 'added') return;
        const t = setTimeout(() => setAddState({ kind: 'idle' }), 3000);
        return () => clearTimeout(t);
    }, [addState]);

    const servers = settings?.servers ?? [];
    const currentIndex = settings?.globals.currentServer ?? 0;
    const currentServer = servers[currentIndex] ?? servers[0];

    const submitAdd = useCallback(async (url: string, options?: AddTorrentRequest['options']) => {
        const trimmed = url.trim();
        if (!trimmed) return;
        setAddState({ kind: 'adding' });
        try {
            const request: AddTorrentRequest = { type: 'ADD_TORRENT_URL', url: trimmed, options };
            const result = (await chrome.runtime.sendMessage(request)) as CommandResult | undefined;
            if (!result?.ok) {
                throw new Error(result?.error ?? 'The torrent could not be added.');
            }
            setAddUrl('');
            setAddState({ kind: 'added' });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            setAddState({ kind: 'failed', message });
            throw e;
        }
    }, []);

    const handleAddClick = () => {
        if (settings?.globals.addAdvanced) {
            setIsDialogOpen(true);
        } else {
            void submitAdd(addUrl).catch(() => { /* surfaced via addState */ });
        }
    };

    const handleServerChange = (index: number) => {
        if (!settings) return;
        void updateSettings({
            ...settings,
            globals: { ...settings.globals, currentServer: index },
        });
    };

    const openWebUI = () => {
        if (!currentServer?.hostname) return;
        try {
            const url = new URL(currentServer.hostname);
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                void chrome.tabs.create({ url: url.toString() });
            }
        } catch {
            // invalid hostname: nothing to open
        }
    };

    const presentation = describeConnection(connection);
    const isAdding = addState.kind === 'adding';
    const canAdd = connection.status !== 'locked' && connection.status !== 'uninitialized' && connection.status !== 'no_servers';

    return (
        <div className="w-full h-full bg-[var(--cds-background)] p-4 font-sans text-[var(--cds-text-primary)] overflow-y-auto">
            <Stack gap={4}>
                <div className="flex justify-between items-center border-b border-[var(--cds-border-subtle)] pb-2">
                    <h1 className="text-lg font-bold flex items-center">
                        <Logo className="w-6 h-6 mr-2" />
                        CTRL
                    </h1>
                    <div className="flex items-center gap-1">
                        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Locked} iconDescription="Lock CTRL" tooltipPosition="bottom" onClick={() => { void onLock(); }} />
                        <Button kind="ghost" size="sm" hasIconOnly renderIcon={Settings} iconDescription="Open settings" tooltipPosition="bottom" onClick={() => chrome.runtime.openOptionsPage()} />
                    </div>
                </div>

                <Layer level={1}>
                    <Tile className="flex flex-col gap-2 p-3">
                        <label htmlFor="server-select" className="text-[var(--cds-text-helper)] text-[10px] font-bold uppercase tracking-wider">
                            Server
                        </label>
                        {servers.length > 1 ? (
                            <Select
                                id="server-select"
                                hideLabel
                                labelText="Active server"
                                value={currentIndex}
                                onChange={(e) => handleServerChange(Number(e.target.value))}
                                size="sm"
                            >
                                {servers.map((server, index) => (
                                    <SelectItem key={server.id ?? index} value={index} text={server.name} />
                                ))}
                            </Select>
                        ) : (
                            <div className="font-medium text-sm" id="server-select">{currentServer?.name ?? 'Server'}</div>
                        )}

                        <div className="flex items-start gap-2 text-xs" role="status" aria-live="polite">
                            <StatusDot kind={presentation.kind} />
                            <div className="min-w-0">
                                <div className="font-medium">{presentation.title}</div>
                                {connection.status !== 'connected' && (
                                    <div className="text-[var(--cds-text-secondary)] break-words">{presentation.detail}</div>
                                )}
                                {connection.status === 'connected' && (
                                    <div className="text-[var(--cds-text-secondary)] font-mono">
                                        ↓ {formatSpeed(stats.downloadSpeed)} · ↑ {formatSpeed(stats.uploadSpeed)}
                                    </div>
                                )}
                            </div>
                        </div>
                        {connection.status === 'permission_missing' && currentServer?.hostname && (
                            <Button
                                kind="tertiary"
                                size="sm"
                                onClick={() => { void requestHostPermission(currentServer.hostname); }}
                            >
                                Grant access
                            </Button>
                        )}
                    </Tile>
                </Layer>

                <Layer level={1}>
                    <Tile className="flex flex-col gap-2 p-3">
                        <label htmlFor="add-url" className="text-[var(--cds-text-helper)] text-[10px] font-bold uppercase tracking-wider">
                            Add torrent
                        </label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <TextInput
                                    id="add-url"
                                    labelText="Magnet link or torrent URL"
                                    hideLabel
                                    value={addUrl}
                                    onChange={(e) => setAddUrl(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddClick(); }}
                                    placeholder="magnet:?xt=urn:btih:…"
                                    size="sm"
                                    disabled={isAdding || !canAdd}
                                />
                            </div>
                            <Button
                                onClick={handleAddClick}
                                disabled={isAdding || !addUrl || !canAdd}
                                renderIcon={isAdding ? undefined : Add}
                                hasIconOnly
                                iconDescription="Add torrent"
                                size="sm"
                                tooltipPosition="left"
                            >
                                {isAdding && <Loading withOverlay={false} small description="Adding" />}
                            </Button>
                        </div>
                        {addState.kind === 'failed' && (
                            <InlineNotification kind="error" title="Could not add" subtitle={addState.message} lowContrast hideCloseButton role="alert" />
                        )}
                        {addState.kind === 'added' && (
                            <InlineNotification kind="success" title="Torrent added" lowContrast hideCloseButton role="status" />
                        )}
                        {settings?.globals.addPaused && (
                            <p className="text-[10px] text-[var(--cds-text-helper)]">New torrents start paused (change in Settings).</p>
                        )}
                    </Tile>
                </Layer>

                <Layer level={1}>
                    <div className="rounded border border-[var(--cds-border-subtle)] overflow-hidden">
                        <div className="bg-[var(--cds-layer-02)] px-3 py-1.5 text-[10px] font-bold text-[var(--cds-text-helper)] uppercase flex justify-between items-center border-b border-[var(--cds-border-subtle)]">
                            <span>Torrents</span>
                            <span className="bg-[var(--cds-layer-03)] px-1.5 py-0.5 rounded-sm" aria-label={`${totalCount} torrents`}>{totalCount}</span>
                        </div>
                        <ul className="max-h-48 overflow-y-auto bg-[var(--cds-background)] list-none m-0 p-0" aria-label="Recent torrents">
                            {ids.length > 0 ? (
                                ids.map((id) => {
                                    const t = byId[id];
                                    if (!t) return null;
                                    const progress = Math.max(0, Math.min(100, Math.round(t.progress)));
                                    return (
                                        <li key={id} className="p-3 border-b border-[var(--cds-border-subtle)] last:border-0">
                                            <div className="text-xs font-semibold truncate mb-2" title={t.name}>{t.name}</div>
                                            <ProgressBar
                                                label={t.status}
                                                helperText={`${progress}%`}
                                                value={progress}
                                                max={100}
                                                size="small"
                                                status={t.status === 'downloading' ? 'active' : 'finished'}
                                            />
                                        </li>
                                    );
                                })
                            ) : (
                                <li className="p-4 text-center text-xs text-[var(--cds-text-helper)] italic">
                                    {connection.status === 'connected' ? 'No torrents' : 'No data'}
                                </li>
                            )}
                        </ul>
                        {totalCount > ids.length && (
                            <div className="px-3 py-1.5 text-[10px] text-[var(--cds-text-helper)] border-t border-[var(--cds-border-subtle)]">
                                Showing {ids.length} of {totalCount}. Open settings for the full list.
                            </div>
                        )}
                    </div>
                </Layer>

                <div className="grid grid-cols-2 gap-2">
                    <Button kind="secondary" size="sm" onClick={openWebUI} renderIcon={Launch} className="w-full">
                        Web UI
                    </Button>
                    <Button kind="ghost" size="sm" onClick={() => chrome.runtime.openOptionsPage()} renderIcon={Settings} className="w-full">
                        Settings
                    </Button>
                </div>

                {currentServer && (
                    <AddTorrentDialog
                        isOpen={isDialogOpen}
                        onClose={() => setIsDialogOpen(false)}
                        onAdd={(url, options) => submitAdd(url, options)}
                        initialUrl={addUrl}
                        server={currentServer}
                        labels={settings?.globals.labels ?? []}
                        defaultPaused={settings?.globals.addPaused ?? false}
                    />
                )}
            </Stack>
        </div>
    );
};

const StatusDot: React.FC<{ kind: 'success' | 'info' | 'warning' | 'error' }> = ({ kind }) => {
    const color =
        kind === 'success' ? 'var(--cds-support-success)' :
            kind === 'warning' ? 'var(--cds-support-warning)' :
                kind === 'error' ? 'var(--cds-support-error)' : 'var(--cds-support-info)';
    return <span className="mt-1 inline-block w-2 h-2 rounded-full flex-none" style={{ backgroundColor: color }} aria-hidden="true" />;
};
