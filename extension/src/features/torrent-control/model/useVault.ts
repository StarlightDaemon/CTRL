import { useState, useEffect, useCallback } from 'react';
import { VaultService } from '@/shared/api/security/VaultService';
import { ServerConfig } from '@/shared/lib/types';

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked';

export const useVault = () => {
    const [status, setStatus] = useState<VaultStatus>('loading');
    const [servers, setServers] = useState<ServerConfig[]>([]);

    const checkStatus = useCallback(async () => {
        try {
            const initialized = await VaultService.isInitialized();
            if (!initialized) {
                setStatus('uninitialized');
                return;
            }

            const locked = await VaultService.isLocked();
            if (locked) {
                setStatus('locked');
            } else {
                // If unlocked, fetch the data
                try {
                    const data = await VaultService.getServers();
                    setServers(data);
                    setStatus('unlocked');
                } catch (e) {
                    // Fallback to locked if fetch fails (e.g. key expired/missing)
                    console.error('Failed to fetch servers despite unlocked check:', e);
                    setStatus('locked');
                }
            }
        } catch (e) {
            console.error('Vault status check failed', e);
            setStatus('locked');
        }
    }, []);

    useEffect(() => {
        checkStatus();

        // Optional: Listen for storage changes to lock status?
        // WXT storage.watch might help, but session storage isn't watchable in the same way across contexts easily.
        // For now, relies on local component state + mount check.
        // If we want auto-lock on timeout, we'd need a polling interval or message listener.
    }, [checkStatus]);

    const setup = async (password: string) => {
        await VaultService.initialize(password); // Logic inside handles migration if needed
        await checkStatus();
    };

    const unlock = async (password: string) => {
        const success = await VaultService.unlock(password);
        if (success) {
            await checkStatus();
            return true;
        }
        return false;
    };

    const lock = async () => {
        await VaultService.lock();
        setStatus('locked');
        setServers([]);
    };

    const saveServers = async (newServers: ServerConfig[]) => {
        await VaultService.saveServers(newServers);
        setServers(newServers);
    };

    return {
        status,
        servers,
        setup,
        unlock,
        lock,
        saveServers,
        refresh: checkStatus
    };
};
