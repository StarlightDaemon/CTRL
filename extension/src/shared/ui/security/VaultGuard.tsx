import React from 'react';
import { useVault } from '@/features/torrent-control/model/useVault';
import { SetupVault } from './SetupVault';
import { UnlockVault } from './UnlockVault';
import { VaultCorrupted } from './VaultCorrupted';
import { ServerConfig } from '@/shared/lib/types';

interface VaultGuardProps {
    children: (props: {
        servers: ServerConfig[];
        saveServers: (servers: ServerConfig[]) => Promise<void>;
        lock: () => Promise<void>;
        reset: () => Promise<void>;
    }) => React.ReactNode;
}

/**
 * Renders exactly one of: loading, setup, unlock, corrupted-vault recovery,
 * or the unlocked content. A corrupted vault never reaches the children.
 */
export const VaultGuard: React.FC<VaultGuardProps> = ({ children }) => {
    const { status, servers, lock, reset, saveServers, refresh } = useVault();

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-screen bg-[var(--cds-background)]" role="status" aria-label="Loading">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--cds-interactive)]"></div>
            </div>
        );
    }

    if (status === 'uninitialized') {
        return <SetupVault onComplete={refresh} />;
    }

    if (status === 'corrupted') {
        return <VaultCorrupted onReset={reset} />;
    }

    if (status === 'locked') {
        return <UnlockVault onUnlock={refresh} onReset={reset} />;
    }

    // Unlocked
    return (
        <>
            {children({ servers, saveServers, lock, reset })}
        </>
    );
};
