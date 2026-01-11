import React, { useState, useEffect } from 'react';
import { AppOptions } from '@/shared/lib/types';
import { SettingsPageLayout } from '@/shared/ui/settings/SettingsPageLayout';
import { SettingsCard } from '@/shared/ui/settings/SettingsCard';
import { Archive, Save, Upload, Download } from 'lucide-react';

interface Props {
    settings: AppOptions;
    exportSystemBackup: (type?: 'full' | 'settings', sanitize?: boolean) => void;
    importBackup: (file: File) => Promise<{ success: boolean; message: string }>;
}

export const BackupCards: React.FC<Props> = ({ settings, exportSystemBackup, importBackup }) => {
    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const result = await importBackup(file);
                alert(result.message);
                window.location.reload();
            } catch (error: any) {
                alert('Failed to import: ' + error.message);
            }
            e.target.value = ''; // Reset input
        }
    };

    return (
        <>
            {/* Full System Backup */}
            <SettingsCard title="System Backup" className="flex flex-col h-full">
                <p className="text-xs text-text-secondary mb-4 flex-1">
                    Export your entire extension state, including site integrations and global preferences.
                    <br /><br />
                    <em>Passwords are removed by default unless you choose otherwise.</em>
                </p>
                <div className="flex flex-col space-y-2">
                    <button
                        onClick={() => exportSystemBackup('full', true)}
                        className="w-full px-3 py-2 text-sm bg-accent text-white rounded hover:bg-accent-hover flex items-center justify-center space-x-2"
                    >
                        <Download size={16} />
                        <span>Export System (Safe)</span>
                    </button>
                    <button
                        onClick={() => exportSystemBackup('full', false)}
                        className="w-full px-3 py-2 text-sm bg-secondary border border-border text-text-primary rounded hover:bg-card flex items-center justify-center space-x-2"
                    >
                        <Download size={16} />
                        <span>Export Full (With Secrets)</span>
                    </button>
                    <label className="cursor-pointer w-full px-3 py-2 text-sm bg-secondary border border-border text-text-primary rounded hover:bg-card text-center block flex items-center justify-center space-x-2">
                        <Upload size={16} />
                        <span>Import Backup</span>
                        <input
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={handleImport}
                        />
                    </label>
                </div>
            </SettingsCard>

            {/* Settings Only */}
            <SettingsCard title="Configuration Only" className="flex flex-col h-full">
                <p className="text-xs text-text-secondary mb-4 flex-1">Export only your appearance and behavior settings. Does not include any server details or accounts.</p>
                <div className="flex flex-col space-y-2">
                    <button
                        onClick={() => exportSystemBackup('settings')}
                        className="w-full px-3 py-2 text-sm bg-secondary border border-border text-text-primary rounded hover:bg-card flex items-center justify-center space-x-2"
                    >
                        <Download size={16} />
                        <span>Export Config</span>
                    </button>
                </div>
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
