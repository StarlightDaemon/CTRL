import React, { useState } from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { CLIENT_LIST } from '@/shared/lib/constants';
import { checkHostPermission, requestHostPermission } from '@/shared/lib/permissions';
import { isPrivateIP } from '@/shared/lib/network';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Server, ShieldAlert } from 'lucide-react';
import { useDebugId } from '@/shared/lib/hooks/useDebugId';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
    exportServerConfig: (sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const ServerConfigPanel: React.FC<Props> = ({ settings, updateSettings, exportServerConfig, importBackup }) => {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [testStatus, setTestStatus] = useState<{ loading: boolean; success: boolean; message: string | null }>({ loading: false, success: false, message: null });
    const [hasPermission, setHasPermission] = useState(true);

    // Temp state for the server being edited/added
    const [tempServer, setTempServer] = useState<ServerConfig>({
        name: 'New Server',
        application: 'qbittorrent',
        type: 'qbittorrent',
        hostname: 'http://localhost:8080/',
        username: '',
        password: '',
        directories: [],
        clientOptions: {},
    });

    React.useEffect(() => {
        if (tempServer.hostname) {
            checkHostPermission(tempServer.hostname).then(setHasPermission);
        }
    }, [tempServer.hostname]);

    const handleGrantPermission = async () => {
        const granted = await requestHostPermission(tempServer.hostname);
        setHasPermission(granted);
    };

    const startAdd = () => {
        setTempServer({
            name: 'New Server',
            application: 'qbittorrent',
            type: 'qbittorrent',
            hostname: 'http://localhost:8080/',
            username: '',
            password: '',
            directories: [],
            clientOptions: {},
        });
        setTestStatus({ loading: false, success: false, message: null });
        setIsAdding(true);
        setEditingIndex(null);
    };

    const startEdit = (index: number) => {
        setTempServer({ ...settings.servers[index] });
        setTestStatus({ loading: false, success: false, message: null });
        setEditingIndex(index);
        setIsAdding(false);
    };

    const cancelEdit = () => {
        setIsAdding(false);
        setEditingIndex(null);
    };

    const saveServer = () => {
        const newServers = [...settings.servers];
        if (isAdding) {
            newServers.push(tempServer);
        } else if (editingIndex !== null) {
            newServers[editingIndex] = tempServer;
        }

        updateSettings({
            ...settings,
            servers: newServers,
            // If we just added the first server, make it default
            globals: {
                ...settings.globals,
                currentServer: settings.globals.currentServer >= newServers.length ? 0 : settings.globals.currentServer
            }
        });
        cancelEdit();
    };

    const removeServer = (index: number) => {
        if (confirm('Are you sure you want to remove this server?')) {
            const newServers = settings.servers.filter((_, i) => i !== index);
            let newCurrent = settings.globals.currentServer;
            if (newCurrent >= index && newCurrent > 0) newCurrent--;

            updateSettings({
                ...settings,
                servers: newServers,
                globals: { ...settings.globals, currentServer: newCurrent }
            });
        }
    };

    const setDefault = (index: number) => {
        updateSettings({
            ...settings,
            globals: { ...settings.globals, currentServer: index }
        });
    };

    const testConnection = async () => {
        setTestStatus({ loading: true, success: false, message: null });
        try {
            // Pass the raw config to background for testing
            const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION', config: tempServer });
            if (res === true) {
                setTestStatus({ loading: false, success: true, message: 'Connection Successful!' });
            } else {
                setTestStatus({ loading: false, success: false, message: 'Authentication Failed' });
            }
        } catch (e: unknown) {
            const errMsg = e instanceof Error ? e.message : 'Connection Error';
            setTestStatus({ loading: false, success: false, message: errMsg });
        }
    };


    const handleTempChange = <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => {
        setTempServer(prev => ({ ...prev, [field]: value }));
    };

    // Debug IDs for form inputs
    const hostInputDebug = useDebugId('server-config', 'address', 'host-input');
    const portInputDebug = useDebugId('server-config', 'address', 'port-input');

    // Render Form
    if (isAdding || editingIndex !== null) {
        return (
            <SettingsPageLayout
                title={isAdding ? 'Add New Server' : 'Edit Server'}
                icon={Server}
                actions={
                    <button onClick={cancelEdit} className="text-text-secondary hover:text-text-primary px-4 py-2">
                        Cancel
                    </button>
                }
            >
                <SettingsCard>
                    <div className="grid grid-cols-1 gap-4">
                        {/* Name */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Server Name</label>
                            <input
                                type="text"
                                data-component="Input"
                                className="mt-1 block w-full rounded-md border-border bg-background text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                value={tempServer.name}
                                onChange={(e) => handleTempChange('name', e.target.value)}
                            />
                        </div>

                        {/* Application */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">BitTorrent Client</label>
                            <select
                                data-component="Select"
                                className="mt-1 block w-full rounded-md border-border bg-background text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                value={tempServer.application}
                                onChange={(e) => {
                                    handleTempChange('application', e.target.value);
                                    handleTempChange('type', e.target.value);
                                }}
                            >
                                {CLIENT_LIST.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary">Server Address</label>
                            <div className="mt-1 flex rounded-md shadow-sm">
                                <select
                                    data-component="Select"
                                    className="rounded-l-md border-border border-r-0 focus:ring-accent focus:border-accent sm:text-sm p-2 border bg-background text-text-primary"
                                    value={tempServer.hostname.startsWith('https') ? 'https://' : 'http://'}
                                    onChange={(e) => {
                                        const protocol = e.target.value;
                                        let cleanHost = tempServer.hostname.replace(/^https?:\/\//, '');
                                        handleTempChange('hostname', `${protocol}${cleanHost}`);
                                    }}
                                >
                                    <option value="http://">HTTP</option>
                                    <option value="https://">HTTPS</option>
                                </select>
                                <input
                                    type="text"
                                    className="flex-1 min-w-0 block w-full border-border bg-background text-text-primary focus:ring-accent focus:border-accent sm:text-sm p-2 border border-l-0 border-r-0"
                                    placeholder="127.0.0.1"
                                    value={tempServer.hostname.replace(/^https?:\/\//, '').split(':')[0].replace(/\/$/, '')}
                                    onChange={(e) => {
                                        const host = e.target.value;
                                        const protocol = tempServer.hostname.startsWith('https') ? 'https://' : 'http://';
                                        const portMatch = tempServer.hostname.match(/:(\d+)\/?$/);
                                        const port = portMatch ? portMatch[1] : '';
                                        handleTempChange('hostname', `${protocol}${host}${port ? ':' + port : ''}/`);
                                    }}
                                    {...hostInputDebug}
                                />
                                <span className="inline-flex items-center px-3 border border-l-0 border-border bg-background text-text-secondary sm:text-sm">:</span>
                                <input
                                    type="text"
                                    className="rounded-r-md border-border bg-background text-text-primary focus:ring-accent focus:border-accent sm:text-sm p-2 border w-24"
                                    placeholder="8080"
                                    value={(() => {
                                        const match = tempServer.hostname.match(/:(\d+)\/?$/);
                                        return match ? match[1] : '';
                                    })()}
                                    onChange={(e) => {
                                        const port = e.target.value;
                                        const protocol = tempServer.hostname.startsWith('https') ? 'https://' : 'http://';
                                        const host = tempServer.hostname.replace(/^https?:\/\//, '').split(':')[0].replace(/\/$/, '');
                                        handleTempChange('hostname', `${protocol}${host}${port ? ':' + port : ''}/`);
                                    }}
                                    {...portInputDebug}
                                />
                            </div>
                        </div>

                        {/* Auth */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Username</label>
                                <input
                                    type="text"
                                    data-component="Input"
                                    className="mt-1 block w-full rounded-md border-border bg-background text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                    value={tempServer.username || ''}
                                    onChange={(e) => handleTempChange('username', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary">Password</label>
                                <input
                                    type="password"
                                    data-component="Input"
                                    className="mt-1 block w-full rounded-md border-border bg-background text-text-primary shadow-sm focus:border-accent focus:ring-accent sm:text-sm p-2 border"
                                    value={tempServer.password || ''}
                                    onChange={(e) => handleTempChange('password', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={testConnection}
                                disabled={testStatus.loading || !hasPermission}
                                className={`bg-surface border border-border text-text-primary px-4 py-2 rounded-md hover:bg-hover min-w-[140px] ${!hasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {testStatus.loading ? 'Testing...' : 'Test Connection'}
                            </button>

                            {!hasPermission && (
                                <div className="flex flex-col space-y-2">
                                    {isPrivateIP(tempServer.hostname) && (
                                        <div className="text-xs bg-orange-100 border border-orange-200 text-orange-800 p-2 rounded mb-2">
                                            <strong>Local Network Access:</strong> Chrome restricts access to local IPs. You must explicitly grant permission.
                                        </div>
                                    )}
                                    <button
                                        onClick={handleGrantPermission}
                                        className="bg-yellow-500/10 text-yellow-600 border border-yellow-500/20 px-3 py-2 rounded-md hover:bg-yellow-500/20 text-sm font-medium flex items-center justify-center"
                                    >
                                        <ShieldAlert size={16} className="mr-2" />
                                        {isPrivateIP(tempServer.hostname) ? 'Grant Local Access' : 'Grant Permission'}
                                    </button>
                                </div>
                            )}

                            {/* Result Area - Fixed Width/Position to prevent shifting */}
                            <div className="min-w-[200px]">
                                {testStatus.message ? (
                                    <span className={`text-sm font-medium ${testStatus.success ? 'text-green-500' : 'text-red-500'}`}>
                                        {testStatus.message}
                                    </span>
                                ) : (
                                    <span className="text-sm text-text-secondary italic">Not tested yet</span>
                                )}
                            </div>
                        </div>

                        <div className="space-x-3">
                            <button
                                onClick={saveServer}
                                className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover shadow-sm"
                            >
                                Save Server
                            </button>
                        </div>
                    </div>
                </SettingsCard>
            </SettingsPageLayout>
        );
    }

    // Render List
    return (
        <SettingsPageLayout
            title="Server Configuration"
            description="Manage your torrent client connections. Add, edit, or remove servers."
            icon={Server}
            actions={
                <button
                    onClick={startAdd}
                    className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover shadow-sm flex items-center"
                >
                    <span className="mr-2">+</span> Add Server
                </button>
            }
        >
            <div className="space-y-4">
                {settings.servers.length === 0 ? (
                    <div className="text-center py-10 bg-surface rounded-lg border border-border text-text-secondary">
                        No servers configured. Click "Add Server" to get started.
                    </div>
                ) : (
                    settings.servers.map((server, index) => (
                        <div key={index} className="bg-surface shadow-sm rounded-xl p-4 border border-border flex justify-between items-center transition-colors hover:border-accent/30">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-text-primary">{server.name || `Server ${index + 1}`}</h3>
                                    {settings.globals.currentServer === index && (
                                        <span className="text-xs bg-accent text-white px-2 py-0.5 rounded-full">Default</span>
                                    )}
                                </div>
                                <div className="text-sm text-text-secondary mt-1">
                                    {CLIENT_LIST.find(c => c.id === server.application)?.name} • {server.hostname}
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {settings.globals.currentServer !== index && (
                                    <button
                                        onClick={() => setDefault(index)}
                                        className="text-xs text-text-secondary hover:text-accent px-2 py-1"
                                    >
                                        Set Default
                                    </button>
                                )}
                                <button
                                    onClick={() => startEdit(index)}
                                    className="text-xs bg-surface border border-border text-text-primary px-3 py-1.5 rounded hover:bg-hover"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => removeServer(index)}
                                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <SettingsCard title="Migration" className="mt-8">
                <p className="text-xs text-text-secondary mb-4">
                    Export your server configurations to a JSON file to transfer them to another device or browser.
                    <br />
                    <em>Passwords are included in the export. Keep the file secure.</em>
                </p>
                <div className="flex space-x-4">
                    <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                        <button
                            onClick={() => exportServerConfig(true)}
                            className="bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-hover shadow-sm flex items-center justify-center"
                            title="Export without passwords"
                        >
                            <Server className="w-4 h-4 mr-2" />
                            Export (Safe)
                        </button>
                        <button
                            onClick={() => exportServerConfig(false)}
                            className="bg-surface border border-border text-text-primary px-4 py-2 rounded-md hover:bg-hover shadow-sm flex items-center justify-center"
                            title="Export including passwords"
                        >
                            <Server className="w-4 h-4 mr-2" />
                            Export (Secrets)
                        </button>
                    </div>
                    <label className="cursor-pointer bg-surface border border-border text-text-primary px-4 py-2 rounded-md hover:bg-hover shadow-sm flex items-center">
                        <Server className="w-4 h-4 mr-2" />
                        Import Servers
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    try {
                                        const result = await importBackup(file);
                                        alert(result.message);
                                        window.location.reload();
                                    } catch (err: unknown) {
                                        const errMsg = err instanceof Error ? err.message : 'Unknown error';
                                        alert('Import failed: ' + errMsg);
                                    }
                                    e.target.value = '';
                                }
                            }}
                        />
                    </label>
                </div>
            </SettingsCard>
        </SettingsPageLayout>
    );
};
