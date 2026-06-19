import React, { useState } from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { EXTERNAL_RESOURCES } from '@/shared/lib/resources';
import { ExternalLink, Info, Activity } from 'lucide-react';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import {
    Stack,
    InlineNotification,
    Button,
    Tile,
    Link,
    Toggletip,
    ToggletipButton,
    ToggletipContent
} from '@carbon/react';

interface Props {
    settings: AppOptions;
}

export const DiagnosticsSettings: React.FC<Props> = ({ settings }) => {
    return (
        <SettingsPageLayout
            title="Diagnostics"
            description="Diagnostic tools to help identify connection issues and verify environment compatibility."
            icon={Activity}
        >
            <Stack gap={7}>
                <InlineNotification
                    kind="info"
                    title="Diagnostic Tabs"
                    subtitle="Enabled diagnostic tabs will appear in their respective sections throughout the extension."
                    lowContrast
                    hideCloseButton
                />

                {/* Server Diagnostics */}
                <SettingsCard
                    title="Server Connections"
                    description="Test connectivity and authentication for your configured torrent servers."
                >
                    <Stack gap={4}>
                        {settings.servers.map((server, index) => (
                            <ServerDiagnosticRow key={index} server={server} index={index} />
                        ))}
                        {settings.servers.length === 0 && (
                            <div className="text-center py-6 bg-[var(--cds-layer-01)] rounded border border-[var(--cds-border-subtle)] text-[var(--cds-text-secondary)] italic">
                                No servers configured.
                            </div>
                        )}
                    </Stack>
                </SettingsCard>

                {/* External Diagnostics */}
                <SettingsCard
                    title="External Diagnostic Tools"
                    description="Third-party tools to verify browser capabilities like WebRTC and WebTorrent."
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {EXTERNAL_RESOURCES.diagnostics.map((res) => (
                            <Tile
                                key={res.name}
                                className="bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] hover:border-[var(--cds-link-primary)] group transition-colors"
                            >
                                <div className="flex justify-between items-center w-full">
                                    <Stack gap={1}>
                                        <Link
                                            href={res.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-medium inline-flex items-center gap-2"
                                        >
                                            {res.name}
                                            <ExternalLink size={14} />
                                        </Link>
                                        <span className="text-xs text-[var(--cds-text-secondary)]">Check environment support</span>
                                    </Stack>
                                </div>
                            </Tile>
                        ))}
                    </div>
                </SettingsCard>
            </Stack>
        </SettingsPageLayout>
    );
};

const ServerDiagnosticRow: React.FC<{ server: ServerConfig; index: number }> = ({ server, index }) => {
    const [pingStatus, setPingStatus] = useState<{ loading: boolean; result: string | null; error: boolean }>({
        loading: false,
        result: null,
        error: false
    });

    const [authStatus, setAuthStatus] = useState<{ loading: boolean; result: string | null; error: boolean }>({
        loading: false,
        result: null,
        error: false
    });

    const isPrivateIP = (hostname: string) => {
        const host = hostname.replace(/https?:\/\//, '').split(':')[0];
        if (host === 'localhost') return true;
        const parts = host.split('.').map(Number);
        if (parts.length !== 4) return false;
        if (parts[0] === 127) return true;
        if (parts[0] === 10) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        return false;
    };

    const runPing = async () => {
        setPingStatus({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'PING_SERVER', serverIndex: index });
            if (typeof res === 'number') {
                setPingStatus({ loading: false, result: `${res}ms`, error: false });
            } else {
                const isLocal = isPrivateIP(server.hostname);
                setPingStatus({
                    loading: false,
                    result: isLocal ? 'Local Error' : 'Failed',
                    error: true
                });
            }
        } catch {
            setPingStatus({ loading: false, result: 'Error', error: true });
        }
    };

    const runAuthTest = async () => {
        setAuthStatus({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION_SERVER', serverIndex: index });
            if (res?.connected) {
                setAuthStatus({ loading: false, result: 'OK', error: false });
            } else {
                setAuthStatus({ loading: false, result: 'Auth Failed', error: true });
            }
        } catch {
            setAuthStatus({ loading: false, result: 'Error', error: true });
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-[var(--cds-layer-02)] rounded border border-[var(--cds-border-subtle)]">
            <Stack gap={1}>
                <h3 className="font-medium text-[var(--cds-text-primary)]">{server.name || `Server ${index + 1}`}</h3>
                <p className="text-xs text-[var(--cds-text-secondary)]">{server.application} • {server.hostname}</p>
            </Stack>
            <div className="flex items-center space-x-4">
                {/* Ping Control */}
                <div className="flex items-center space-x-2">
                    <Button
                        kind="ghost"
                        size="sm"
                        onClick={runPing}
                        disabled={pingStatus.loading}
                    >
                        {pingStatus.loading ? '...' : 'Ping'}
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono w-[60px] text-right ${pingStatus.error ? 'text-[var(--cds-support-error)]' : 'text-[var(--cds-link-primary)]'}`}>
                            {pingStatus.result || <span className="text-[var(--cds-text-secondary)] opacity-50">-</span>}
                        </span>
                        {pingStatus.error && (
                            <Toggletip align="top-right">
                                <ToggletipButton label="Ping Help">
                                    <Info size={14} className="text-[var(--cds-support-error)]" />
                                </ToggletipButton>
                                <ToggletipContent>
                                    <p className="text-xs">
                                        {pingStatus.result === 'Local Error'
                                            ? "Request blocked. Ensure you have granted host permissions for local IPs in settings."
                                            : "Server timed out or refused connection. Check if the server is running and hostname is correct."}
                                    </p>
                                </ToggletipContent>
                            </Toggletip>
                        )}
                    </div>
                </div>

                {/* Auth Control */}
                <div className="flex items-center space-x-2">
                    <Button
                        kind="ghost"
                        size="sm"
                        onClick={runAuthTest}
                        disabled={authStatus.loading}
                    >
                        {authStatus.loading ? '...' : 'Auth'}
                    </Button>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold w-[70px] text-right ${authStatus.error ? 'text-[var(--cds-support-error)]' : 'text-[var(--cds-support-success)]'}`}>
                            {authStatus.result || <span className="text-[var(--cds-text-secondary)] opacity-50 font-normal">-</span>}
                        </span>
                        {authStatus.error && (
                            <Toggletip align="top-right">
                                <ToggletipButton label="Auth Help">
                                    <Info size={14} className="text-[var(--cds-support-error)]" />
                                </ToggletipButton>
                                <ToggletipContent>
                                    <p className="text-xs">
                                        Authentication failed. Verify your username and password are correct for this client.
                                    </p>
                                </ToggletipContent>
                            </Toggletip>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
