import React, { useState } from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Archive, Download, Upload } from 'lucide-react';
import { Button, Stack, ToastNotification } from '@carbon/react';

interface Props {
    settings: AppOptions;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const BackupCards: React.FC<Props> = ({ settings, exportSystemBackup, importBackup }) => {
    const [notification, setNotification] = useState<{ kind: 'success' | 'error', title: string, subtitle: string } | null>(null);

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const result = await importBackup(file);
                setNotification({
                    kind: 'success',
                    title: 'Import Successful',
                    subtitle: result.message
                });
                setTimeout(() => window.location.reload(), 1500);
            } catch (error: any) {
                setNotification({
                    kind: 'error',
                    title: 'Import Failed',
                    subtitle: error.message
                });
            }
            e.target.value = ''; // Reset input
        }
    };

    return (
        <>
            {notification && (
                <div className="fixed top-4 right-4 z-[100]">
                    <ToastNotification
                        kind={notification.kind}
                        title={notification.title}
                        subtitle={notification.subtitle}
                        timeout={notification.kind === 'success' ? 2000 : 5000}
                        onClose={() => setNotification(null)}
                    />
                </div>
            )}
            {/* Full System Backup */}
            <SettingsCard title="System Backup" className="flex flex-col h-full">
                <Stack gap={4} className="flex-1">
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                        Export your entire extension state, including site integrations and global preferences.
                        <br /><br />
                        <em>Passwords are removed by default unless you choose otherwise.</em>
                    </p>
                    <Stack gap={2}>
                        <Button
                            kind="primary"
                            size="sm"
                            onClick={() => exportSystemBackup('full', true)}
                            renderIcon={Download}
                            className="w-full"
                        >
                            Export System (Safe)
                        </Button>
                        <Button
                            kind="secondary"
                            size="sm"
                            onClick={() => exportSystemBackup('full', false)}
                            renderIcon={Download}
                            className="w-full"
                        >
                            Export Full (With Secrets)
                        </Button>
                        <label className="cursor-pointer w-full block">
                            <Button
                                kind="ghost"
                                size="sm"
                                as="span"
                                renderIcon={Upload}
                                className="w-full"
                            >
                                Import Backup
                            </Button>
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleImport}
                            />
                        </label>
                    </Stack>
                </Stack>
            </SettingsCard>

            {/* Settings Only */}
            <SettingsCard title="Configuration Only" className="flex flex-col h-full">
                <Stack gap={4} className="flex-1">
                    <p className="text-xs text-[var(--cds-text-secondary)]">
                        Export only your appearance and behavior settings. Does not include any server details or accounts.
                    </p>
                    <Button
                        kind="secondary"
                        size="sm"
                        onClick={() => exportSystemBackup('settings')}
                        renderIcon={Download}
                        className="w-full"
                    >
                        Export Config
                    </Button>
                </Stack>
            </SettingsCard>
        </>
    );
};

export const DataManagement: React.FC<Props> = (props) => {
    return (
        <SettingsPageLayout
            title="Data Management"
            description="Manage your extension configuration. Create backups of your settings or perform a full system export."
            icon={Archive}
        >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <BackupCards {...props} />
            </div>
        </SettingsPageLayout>
    );
};
