import React, { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { VaultService } from '@/shared/api/security/VaultService';
import {
    Button,
    PasswordInput,
    Stack,
    InlineNotification,
    Tile,
    Loading
} from '@carbon/react';

interface SetupVaultProps {
    onComplete: () => void;
}

export const SetupVault: React.FC<SetupVaultProps> = ({ onComplete }) => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [hasLegacy, setHasLegacy] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        VaultService.hasLegacyData().then(setHasLegacy);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (password !== confirm) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            if (hasLegacy) {
                await VaultService.migrateLegacyData(password);
            } else {
                await VaultService.initialize(password);
            }
            onComplete();
        } catch (err) {
            setError('Failed to setup vault. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[var(--cds-background)] p-4">
            <Tile className="w-full max-w-md p-8 bg-[var(--cds-layer-01)] border border-[var(--cds-border-subtle)]">
                <Stack gap={6}>
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 bg-[var(--cds-layer-03)] rounded-full flex items-center justify-center mb-4 text-[var(--cds-link-primary)]">
                            <Shield size={32} />
                        </div>
                        <h1 className="text-2xl font-bold text-[var(--cds-text-primary)]">Secure Your Data</h1>
                        <p className="text-center text-[var(--cds-text-secondary)] mt-2">
                            CTRL now uses industry-standard encryption to protect your torrent client credentials.
                        </p>
                    </div>

                    {hasLegacy && (
                        <InlineNotification
                            kind="warning"
                            title="Migration Required"
                            subtitle="We found existing server configurations. Setting a password will migrate and encrypt this data securely."
                            lowContrast
                            hideCloseButton
                        />
                    )}

                    <form onSubmit={handleSubmit}>
                        <Stack gap={6}>
                            <PasswordInput
                                id="master-password"
                                labelText="Master Password"
                                helperText="Min. 8 characters"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                            />

                            <PasswordInput
                                id="confirm-password"
                                labelText="Confirm Password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Repeat password"
                                required
                            />

                            {error && (
                                <InlineNotification
                                    kind="error"
                                    title="Error"
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
                                >
                                    {hasLegacy ? 'Encrypt & Migrate' : 'Create Vault'}
                                </Button>
                                {loading && <Loading withOverlay={false} small className="absolute right-4 top-1/2 -translate-y-1/2" />}
                            </div>

                            <p className="text-xs text-center text-[var(--cds-text-helper)]">
                                This password is used to generate your encryption key. It is never stored and cannot be recovered if lost.
                            </p>
                        </Stack>
                    </form>
                </Stack>
            </Tile>
        </div>
    );
};
