import { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from 'wxt/utils/storage';
import { VaultService, SESSION_KEY_KEY, VAULT_SALT_KEY, VAULT_DATA_KEY } from '@/shared/api/security/VaultService';
import { ServerConfig } from '@/shared/lib/types';

export type VaultStatus = 'loading' | 'uninitialized' | 'locked' | 'unlocked' | 'corrupted';

/**
 * Vault state for one UI context.
 *
 * The vault itself lives in extension storage; this hook mirrors it. It
 * watches the session key, salt and ciphertext so that locking in any window
 * (or the browser discarding the session) immediately redacts every other
 * window, and so that a save in one window refreshes the others.
 */
export const useVault = () => {
    const [status, setStatus] = useState<VaultStatus>('loading');
    const [servers, setServers] = useState<ServerConfig[]>([]);
    const [error, setError] = useState<string | null>(null);
    const checkSeq = useRef(0);

    const checkStatus = useCallback(async () => {
        const seq = ++checkSeq.current;
        try {
            const state = await VaultService.getState();
            if (seq !== checkSeq.current) return; // a newer check superseded this one
            switch (state) {
                case 'uninitialized':
                    setServers([]);
                    setStatus('uninitialized');
                    setError(null);
                    return;
                case 'locked':
                    setServers([]);
                    setStatus('locked');
                    setError(null);
                    return;
                case 'corrupted':
                    setServers([]);
                    setStatus('corrupted');
                    setError('The stored vault data is incomplete or damaged.');
                    return;
                case 'unlocked': {
                    try {
                        const data = await VaultService.getServers();
                        if (seq !== checkSeq.current) return;
                        setServers(data);
                        setStatus('unlocked');
                        setError(null);
                    } catch (e) {
                        if (seq !== checkSeq.current) return;
                        // The session key is present but cannot decrypt the data.
                        console.error('[useVault] Unlocked but decryption failed:', e);
                        setServers([]);
                        setStatus('locked');
                    }
                    return;
                }
            }
        } catch (e) {
            if (seq !== checkSeq.current) return;
            console.error('[useVault] Vault status check failed', e);
            setServers([]);
            setStatus('locked');
        }
    }, []);

    useEffect(() => {
        void checkStatus();
        const unwatchers = [
            storage.watch(SESSION_KEY_KEY, () => { void checkStatus(); }),
            storage.watch(VAULT_SALT_KEY, () => { void checkStatus(); }),
            storage.watch(VAULT_DATA_KEY, () => { void checkStatus(); }),
        ];
        return () => {
            for (const unwatch of unwatchers) {
                try { unwatch(); } catch { /* already removed */ }
            }
        };
    }, [checkStatus]);

    const setup = async (password: string) => {
        await VaultService.initialize(password);
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

    /**
     * Destroys the vault: every saved server and the master password. The
     * caller must have obtained explicit confirmation from the user.
     */
    const reset = async () => {
        await VaultService.reset();
        await checkStatus();
    };

    return {
        status,
        servers,
        error,
        setup,
        unlock,
        lock,
        reset,
        saveServers,
        refresh: checkStatus
    };
};
