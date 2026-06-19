import React, { useState, useEffect } from 'react';
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
    Grid,
    Column
} from '@carbon/react';
import { Launch, Settings, Information, CheckmarkOutline, ErrorOutline, Add } from '@carbon/icons-react';

// Hooks
import { useSettings } from '@/features/torrent-control/model/useSettings';

// Entities
import { Torrent } from '@/entities/torrent/model/Torrent';

// Components
import { Logo } from '@/shared/ui/Logo';
import { AddTorrentDialog } from './AddTorrentDialog';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { VaultService } from '@/shared/api/security/VaultService';

import { useDebugId } from '@/shared/lib/hooks/useDebugId';

export const Dashboard = () => {
    const { settings, updateSettings, loading } = useSettings();
    const [status, setStatus] = useState<string>('Ready');
    const [statusKind, setStatusKind] = useState<'success' | 'danger' | 'warning' | 'info'>('success');
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

    const [vaultStatus, setVaultStatus] = useState<string>('');

    useEffect(() => {
        const checkVault = async () => {
            try {
                const isInit = await VaultService.isInitialized();
                if (!isInit) {
                    setVaultStatus('Vault: Uninitialized');
                    return;
                }
                const isLocked = await VaultService.isLocked();
                setVaultStatus(isLocked ? 'Vault: Locked' : 'Vault: Unlocked');
            } catch (e) {
                console.error('Failed to check vault status', e);
            }
        };
        checkVault();
        const interval = setInterval(checkVault, 2000);
        return () => clearInterval(interval);
    }, []);

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
                setStatusKind('success');
            } else if (response && response.error) {
                setStatus('Error: ' + response.error);
                setStatusKind('danger');
            }
        } catch {
            setStatus('Connection Failed');
            setStatusKind('danger');
        }
    };

    const handleAddTorrent = async () => {
        if (!addUrl) return;
        setStatus('Adding...');
        setStatusKind('info');
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
            setStatusKind('success');
            fetchTorrents();
        } catch (e: unknown) {
            setStatus('Add Failed: ' + (e instanceof Error ? e.message : String(e)));
            setStatusKind('danger');
        }
    };

    if (loading || !settings) {
        return (
            <div className="w-full h-full flex items-center justify-center p-8">
                <Loading withOverlay={false} description={browser.i18n.getMessage('commonLoading')} />
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
        setStatusKind('info');
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
            setStatusKind('success');
            fetchTorrents();
        } catch (e: unknown) {
            setStatus('Add Failed: ' + (e instanceof Error ? e.message : String(e)));
            setStatusKind('danger');
            throw e;
        }
    };

    const getStatusIcon = () => {
        switch (statusKind) {
            case 'success': return <CheckmarkOutline size={16} color="var(--cds-support-success)" />;
            case 'danger': return <ErrorOutline size={16} color="var(--cds-support-error)" />;
            default: return <Information size={16} color="var(--cds-support-info)" />;
        }
    };

    return (
        <ErrorBoundary>
            <div className="w-full h-full bg-[var(--cds-background)] p-4 font-sans text-[var(--cds-text-primary)] relative overflow-y-auto">
                {!configured ? (
                    <Grid className="h-full">
                        <Column lg={4} md={4} sm={4}>
                            <Tile className="p-5">
                                <Stack gap={7}>
                                    <div className="flex flex-col items-start gap-4">
                                        <Logo className="w-12 h-12" />
                                        <h1 className="text-2xl font-bold">{browser.i18n.getMessage('dashboardTitle')}</h1>
                                    </div>

                                    <p className="text-[var(--cds-text-secondary)]">{browser.i18n.getMessage('dashboardEmptyState')}</p>

                                    <Button
                                        onClick={openOptions}
                                        renderIcon={Settings}
                                        size="lg"
                                        className="w-full"
                                        {...setupBtnDebug}
                                    >
                                        {browser.i18n.getMessage('dashboardSetupNow')}
                                    </Button>
                                </Stack>
                            </Tile>
                        </Column>
                    </Grid>
                ) : (
                    <Stack gap={5}>
                        <div className="flex justify-between items-center border-b border-[var(--cds-border-subtle)] pb-2">
                            <h1 className="text-lg font-bold flex items-center">
                                <Logo className="w-6 h-6 mr-2" />
                                {browser.i18n.getMessage('dashboardTitle')}
                            </h1>
                            {vaultStatus && (
                                <div className={`text-xs px-2 py-1 rounded-full font-medium ${vaultStatus === 'Vault: Unlocked' ? 'bg-[var(--cds-support-success)] text-white' :
                                        vaultStatus === 'Vault: Locked' ? 'bg-[var(--cds-support-error)] text-white' :
                                            'bg-[var(--cds-support-warning)] text-black'
                                    }`}>
                                    {vaultStatus}
                                </div>
                            )}
                        </div>

                        <Stack gap={4}>
                            <Layer level={1}>
                                <Tile className="flex flex-col gap-2 p-3">
                                    <label className="text-[var(--cds-text-helper)] text-[10px] font-bold uppercase tracking-wider">
                                        {browser.i18n.getMessage('dashboardCurrentServer')}
                                    </label>

                                    {(settings.servers || []).length > 1 ? (
                                        <Select
                                            id="server-select"
                                            hideLabel
                                            labelText={browser.i18n.getMessage('dashboardSelectServer')}
                                            value={settings.globals.currentServer}
                                            onChange={(e) => handleServerChange(Number(e.target.value))}
                                            size="sm"
                                            {...serverSelectDebug}
                                        >
                                            {(settings.servers || []).map((server, index) => (
                                                <SelectItem key={index} value={index} text={server.name} />
                                            ))}
                                        </Select>
                                    ) : (
                                        <div className="font-medium text-sm">{currentServer?.name || 'Unknown Server'}</div>
                                    )}

                                    <div className="flex items-center gap-2 text-xs font-medium">
                                        {getStatusIcon()}
                                        <span className="truncate">{status}</span>
                                    </div>
                                </Tile>
                            </Layer>

                            <Layer level={1}>
                                <Tile className="flex flex-col gap-2 p-3">
                                    <label className="text-[var(--cds-text-helper)] text-[10px] font-bold uppercase tracking-wider">
                                        {browser.i18n.getMessage('dashboardQuickAdd')}
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <TextInput
                                                id="add-url"
                                                labelText={browser.i18n.getMessage('dashboardMagnetPlaceholder')}
                                                hideLabel
                                                value={addUrl}
                                                onChange={(e) => setAddUrl(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder={browser.i18n.getMessage('dashboardMagnetPlaceholder')}
                                                size="sm"
                                                disabled={isAdding}
                                                {...addInputDebug}
                                            />
                                        </div>
                                        <Button
                                            onClick={handleAddClick}
                                            disabled={isAdding || !addUrl}
                                            renderIcon={isAdding ? undefined : Add}
                                            hasIconOnly
                                            iconDescription={browser.i18n.getMessage('dashboardAddTorrentTooltip')}
                                            size="sm"
                                            tooltipPosition="left"
                                            {...addBtnDebug}
                                        >
                                            {isAdding && <Loading withOverlay={false} small description={browser.i18n.getMessage('commonLoading')} />}
                                        </Button>
                                    </div>
                                </Tile>
                            </Layer>

                            <Layer level={1}>
                                <div className="rounded border border-[var(--cds-border-subtle)] overflow-hidden">
                                    <div className="bg-[var(--cds-layer-02)] px-3 py-1.5 text-[10px] font-bold text-[var(--cds-text-helper)] uppercase flex justify-between items-center border-b border-[var(--cds-border-subtle)]">
                                        <span>{browser.i18n.getMessage('dashboardActiveTorrents')}</span>
                                        <span className="bg-[var(--cds-layer-03)] px-1.5 py-0.5 rounded-sm">{torrents?.length || 0}</span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto bg-[var(--cds-background)]">
                                        {Array.isArray(torrents) && torrents.length > 0 ? (
                                            torrents.slice(0, 3).map(t => (
                                                <div
                                                    key={t.id}
                                                    className="p-3 border-b border-[var(--cds-border-subtle)] last:border-0 hover:bg-[var(--cds-layer-hover-01)] transition-colors"
                                                    data-debug-id={`dashboard:mini-list:row-${t.id}`}
                                                >
                                                    <div className="text-xs font-semibold truncate mb-2" title={t.name || 'Unknown'}>
                                                        {t.name || 'Unknown'}
                                                    </div>
                                                    <ProgressBar
                                                        label={String(t.status || '')}
                                                        helperText={`${Math.round(t.progress || 0)}% completed`}
                                                        value={t.progress || 0}
                                                        max={100}
                                                        size="small"
                                                        status={(t.status as string) === 'Downloading' ? 'active' : 'finished'}
                                                    />
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-xs text-[var(--cds-text-helper)] italic">
                                                No active torrents
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Layer>

                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    kind="secondary"
                                    size="sm"
                                    onClick={openWebUI}
                                    renderIcon={Launch}
                                    className="w-full"
                                    {...webUiBtnDebug}
                                >
                                    {browser.i18n.getMessage('dashboardWebUi')}
                                </Button>
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        setStatus('Testing...');
                                        setStatusKind('info');
                                        const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
                                        if (res?.connected) {
                                            setStatus('Online');
                                            setStatusKind('success');
                                        } else {
                                            setStatus('Failed');
                                            setStatusKind('danger');
                                        }
                                    }}
                                    className="w-full"
                                    {...testBtnDebug}
                                >
                                    {browser.i18n.getMessage('dashboardTest')}
                                </Button>
                            </div>

                            <div className="pt-2 border-t border-[var(--cds-border-subtle)]">
                                <Button
                                    kind="ghost"
                                    size="sm"
                                    onClick={openOptions}
                                    renderIcon={Settings}
                                    className="w-full text-xs"
                                    {...settingsBtnDebug}
                                >
                                    {browser.i18n.getMessage('dashboardOpenSettings')}
                                </Button>
                            </div>

                            <AddTorrentDialog
                                isOpen={isDialogOpen}
                                onClose={() => setIsDialogOpen(false)}
                                onAdd={handleDialogAdd}
                                initialUrl={addUrl}
                                server={currentServer}
                                labels={settings.globals.labels || []}
                            />
                        </Stack>
                    </Stack>
                )}
            </div>
        </ErrorBoundary>
    );
};
