import React, { useState } from 'react';
import { Button, Link, Stack, TextInput, Grid, Column, Tile } from '@carbon/react';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { EXTERNAL_RESOURCES } from '@/shared/lib/resources';
import { Activity, Archive, ChevronLeft, Wrench } from 'lucide-react';
import { DiagnosticsSettings } from './DiagnosticsSettings';
import { DataManagement } from './DataManagement';
import { AppOptions, ServerConfig } from '@/shared/lib/types';

interface UtilitiesProps {
    settings: AppOptions;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const Utilities: React.FC<UtilitiesProps> = ({ settings, exportSystemBackup, importBackup }) => {
    const [subView, setSubView] = useState<'main' | 'diagnostics' | 'data'>('main');
    const [magnetInput, setMagnetInput] = useState('');
    const [hashInput, setHashInput] = useState('');

    const convertMagnetToHash = () => {
        try {
            const match = magnetInput.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
            if (match && match[1]) {
                setHashInput(match[1].toUpperCase());
            } else {
                setHashInput('Invalid Magnet Link');
            }
        } catch {
            setHashInput('Error parsing link');
        }
    };

    const convertHashToMagnet = () => {
        if (!hashInput.match(/^[a-fA-F0-9]{40}$/)) {
            setMagnetInput('Invalid 40-char Hex Hash');
            return;
        }
        setMagnetInput(`magnet:?xt=urn:btih:${hashInput.toLowerCase()}`);
    };

    if (subView === 'diagnostics') {
        return (
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-[var(--cds-border-subtle)] bg-[var(--cds-layer-01)] flex items-center">
                    <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={ChevronLeft}
                        iconDescription="Back to Utilities"
                        onClick={() => setSubView('main')}
                    />
                    <span className="ml-2 font-medium">Back to Utilities</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <DiagnosticsSettings settings={settings} />
                </div>
            </div>
        );
    }

    if (subView === 'data') {
        return (
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-[var(--cds-border-subtle)] bg-[var(--cds-layer-01)] flex items-center">
                    <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={ChevronLeft}
                        iconDescription="Back to Utilities"
                        onClick={() => setSubView('main')}
                    />
                    <span className="ml-2 font-medium">Back to Utilities</span>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <DataManagement
                        settings={settings}
                        exportSystemBackup={exportSystemBackup}
                        importBackup={importBackup}
                    />
                </div>
            </div>
        );
    }

    return (
        <SettingsPageLayout
            title={browser.i18n.getMessage('utilitiesTitle')}
            description={browser.i18n.getMessage('utilitiesDescription')}
            icon={Wrench}
        >
            <Grid className="p-0 mb-8" narrow>
                <Column lg={8} md={4} sm={4}>
                    <Tile
                        className="h-full bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] hover:border-[var(--cds-link-primary)] focus:outline focus:outline-2 focus:outline-[var(--cds-focus)] focus:outline-offset-[-2px] cursor-pointer transition-colors p-6"
                        onClick={() => setSubView('diagnostics')}
                        onKeyDown={(e) => e.key === 'Enter' && setSubView('diagnostics')}
                        tabIndex={0}
                        role="button"
                        aria-label="View Diagnostics"
                    >
                        <Stack gap={4}>
                            <div className="flex items-center gap-3">
                                <Activity className="w-6 h-6 text-[var(--cds-link-primary)]" />
                                <h3 className="text-lg font-medium">{browser.i18n.getMessage('utilitiesDiagnostics')}</h3>
                            </div>
                            <p className="text-sm text-[var(--cds-text-secondary)]">
                                Test server connections, verify environment compatibility, and check background worker health.
                            </p>
                            <Button kind="ghost" size="sm" className="p-0 h-auto min-h-0 text-[var(--cds-link-primary)]">
                                {browser.i18n.getMessage('utilitiesViewDiagnostics')}
                            </Button>
                        </Stack>
                    </Tile>
                </Column>
                <Column lg={8} md={4} sm={4}>
                    <Tile
                        className="h-full bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] hover:border-[var(--cds-link-primary)] focus:outline focus:outline-2 focus:outline-[var(--cds-focus)] focus:outline-offset-[-2px] cursor-pointer transition-colors p-6"
                        onClick={() => setSubView('data')}
                        onKeyDown={(e) => e.key === 'Enter' && setSubView('data')}
                        tabIndex={0}
                        role="button"
                        aria-label="Manage Data"
                    >
                        <Stack gap={4}>
                            <div className="flex items-center gap-3">
                                <Archive className="w-6 h-6 text-[var(--cds-link-primary)]" />
                                <h3 className="text-lg font-medium">{browser.i18n.getMessage('utilitiesDataManagement')}</h3>
                            </div>
                            <p className="text-sm text-[var(--cds-text-secondary)]">
                                Export full system backups, configuration snapshots, or import existing settings from file.
                            </p>
                            <Button kind="ghost" size="sm" className="p-0 h-auto min-h-0 text-[var(--cds-link-primary)]">
                                {browser.i18n.getMessage('utilitiesManageData')}
                            </Button>
                        </Stack>
                    </Tile>
                </Column>
            </Grid>

            <SettingsCard title={browser.i18n.getMessage('utilitiesHashConverter')}>
                <Stack gap={5}>
                    <p className="text-sm text-[var(--cds-text-secondary)]">
                        Convert between Magnet links and 40-character info hashes.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                        <TextInput
                            id="magnet-link-input"
                            labelText={browser.i18n.getMessage('utilitiesMagnetLink')}
                            value={magnetInput}
                            onChange={(e) => setMagnetInput(e.target.value)}
                            placeholder="magnet:?xt=urn:btih:..."
                        />
                        <Button onClick={convertMagnetToHash}>{browser.i18n.getMessage('utilitiesExtractHash')}</Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                        <TextInput
                            id="info-hash-input"
                            labelText={browser.i18n.getMessage('utilitiesInfoHash')}
                            value={hashInput}
                            onChange={(e) => setHashInput(e.target.value)}
                            placeholder="e.g. 5B3260..."
                        />
                        <Button kind="secondary" onClick={convertHashToMagnet}>
                            {browser.i18n.getMessage('utilitiesToMagnet')}
                        </Button>
                    </div>
                </Stack>
            </SettingsCard>

            <SettingsCard title="Cache & Recovery">
                <Stack gap={4}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {EXTERNAL_RESOURCES.cache.map((res) => (
                            <div key={res.name} className="p-4 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
                                <Link href={res.url} target="_blank" rel="noopener noreferrer" className="font-medium">
                                    {res.name}
                                </Link>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                        These services cache torrent metadata and can help recover stalled magnet metadata by info hash.
                    </p>
                </Stack>
            </SettingsCard>

            <SettingsCard title="Privacy & Diagnostics">
                <Stack gap={4}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[...EXTERNAL_RESOURCES.privacy, ...EXTERNAL_RESOURCES.diagnostics].map((res) => (
                            <div key={res.name} className="p-4 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
                                <Link href={res.url} target="_blank" rel="noopener noreferrer" className="font-medium">
                                    {res.name}
                                </Link>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                        Tools to verify network privacy and browser torrent capability.
                    </p>
                </Stack>
            </SettingsCard>
        </SettingsPageLayout>
    );
};
