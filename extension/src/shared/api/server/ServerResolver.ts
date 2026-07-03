import { storage } from 'wxt/utils/storage';
import { ServerConfig, AppSettings } from '@/shared/lib/types';
import { VaultService } from '@/shared/api/security/VaultService';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { ClientFactory } from '@/entities/client/lib/ClientFactory';

export enum ResolutionState {
    OK = 'OK',
    LOCKED = 'LOCKED',
    UNINITIALIZED = 'UNINITIALIZED',
    NO_SERVERS = 'NO_SERVERS',
    NO_ACTIVE_SERVER = 'NO_ACTIVE_SERVER',
    INVALID_CONFIG = 'INVALID_CONFIG'
}

export interface ResolvedServers {
    state: ResolutionState;
    servers: ServerConfig[];
    activeServer: ServerConfig | null;
}

export class ServerResolver {
    /**
     * Resolves the current server state by checking Vault and fallback options.
     * Unifies logic between background startup and context menu.
     */
    static async resolve(): Promise<ResolvedServers> {
        const settings = await storage.getItem<AppSettings>('local:options') || DEFAULT_OPTIONS;
        let servers: ServerConfig[] = [];
        let isInitialized = false;
        let isLocked = false;

        try {
            isInitialized = await VaultService.isInitialized();
            if (!isInitialized) {
                return { state: ResolutionState.UNINITIALIZED, servers: [], activeServer: null };
            }

            isLocked = await VaultService.isLocked();
            if (isLocked) {
                return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
            }

            servers = await VaultService.getServers();
        } catch (e: unknown) {
            // Classify error type for better diagnostics
            const errorMsg = e instanceof Error ? e.message : String(e);

            if (errorMsg.includes('Vault is locked') || errorMsg.includes('session key')) {
                console.warn('[ServerResolver] Vault is locked (no session key)');
                return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
            }

            if (errorMsg.includes('decrypt')) {
                console.error('[ServerResolver] Decryption failed - vault may be corrupted:', e);
                return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
            }

            console.error('[ServerResolver] Unexpected vault access error:', e);
            return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
        }

        if (servers.length === 0) {
            // Double-check: is vault truly empty, or just read failure?
            const vaultData = await storage.getItem('local:vaultData');
            if (!vaultData) {
                if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) console.log('[ServerResolver] Vault is empty (no vaultData key)');
            } else {
                if (typeof __UI_DEBUG_MODE__ !== 'undefined' && __UI_DEBUG_MODE__) console.log('[ServerResolver] Vault has data but decrypted to 0 servers');
            }
            return { state: ResolutionState.NO_SERVERS, servers: [], activeServer: null };
        }

        const currentIndex = settings?.globals?.currentServer ?? 0;
        const activeServer = servers[currentIndex] || servers[0];

        if (!activeServer) {
            return { state: ResolutionState.NO_ACTIVE_SERVER, servers, activeServer: null };
        }

        // Validate server configuration by shape/schema
        if (!ClientFactory.validate(activeServer)) {
            return { state: ResolutionState.INVALID_CONFIG, servers, activeServer };
        }

        return {
            state: ResolutionState.OK,
            servers,
            activeServer
        };
    }
}
