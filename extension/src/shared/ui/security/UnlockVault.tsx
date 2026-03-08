import React, { useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { VaultService } from '@/shared/api/security/VaultService';
import {
    Button,
    PasswordInput,
    Stack,
    Tile,
    Loading,
    InlineNotification
} from '@carbon/react';

interface UnlockVaultProps {
    onUnlock: () => void;
}

export const UnlockVault: React.FC<UnlockVaultProps> = ({ onUnlock }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
            setError('An error occurred');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[var(--cds-background)] p-4">
            <Tile className="w-full max-w-sm p-8 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
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
                </Stack>
            </Tile>
        </div>
    );
};
