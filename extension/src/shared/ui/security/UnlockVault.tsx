import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { VaultService, VaultCorruptedError } from '@/shared/api/security/VaultService';
import {
    Button,
    PasswordInput,
    Stack,
    Tile,
    Loading,
    InlineNotification
} from '@carbon/react';
import { ResetVaultDialog } from './ResetVaultDialog';

interface UnlockVaultProps {
    onUnlock: () => void;
    /** Popup-sized layout: no full-height centering. */
    compact?: boolean;
    /**
     * When provided, offers "Forgot your master password?" which resets the
     * vault after explicit confirmation. Omitted in the popup, which points
     * to the settings page instead.
     */
    onReset?: () => Promise<void>;
}

export const UnlockVault: React.FC<UnlockVaultProps> = ({ onUnlock, compact = false, onReset }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const success = await VaultService.unlock(password);
            if (success) {
                onUnlock();
            } else {
                setError('Incorrect password');
            }
        } catch (err) {
            if (err instanceof VaultCorruptedError) {
                setError('The stored vault data is incomplete or damaged and cannot be unlocked. Open CTRL settings to reset it.');
            } else {
                setError('Unlock failed. Please try again.');
            }
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`flex flex-col items-center justify-center bg-[var(--cds-background)] p-4 ${compact ? 'min-h-full' : 'h-screen'}`}>
            <Tile className={`w-full max-w-sm bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)] ${compact ? 'p-5' : 'p-8'}`}>
                <Stack gap={6}>
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-[var(--cds-layer-03)] rounded-full flex items-center justify-center mb-4 text-[var(--cds-link-primary)]">
                            <Lock size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-[var(--cds-text-primary)]">Unlock CTRL</h1>
                        <p className="text-center text-[var(--cds-text-secondary)] mt-2">
                            Enter your master password to access your torrent clients.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <Stack gap={6}>
                            <PasswordInput
                                id="master-password-unlock"
                                labelText="Master Password"
                                hideLabel
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Master Password"
                                required
                                autoFocus
                                autoComplete="current-password"
                            />

                            {error && (
                                <InlineNotification
                                    kind="error"
                                    title="Unlock Failed"
                                    subtitle={error}
                                    lowContrast
                                    hideCloseButton
                                />
                            )}

                            <div className="relative mt-2">
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full"
                                    renderIcon={Unlock}
                                >
                                    Unlock
                                </Button>
                                {loading && <Loading withOverlay={false} small className="absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>
                        </Stack>
                    </form>

                    {onReset && (
                        <div className="text-center">
                            <Button kind="ghost" size="sm" onClick={() => setResetOpen(true)}>
                                Forgot your master password?
                            </Button>
                            <p className="text-xs text-[var(--cds-text-helper)] mt-1 m-0">
                                The password cannot be recovered. Resetting deletes the saved servers so you can start again.
                            </p>
                        </div>
                    )}
                </Stack>
            </Tile>

            {onReset && (
                <ResetVaultDialog open={resetOpen} onClose={() => setResetOpen(false)} onConfirm={onReset} />
            )}
        </div>
    );
};
