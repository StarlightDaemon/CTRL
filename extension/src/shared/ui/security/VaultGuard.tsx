import React from 'react';
import { useVault } from '@/features/torrent-control/model/useVault';
import { SetupVault } from './SetupVault';
import { UnlockVault } from './UnlockVault';
import { ServerConfig } from '@/shared/lib/types';

interface VaultGuardProps {
    children: (props: {
        servers: ServerConfig[];
        saveServers: (servers: ServerConfig[]) => Promise<void>;
        lock: () => Promise<void>;
    }) => React.ReactNode;
}

export const VaultGuard: React.FC<VaultGuardProps> = ({ children }) => {
    const { status, servers, lock, saveServers, refresh } = useVault();

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (status === 'uninitialized') {
        return <SetupVault onComplete={refresh} />;
    }

    if (status === 'locked') {
        return <UnlockVault onUnlock={refresh} />;
    }

    // Unlocked
    return (
        <>
            {children({ servers, saveServers, lock })}
        </>
    );
};
