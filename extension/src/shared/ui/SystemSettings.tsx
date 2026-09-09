import React from 'react';
import { BackupCards } from '@/features/torrent-control/ui/DataManagement';
import { SettingsPageLayout } from './settings/SettingsPageLayout';
import { Grid, Column } from '@carbon/react';
import { Wrench } from 'lucide-react';
import { AppOptions } from '@/shared/lib/types';

interface Props {
    settings: AppOptions;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const SystemSettings: React.FC<Props> = ({ settings, exportSystemBackup, importBackup }) => {
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
        </SettingsPageLayout>
    );
};
