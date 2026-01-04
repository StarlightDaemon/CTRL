import React, { useState } from 'react';
import { Card } from '@/features/audiobook-bay/ui/ui/Card';
import { BackupCards } from '@/features/torrent-control/ui/DataManagement';
import { SettingsCard } from './settings/SettingsCard';
import { Button } from '@/features/audiobook-bay/ui/ui/Button';

import { Download, BookHeadphones } from 'lucide-react';
import { AppOptions } from '@/shared/lib/types';
import { ABBSettings } from '@/features/audiobook-bay/lib/types';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
    abbSettings: ABBSettings | null;
    updateABBSettings: (newSettings: ABBSettings) => void;
    // Backup Props
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const SystemSettings: React.FC<Props> = ({ settings, updateSettings, abbSettings, updateABBSettings, exportSystemBackup, importBackup }) => {
    const [globalPing, setGlobalPing] = useState<{ loading: boolean; result: string | null; error: boolean }>({ loading: false, result: null, error: false });
    const [selfTest, setSelfTest] = useState<{ loading: boolean; result: any | null; error: boolean }>({ loading: false, result: null, error: false });
    const [pingTarget, setPingTarget] = useState<string>('google');
    const [debugEnabled, setDebugEnabled] = useState(false);

    // Diagnostics State Logic
    const isTCEnabled = settings.globals.showDiagnostics;
    const isABBEnabled = abbSettings?.showDiagnostics || false;
    const is1337xEnabled = settings['1337x']?.showDiagnostics || false;
    const allEnabled = isTCEnabled && isABBEnabled && is1337xEnabled;

    const toggleAll = () => {
        const newState = !allEnabled;
        const newSettings = {
            ...settings,
            globals: { ...settings.globals, showDiagnostics: newState },
        };
        if (newSettings['1337x']) {
            newSettings['1337x'] = { ...newSettings['1337x'], showDiagnostics: newState };
        }
        updateSettings(newSettings);
        if (abbSettings) {
            updateABBSettings({ ...abbSettings, showDiagnostics: newState });
        }
    };

    const toggleTC = () => {
        updateSettings({
            ...settings,
            globals: { ...settings.globals, showDiagnostics: !isTCEnabled },
        });
    };

    const toggleABB = () => {
        if (!abbSettings) return;
        updateABBSettings({ ...abbSettings, showDiagnostics: !isABBEnabled });
    };

    const toggle1337x = () => {
        if (!settings['1337x']) return;
        updateSettings({
            ...settings,
            '1337x': { ...settings['1337x'], showDiagnostics: !is1337xEnabled },
        });
    };

    React.useEffect(() => {
        const handleStateChange = (e: Event) => {
            const customEvent = e as CustomEvent;
            setDebugEnabled(customEvent.detail.enabled);
        };

        window.addEventListener('UI_DEBUG_STATE_CHANGE', handleStateChange);
        window.dispatchEvent(new CustomEvent('GET_UI_DEBUG_STATE'));

        return () => {
            window.removeEventListener('UI_DEBUG_STATE_CHANGE', handleStateChange);
        };
    }, []);

    const runGlobalPing = async () => {
        setGlobalPing({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'PING_GLOBAL', target: pingTarget });
            if (res >= 0) {
                setGlobalPing({ loading: false, result: `${res}ms`, error: false });
            } else {
                setGlobalPing({ loading: false, result: 'Unreachable', error: true });
            }
        } catch (e) {
            setGlobalPing({ loading: false, result: 'Error', error: true });
        }
    };

    const runSelfTest = async () => {
        setSelfTest({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'SELF_TEST' });
            setSelfTest({ loading: false, result: res, error: false });
        } catch (e) {
            setSelfTest({ loading: false, result: 'Failed', error: true });
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-4">System Diagnostics</h1>

            {/* Diagnostics Control Board (Moved from AboutTab) */}
            <SettingsCard
                className="border-accent/20"
                headerActions={
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-text-secondary">
                            {allEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={allEnabled}
                                onChange={toggleAll}
                            />
                            <div className="w-11 h-6 bg-surface peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                    </div>
                }
            >
                <h2 className="text-lg font-medium text-text-primary mb-4">Diagnostics & Testing</h2>
                <div className="space-y-4">
                    {/* Torrent Control */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface/50 border border-border">
                        <div className="flex items-center space-x-3">
                            <Download className="w-5 h-5 text-accent" />
                            <div>
                                <span className="font-medium text-text-primary">Torrent Control</span>
                                <p className="text-xs text-text-secondary">Connection tests, logs, and raw client data.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isTCEnabled}
                                onChange={toggleTC}
                            />
                            <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
                        </label>
                    </div>

                    {/* AudioBook Bay */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-surface/50 border border-border">
                        <div className="flex items-center space-x-3">
                            <BookHeadphones className="w-5 h-5 text-green-500" />
                            <div>
                                <span className="font-medium text-text-primary">AudioBook Bay</span>
                                <p className="text-xs text-text-secondary">Mirror latency, parsing errors, and storage state.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isABBEnabled}
                                onChange={toggleABB}
                                disabled={!abbSettings}
                            />
                            <div className="w-11 h-6 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                        </label>
                    </div>


                </div>
            </SettingsCard>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BackupCards
                    settings={settings}
                    exportSystemBackup={exportSystemBackup}
                    importBackup={importBackup}
                />
                {/* System Health */}
                <Card className="flex flex-col h-96">
                    <h2 className="text-lg font-medium text-text-primary mb-4">Connectivity</h2>
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <h3 className="font-medium text-text-primary mb-2">Internet Check</h3>
                            <p className="text-xs text-text-secondary mb-3">Verify the extension can reach the public internet.</p>

                            <div className="flex items-center space-x-2 mb-3">
                                <select
                                    value={pingTarget}
                                    onChange={(e) => setPingTarget(e.target.value)}
                                    className="text-xs bg-input border border-border rounded p-1 text-text-primary flex-1"
                                >
                                    <option value="google">Google (Global)</option>
                                    <option value="cloudflare">Cloudflare (Global)</option>
                                    <option value="baidu">Baidu (China)</option>
                                    <option value="yandex">Yandex (Russia)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between h-8 mt-4">
                            <Button
                                onClick={runGlobalPing}
                                disabled={globalPing.loading}
                                size="sm"
                                variant="secondary"
                                className="min-w-[80px]"
                            >
                                {globalPing.loading ? '...' : 'Ping Test'}
                            </Button>
                            <span className={`text-sm font-mono ml-3 ${globalPing.error ? 'text-red-500' : 'text-accent'}`}>
                                {globalPing.result || <span className="text-text-secondary italic text-xs">No result</span>}
                            </span>
                        </div>
                    </div>
                </Card>

                {/* Extension Health */}
                <Card className="flex flex-col h-96">
                    <h2 className="text-lg font-medium text-text-primary mb-4">Environment</h2>
                    <div className="flex-1 flex flex-col justify-between">
                        <div>
                            <p className="text-xs text-text-secondary mb-3">Runtime environment details and background worker status.</p>
                            {selfTest.result ? (
                                <div className="text-xs space-y-1 bg-surface p-2 rounded border border-border">
                                    <div className="flex justify-between"><span className="text-text-secondary">Status:</span> <span className="text-green-500">{selfTest.result.status}</span></div>
                                    <div className="flex justify-between"><span className="text-text-secondary">Version:</span> <span>{selfTest.result.version}</span></div>
                                    <div className="flex justify-between"><span className="text-text-secondary">Uptime:</span> <span>{Math.round(selfTest.result.uptime / 1000)}s</span></div>
                                    <div className="flex justify-between"><span className="text-text-secondary">Platform:</span> <span>{selfTest.result.platform}</span></div>
                                    <div className="flex justify-between"><span className="text-text-secondary">User Agent:</span> <span className="truncate w-24" title={selfTest.result.userAgent}>{selfTest.result.userAgent}</span></div>
                                </div>
                            ) : (
                                <div className="text-xs text-text-secondary italic py-2 text-center bg-surface rounded border border-border">
                                    Click run to view stats.
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={runSelfTest}
                                disabled={selfTest.loading}
                                size="sm"
                                variant="secondary"
                                className="w-full"
                            >
                                {selfTest.loading ? 'Running...' : 'Run Self-Test'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Developer Tools (Debug Mode Only) */}
            {
                typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__ && (
                    <Card>
                        <h2 className="text-lg font-medium text-text-primary mb-4">Developer Tools</h2>
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-medium text-text-primary">UI Debug Mode</h3>
                                <p className="text-xs text-text-secondary">Inspect React components by hovering.</p>
                            </div>
                            <Button
                                onClick={() => window.dispatchEvent(new CustomEvent('TOGGLE_UI_DEBUG'))}
                                size="sm"
                                className={debugEnabled ? 'bg-red-500 hover:bg-red-600' : ''}
                            >
                                {debugEnabled ? 'Disable Overlay' : 'Enable Overlay'}
                            </Button>
                        </div>
                        <p className="text-xs text-text-secondary mt-2">
                            Shortcut: <kbd className="bg-surface px-1 rounded border border-border">Ctrl</kbd> + <kbd className="bg-surface px-1 rounded border border-border">Shift</kbd> + <kbd className="bg-surface px-1 rounded border border-border">U</kbd>
                        </p>
                    </Card>
                )
            }
        </div >
    );
};
