import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button, InlineNotification, Stack, Tile } from '@carbon/react';
import { ResetVaultDialog } from './ResetVaultDialog';

interface Props {
    onReset: () => Promise<void>;
}

/**
 * Shown when the stored vault material is incomplete or malformed. The only
 * way forward is a reset; the dialog spells out exactly what that deletes.
 */
export const VaultCorrupted: React.FC<Props> = ({ onReset }) => {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[var(--cds-background)] p-4">
            <Tile className="w-full max-w-md p-8 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
                <Stack gap={6}>
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-[var(--cds-layer-03)] rounded-full flex items-center justify-center mb-4 text-[var(--cds-support-error)]">
                            <ShieldAlert size={32} aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-bold text-[var(--cds-text-primary)]">Vault damaged</h1>
                    </div>

                    <InlineNotification
                        kind="error"
                        title="The vault cannot be unlocked"
                        subtitle="The encrypted data CTRL stored in this browser is incomplete or damaged, so no password can decrypt it. CTRL will not guess: the saved servers stay unreadable until the vault is reset."
                        lowContrast
                        hideCloseButton
                        role="alert"
                    />

                    <p className="text-sm text-[var(--cds-text-secondary)] m-0">
                        Resetting deletes the saved servers and the master password from this browser and lets you set CTRL up
                        again. If you have a server export, you can import it afterwards.
                    </p>

                    <Button kind="danger" onClick={() => setDialogOpen(true)} className="w-full">
                        Reset vault…
                    </Button>
                </Stack>
            </Tile>

            <ResetVaultDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onConfirm={onReset} />
        </div>
    );
};
