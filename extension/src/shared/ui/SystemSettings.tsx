import React, { useState } from 'react';
import { BackupCards } from '@/features/torrent-control/ui/DataManagement';
import { SettingsCard } from './settings/SettingsCard';
import { SettingsPageLayout } from './settings/SettingsPageLayout';
import {
    Button,
    Toggle,
    Stack,
    Grid,
    Column
} from '@carbon/react';

import { Wrench, Activity } from 'lucide-react';
import { AppOptions } from '@/shared/lib/types';

interface Props {
    settings: AppOptions;
    updateSettings: (newSettings: AppOptions) => void;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

interface SelfTestResult {
    status: string;
    version: string;
    uptime: number;
    platform: string;
    userAgent: string;
}

export const SystemSettings: React.FC<Props> = ({ settings, updateSettings, exportSystemBackup, importBackup }) => {
    const [selfTest, setSelfTest] = useState<{ loading: boolean; result: SelfTestResult | null; error: boolean }>({ loading: false, result: null, error: false });
    const [debugEnabled, setDebugEnabled] = useState(false);

    const isTCEnabled = settings.globals.showDiagnostics;

    const toggleTC = () => {
        updateSettings({
            ...settings,
            globals: { ...settings.globals, showDiagnostics: !isTCEnabled },
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

    const runSelfTest = async () => {
        setSelfTest({ loading: true, result: null, error: false });
        try {
            const res = await chrome.runtime.sendMessage({ type: 'SELF_TEST' });
            setSelfTest({ loading: false, result: res, error: false });
        } catch {
            setSelfTest({ loading: false, result: null, error: true });
        }
    };

    return (
        <SettingsPageLayout
            title={browser.i18n.getMessage('systemTitle')}
            description={browser.i18n.getMessage('systemDescription')}
            icon={Wrench}
        >
            <Stack gap={7}>
                {/* Diagnostics Control Board */}
                <SettingsCard
                    title={browser.i18n.getMessage('systemDiagnostics')}
                    description="Enable advanced debugging tools and connection diagnostics."
                >
                    <Stack gap={4}>
                        <div className="flex items-center justify-between p-4 bg-[var(--cds-layer-01)] rounded border border-[var(--cds-border-subtle)]">
                            <div className="flex items-center space-x-3">
                                <Activity className="w-5 h-5 text-[var(--cds-link-primary)]" />
                                <Stack gap={1}>
                                    <span className="font-medium text-[var(--cds-text-primary)]">{browser.i18n.getMessage('systemEnhancedDiagnostics')}</span>
                                    <p className="text-xs text-[var(--cds-text-secondary)]">Show connection tests and raw client data tabs.</p>
                                </Stack>
                            </div>
                            <Toggle
                                id="tc-diagnostics-toggle"
                                labelA={browser.i18n.getMessage('commonOff')}
                                labelB={browser.i18n.getMessage('commonOn')}
                                toggled={isTCEnabled}
                                onToggle={toggleTC}
                                size="sm"
                                hideLabel
                            />
                        </div>
                    </Stack>
                </SettingsCard>

                <Grid className="p-0" narrow>
                    <Column lg={8} md={4} sm={4}>
                        <BackupCards
                            settings={settings}
                            exportSystemBackup={exportSystemBackup}
                            importBackup={importBackup}
                        />
                    </Column>
                    <Column lg={8} md={4} sm={4}>
                        <SettingsCard
                            title={browser.i18n.getMessage('systemHealth')}
                            description="Runtime details and background worker status."
                        >
                            <Stack gap={4} className="flex-1">
                                <p className="text-xs text-[var(--cds-text-secondary)]">Runtime details and background worker status.</p>

                                {selfTest.result ? (
                                    <div className="text-xs space-y-1 bg-[var(--cds-layer-02)] p-3 rounded border border-[var(--cds-border-subtle)] font-mono">
                                        <div className="flex justify-between"><span className="text-[var(--cds-text-secondary)]">{browser.i18n.getMessage('commonStatus')}:</span> <span className="text-[var(--cds-support-success)]">{selfTest.result.status}</span></div>
                                        <div className="flex justify-between"><span className="text-[var(--cds-text-secondary)]">{browser.i18n.getMessage('commonVersion')}:</span> <span>{selfTest.result.version}</span></div>
                                        <div className="flex justify-between"><span className="text-[var(--cds-text-secondary)]">{browser.i18n.getMessage('commonUptime')}:</span> <span>{Math.round(selfTest.result.uptime / 1000)}s</span></div>
                                        <div className="flex justify-between"><span className="text-[var(--cds-text-secondary)]">{browser.i18n.getMessage('commonPlatform')}:</span> <span>{selfTest.result.platform}</span></div>
                                        <div className="flex justify-between"><span className="text-[var(--cds-text-secondary)]">User Agent:</span> <span className="truncate w-32" title={selfTest.result.userAgent}>{selfTest.result.userAgent}</span></div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-[var(--cds-text-secondary)] italic py-6 text-center bg-[var(--cds-layer-02)] rounded border border-[var(--cds-border-subtle)]">
                                        Click run to view health stats.
                                    </div>
                                )}

                                <div className="mt-auto">
                                    <Button
                                        onClick={runSelfTest}
                                        disabled={selfTest.loading}
                                        kind="secondary"
                                        size="sm"
                                        className="w-full"
                                    >
                                        {selfTest.loading ? browser.i18n.getMessage('systemRunning') : browser.i18n.getMessage('systemRunSelfTest')}
                                    </Button>
                                </div>
                            </Stack>
                        </SettingsCard>
                    </Column>
                </Grid>

                {/* Developer Tools (Debug Mode Only) */}
                {typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__ && (
                    <SettingsCard title="Developer Tools" description="Internal tools for extension development and inspection.">
                        <div className="flex items-center justify-between p-4 bg-[var(--cds-layer-01)] rounded border border-[var(--cds-border-subtle)]">
                            <Stack gap={1}>
                                <h3 className="font-medium text-[var(--cds-text-primary)]">UI Debug Overlay</h3>
                                <p className="text-xs text-[var(--cds-text-secondary)]">Toggle component inspection and layout guides.</p>
                            </Stack>
                            <Button
                                onClick={() => window.dispatchEvent(new CustomEvent('TOGGLE_UI_DEBUG'))}
                                size="sm"
                                kind={debugEnabled ? 'danger' : 'tertiary'}
                            >
                                {debugEnabled ? 'Disable Overlay' : 'Enable Overlay'}
                            </Button>
                        </div>
                        <p className="text-xs text-[var(--cds-text-helper)] mt-4">
                            Shortcut: <kbd className="bg-[var(--cds-layer-03)] px-1.5 py-0.5 rounded border border-[var(--cds-border-subtle)] font-sans">Ctrl</kbd> + <kbd className="bg-[var(--cds-layer-03)] px-1.5 py-0.5 rounded border border-[var(--cds-border-subtle)] font-sans">Shift</kbd> + <kbd className="bg-[var(--cds-layer-03)] px-1.5 py-0.5 rounded border border-[var(--cds-border-subtle)] font-sans">U</kbd>
                        </p>
                    </SettingsCard>
                )}
            </Stack>
        </SettingsPageLayout>
    );
};
