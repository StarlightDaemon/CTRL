import React, { useEffect, useState } from 'react';
import { Checkbox, InlineNotification, Modal, Stack } from '@carbon/react';

interface Props {
    open: boolean;
    onClose: () => void;
    /** Performs the reset. Rejections are shown in the dialog. */
    onConfirm: () => Promise<void>;
}

export const RESET_VAULT_ACKNOWLEDGE_ID = 'reset-vault-acknowledge';

/**
 * Explicit confirmation before the vault is destroyed. The primary action
 * stays disabled until the user ticks the acknowledgement, and the text
 * states precisely what is deleted and what is kept.
 */
export const ResetVaultDialog: React.FC<Props> = ({ open, onClose, onConfirm }) => {
    const [acknowledged, setAcknowledged] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setAcknowledged(false);
            setError(null);
            setBusy(false);
        }
    }, [open]);

    const submit = async () => {
        if (!acknowledged || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
            onClose();
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The vault could not be reset.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal
            open={open}
            danger
            modalHeading="Reset the CTRL vault?"
            modalLabel="This cannot be undone"
            primaryButtonText={busy ? 'Resetting…' : 'Delete servers and reset'}
            secondaryButtonText="Cancel"
            primaryButtonDisabled={!acknowledged || busy}
            onRequestClose={() => { if (!busy) onClose(); }}
            onRequestSubmit={() => { void submit(); }}
            size="sm"
        >
            <Stack gap={5}>
                <p className="text-sm m-0">Resetting deletes, from this browser only:</p>
                <ul className="text-sm list-disc pl-5 m-0">
                    <li>every saved server: its address, username and password;</li>
                    <li>the master password. The encryption key is discarded, so the servers above cannot be recovered.</li>
                </ul>
                <p className="text-sm m-0">
                    Your preferences (context menu, badge, add-paused, notifications, labels) are kept. Nothing changes on your
                    torrent clients or their downloads. Afterwards CTRL asks you to choose a new master password.
                </p>
                <Checkbox
                    id={RESET_VAULT_ACKNOWLEDGE_ID}
                    labelText="I understand that every saved server and login will be deleted"
                    checked={acknowledged}
                    onChange={(_event, { checked }) => setAcknowledged(checked)}
                    disabled={busy}
                />
                {error && (
                    <InlineNotification kind="error" title="Reset failed" subtitle={error} lowContrast hideCloseButton role="alert" />
                )}
            </Stack>
        </Modal>
    );
};
