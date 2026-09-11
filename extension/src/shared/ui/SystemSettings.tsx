import React, { useState } from 'react';
import { BackupCards } from '@/features/torrent-control/ui/DataManagement';
import { SettingsPageLayout } from './settings/SettingsPageLayout';
import { SettingsCard } from './settings/SettingsCard';
import { ResetVaultDialog } from './security/ResetVaultDialog';
import { Button, Grid, Column, Stack } from '@carbon/react';
import { Wrench } from 'lucide-react';
import { AppOptions } from '@/shared/lib/types';

interface Props {
    settings: AppOptions;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
    /** Destroys the vault after the user's explicit confirmation. */
    resetVault: () => Promise<void>;
}

export const SystemSettings: React.FC<Props> = ({ settings, exportSystemBackup, importBackup, resetVault }) => {
    const [resetOpen, setResetOpen] = useState(false);

    return (
        <SettingsPageLayout
            title={browser.i18n.getMessage('systemTitle')}
            description="Back up or restore your CTRL configuration."
            icon={Wrench}
        >
            <Grid className="p-0" narrow>
                <Column lg={8} md={4} sm={4}>
                    <BackupCards
                        settings={settings}
                        exportSystemBackup={exportSystemBackup}
                        importBackup={importBackup}
                    />
                </Column>
            </Grid>

            <SettingsCard
                title="Reset vault"
                description="Delete every saved server and the master password from this browser and start over."
            >
                <Stack gap={4}>
                    <p className="text-sm text-[var(--cds-text-secondary)] m-0">
                        Use this to choose a new master password or before handing the browser to someone else. Export your
                        servers first if you want to keep them; the reset cannot be undone.
                    </p>
                    <div>
                        <Button kind="danger--tertiary" size="sm" onClick={() => setResetOpen(true)}>
                            Reset vault…
                        </Button>
                    </div>
                </Stack>
            </SettingsCard>

            <ResetVaultDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={resetVault} />
        </SettingsPageLayout>
    );
};
