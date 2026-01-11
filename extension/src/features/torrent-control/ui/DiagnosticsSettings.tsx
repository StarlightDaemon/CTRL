import React, { useState } from 'react';
import { AppOptions, ServerConfig } from '@/shared/lib/types';
import { EXTERNAL_RESOURCES } from '@/shared/lib/resources';
import { ExternalLink, Info } from 'lucide-react';

interface Props {
    settings: AppOptions;
}

export const DiagnosticsSettings: React.FC<Props> = ({ settings }) => {

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-4 flex items-start">
                <Info className="w-5 h-5 text-accent mr-3 mt-0.5 shrink-0" />
                <p className="text-sm text-text-primary">
                    Enabled diagnostic tabs will appear in their respective sections throughout the extension.
                </p>
            </div>
            {/* Server Diagnostics */}
            <div className="bg-panel rounded-lg p-6 border border-border">
                <h2 className="text-lg font-medium text-text-primary mb-4">Server Connections</h2>
                <div className="space-y-4">
                    {settings.servers.map((server, index) => (
                        <ServerDiagnosticRow key={index} server={server} index={index} />
                    ))}
                    {settings.servers.length === 0 && (
                        <p className="text-sm text-text-secondary italic">No servers configured.</p>
                    )}
                </div>
            </div>

            {/* External Diagnostics */}
            <div className="bg-panel rounded-lg p-6 border border-border">
                <h2 className="text-lg font-medium text-text-primary mb-4">External Diagnostic Tools</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {EXTERNAL_RESOURCES.diagnostics.map((res) => (
                        <a
                            key={res.name}
                            href={res.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:border-accent group transition-colors"
                        >
                            <div className="flex flex-col">
                                <span className="font-medium text-text-primary">{res.name}</span>
                                <span className="text-xs text-text-secondary">Check WebRTC & WebTorrent Support</span>
                            </div>
                            <ExternalLink size={16} className="text-text-secondary group-hover:text-accent" />
                        </a>
                    ))}
                </div>
            </div>
        </div>
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
        // Remove protocol and port
        let host = hostname.replace(/https?:\/\//, '').split(':')[0];

        if (host === 'localhost') return true;

        // IPv4 check
        const parts = host.split('.').map(Number);
        if (parts.length !== 4) return false;

        // 127.0.0.0/8
        if (parts[0] === 127) return true;
        // 10.0.0.0/8
        if (parts[0] === 10) return true;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 172.16.0.0/12
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
                    result: isLocal ? 'Local Network Error' : 'Failed',
                    error: true
                });
            }
        } catch (e) {
            const isLocal = isPrivateIP(server.hostname);
            setPingStatus({
                loading: false,
                result: isLocal ? 'Local Network Error' : 'Error',
                error: true
            });
        }
    };

    const runAuthTest = async () => {
        setAuthStatus({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION_SERVER', serverIndex: index });
            if (res === true) {
                setAuthStatus({ loading: false, result: 'OK', error: false });
            } else {
                setAuthStatus({ loading: false, result: 'Auth Failed', error: true });
            }
        } catch (e) {
            setAuthStatus({ loading: false, result: 'Error', error: true });
        }
    };

    return (
        <div className="flex items-center justify-between p-4 bg-surface rounded border border-border">
            <div>
                <h3 className="font-medium text-text-primary">{server.name || `Server ${index + 1}`}</h3>
                <p className="text-xs text-text-secondary">{server.type} • {server.hostname}</p>
            </div>
            <div className="flex items-center space-x-4">
                {/* Ping Control */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={runPing}
                        disabled={pingStatus.loading}
                        className="px-3 py-1.5 text-xs bg-surface border border-border text-text-primary rounded hover:bg-hover transition-colors min-w-[60px]"
                    >
                        {pingStatus.loading ? '...' : 'Ping'}
                    </button>
                    <span className={`text-xs font-mono w-[60px] text-right ${pingStatus.error ? 'text-red-500' : 'text-accent'}`}>
                        {pingStatus.result || <span className="text-text-secondary opacity-50">-</span>}
                    </span>
                </div>

                {/* Auth Control */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={runAuthTest}
                        disabled={authStatus.loading}
                        className="px-3 py-1.5 text-xs bg-surface border border-border text-text-primary rounded hover:bg-hover transition-colors min-w-[80px]"
                    >
                        {authStatus.loading ? '...' : 'Test Auth'}
                    </button>
                    <span className={`text-xs font-bold w-[70px] text-right ${authStatus.error ? 'text-red-500' : 'text-green-500'}`}>
                        {authStatus.result || <span className="text-text-secondary opacity-50 font-normal">-</span>}
                    </span>
                </div>
            </div>
        </div>
    );
};
