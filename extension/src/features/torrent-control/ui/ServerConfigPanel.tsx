import React, { useRef, useState } from 'react';
import { Button, InlineNotification, Modal, Stack, Tag } from '@carbon/react';
import { Server } from 'lucide-react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { getClientCapability, isPublicClient } from '@/shared/lib/constants';
import { requestHostPermission } from '@/shared/lib/permissions';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { useTorrentStore } from '@/stores/useTorrentStore';
import { describeConnection } from './ConnectionBanner';
import { ServerForm } from './ServerForm';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => Promise<void>;
    exportServerConfig: (sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

type Mode = { kind: 'list' } | { kind: 'add' } | { kind: 'edit'; index: number };

interface Notice {
    kind: 'success' | 'error' | 'info';
    title: string;
    subtitle?: string;
}

/**
 * Server list and add/edit workflow of the options page.
 *
 * All confirmation and result messaging is in-product (Carbon modal and
 * notifications); nothing uses the browser's native alert/confirm dialogs.
 * The status shown for the active server is the background controller's
 * canonical connection state, read from the shared store.
 */
export const ServerConfigPanel: React.FC<Props> = ({ settings, updateSettings, exportServerConfig, importBackup }) => {
    const [mode, setMode] = useState<Mode>({ kind: 'list' });
    const [notice, setNotice] = useState<Notice | null>(null);
    const [pendingRemove, setPendingRemove] = useState<number | null>(null);
    const [removing, setRemoving] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const connection = useTorrentStore((s) => s.connection);

    const servers = settings.servers;
    const currentIndex = settings.globals.currentServer;

    const persistServers = async (nextServers: ServerConfig[], nextCurrent: number) => {
        const clamped = nextServers.length === 0 ? 0 : Math.min(Math.max(0, nextCurrent), nextServers.length - 1);
        await updateSettings({
            ...settings,
            servers: nextServers,
            globals: { ...settings.globals, currentServer: clamped },
        });
    };

    const handleSave = async (server: ServerConfig) => {
        const next = [...servers];
        if (mode.kind === 'edit') {
            next[mode.index] = server;
        } else {
            next.push(server);
        }
        await persistServers(next, currentIndex);
        setNotice({ kind: 'success', title: mode.kind === 'edit' ? 'Server updated' : 'Server added', subtitle: `${server.name} is saved in the encrypted vault.` });
        setMode({ kind: 'list' });
    };

    const confirmRemove = async () => {
        if (pendingRemove === null) return;
        const index = pendingRemove;
        const target = servers[index];
        setRemoving(true);
        try {
            const next = servers.filter((_, i) => i !== index);
            let nextCurrent = currentIndex;
            if (nextCurrent >= index && nextCurrent > 0) nextCurrent--;
            await persistServers(next, nextCurrent);
            setNotice({ kind: 'success', title: 'Server removed', subtitle: `${target?.name ?? 'The server'} was removed from CTRL. Nothing changed on the torrent client.` });
            setPendingRemove(null);
        } catch (error) {
            setNotice({ kind: 'error', title: 'Server not removed', subtitle: error instanceof Error ? error.message : 'The server could not be removed.' });
            setPendingRemove(null);
        } finally {
            setRemoving(false);
        }
    };

    const setDefault = async (index: number) => {
        try {
            await persistServers(servers, index);
            setNotice({ kind: 'success', title: 'Default server changed', subtitle: `${servers[index]?.name ?? 'The server'} is now the default.` });
        } catch (error) {
            setNotice({ kind: 'error', title: 'Default server not changed', subtitle: error instanceof Error ? error.message : 'The default server could not be changed.' });
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const result = await importBackup(file);
            setNotice({ kind: result.success ? 'success' : 'error', title: result.success ? 'Import complete' : 'Import failed', subtitle: result.message });
        } catch (error) {
            setNotice({ kind: 'error', title: 'Import failed', subtitle: error instanceof Error ? error.message : 'The file could not be imported.' });
        }
    };

    if (mode.kind !== 'list') {
        const editing = mode.kind === 'edit' ? servers[mode.index] ?? null : null;
        return (
            <SettingsPageLayout
                title={mode.kind === 'edit' ? 'Edit server' : 'Add server'}
                description="Tell CTRL where your BitTorrent client's web interface is and how to sign in."
                icon={Server}
            >
                <ServerForm
                    key={mode.kind === 'edit' ? editing?.id ?? mode.index : 'new'}
                    server={editing}
                    onSave={handleSave}
                    onCancel={() => setMode({ kind: 'list' })}
                />
            </SettingsPageLayout>
        );
    }

    const removeTarget = pendingRemove !== null ? servers[pendingRemove] : undefined;

    return (
        <SettingsPageLayout
            title="Servers"
            description="The BitTorrent clients CTRL can send links to. Addresses and logins are stored encrypted in this browser."
            icon={Server}
            actions={
                <Button onClick={() => { setNotice(null); setMode({ kind: 'add' }); }}>
                    Add server
                </Button>
            }
        >
            <Stack gap={5}>
                {notice && (
                    <InlineNotification
                        kind={notice.kind}
                        title={notice.title}
                        subtitle={notice.subtitle}
                        lowContrast
                        role={notice.kind === 'error' ? 'alert' : 'status'}
                        onCloseButtonClick={() => setNotice(null)}
                        aria-label="Close notification"
                    />
                )}

                {servers.length === 0 ? (
                    <SettingsCard>
                        <p className="text-[var(--cds-text-secondary)]">
                            No server configured yet. Add your torrent client to start sending links to it.
                        </p>
                    </SettingsCard>
                ) : (
                    <ul className="list-none m-0 p-0 flex flex-col gap-3" aria-label="Configured servers">
                        {servers.map((server, index) => {
                            const isDefault = index === currentIndex;
                            const client = getClientCapability(server.type || server.application);
                            const isActiveInBackground = !!server.id && connection.serverId === server.id;
                            const presentation = isActiveInBackground ? describeConnection(connection) : null;
                            const needsGrant = isActiveInBackground && connection.status === 'permission_missing';
                            const label = server.name || `Server ${index + 1}`;
                            return (
                                <li key={server.id ?? index} className="bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] rounded p-4">
                                    <div className="flex flex-wrap justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center flex-wrap gap-2">
                                                <h3 className="font-bold text-[var(--cds-text-primary)] m-0">{label}</h3>
                                                {isDefault && <Tag type="blue" size="sm">Default</Tag>}
                                                {!isPublicClient(server.type || server.application) && (
                                                    <Tag type="gray" size="sm">experimental, not verified</Tag>
                                                )}
                                            </div>
                                            <p className="text-sm text-[var(--cds-text-secondary)] mt-1 break-all">
                                                {client?.name ?? server.type} · {server.hostname}
                                            </p>
                                            {presentation && (
                                                <p className="text-sm mt-2" role="status">
                                                    <StatusDot kind={presentation.kind} />
                                                    <span className="font-medium">{presentation.title}</span>
                                                    {connection.status !== 'connected' && (
                                                        <span className="text-[var(--cds-text-secondary)]"> — {presentation.detail}</span>
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-start flex-wrap gap-2">
                                            {needsGrant && (
                                                <Button
                                                    kind="tertiary"
                                                    size="sm"
                                                    onClick={() => { void requestHostPermission(server.hostname); }}
                                                    aria-label={`Grant access to ${label}`}
                                                >
                                                    Grant access
                                                </Button>
                                            )}
                                            {!isDefault && (
                                                <Button kind="ghost" size="sm" onClick={() => { void setDefault(index); }} aria-label={`Make ${label} the default server`}>
                                                    Set default
                                                </Button>
                                            )}
                                            <Button kind="secondary" size="sm" onClick={() => { setNotice(null); setMode({ kind: 'edit', index }); }} aria-label={`Edit ${label}`}>
                                                Edit
                                            </Button>
                                            <Button kind="danger--ghost" size="sm" onClick={() => setPendingRemove(index)} aria-label={`Remove ${label}`}>
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                <SettingsCard title="Move servers to another browser" description="Export the server list as a JSON file and import it elsewhere.">
                    <Stack gap={4}>
                        <p className="text-sm text-[var(--cds-text-secondary)] m-0">
                            The safe export leaves out usernames and passwords. The full export includes them in plain text; keep that file private.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button kind="secondary" size="sm" onClick={() => exportServerConfig(true)} disabled={servers.length === 0}>
                                Export servers (without passwords)
                            </Button>
                            <Button kind="tertiary" size="sm" onClick={() => exportServerConfig(false)} disabled={servers.length === 0}>
                                Export servers (with passwords)
                            </Button>
                            <Button kind="tertiary" size="sm" onClick={() => importInputRef.current?.click()}>
                                Import servers…
                            </Button>
                            <input
                                ref={importInputRef}
                                type="file"
                                accept=".json,application/json"
                                className="hidden"
                                tabIndex={-1}
                                aria-hidden="true"
                                onChange={(e) => { void handleImport(e); }}
                            />
                        </div>
                    </Stack>
                </SettingsCard>
            </Stack>

            <Modal
                open={pendingRemove !== null}
                danger
                modalHeading="Remove server?"
                modalLabel={removeTarget?.name}
                primaryButtonText={removing ? 'Removing…' : 'Remove'}
                secondaryButtonText="Cancel"
                primaryButtonDisabled={removing}
                onRequestClose={() => { if (!removing) setPendingRemove(null); }}
                onRequestSubmit={() => { void confirmRemove(); }}
                size="sm"
            >
                <p className="text-sm">
                    Remove <strong>{removeTarget?.name}</strong> ({removeTarget?.hostname}) from CTRL? Its saved address, username and
                    password are deleted from this browser. Nothing changes on the torrent client itself.
                </p>
            </Modal>
        </SettingsPageLayout>
    );
};

const StatusDot: React.FC<{ kind: 'success' | 'info' | 'warning' | 'error' }> = ({ kind }) => {
    const color =
        kind === 'success' ? 'var(--cds-support-success)' :
            kind === 'warning' ? 'var(--cds-support-warning)' :
                kind === 'error' ? 'var(--cds-support-error)' : 'var(--cds-support-info)';
    return <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: color }} aria-hidden="true" />;
};
