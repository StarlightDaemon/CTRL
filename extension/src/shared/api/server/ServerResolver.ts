import { storage } from 'wxt/utils/storage';
import { ServerConfig, AppSettings } from '@/shared/lib/types';
import { VaultService, VaultCorruptedError } from '@/shared/api/security/VaultService';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import { ClientFactory } from '@/entities/client/lib/ClientFactory';

export enum ResolutionState {
    OK = 'OK',
    LOCKED = 'LOCKED',
    UNINITIALIZED = 'UNINITIALIZED',
    NO_SERVERS = 'NO_SERVERS',
    NO_ACTIVE_SERVER = 'NO_ACTIVE_SERVER',
    INVALID_CONFIG = 'INVALID_CONFIG',
    /** Stored vault material is incomplete or malformed; it will not unlock. */
    CORRUPTED = 'CORRUPTED'
}

export interface ResolvedServers {
    state: ResolutionState;
    /** Servers with stable ids (normalised by the vault layer). */
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

        try {
            const vaultState = await VaultService.getState();
            switch (vaultState) {
                case 'uninitialized':
                    return { state: ResolutionState.UNINITIALIZED, servers: [], activeServer: null };
                case 'locked':
                    return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
                case 'corrupted':
                    return { state: ResolutionState.CORRUPTED, servers: [], activeServer: null };
            }

            servers = await VaultService.getServers();
        } catch (e: unknown) {
            if (e instanceof VaultCorruptedError) {
                console.error('[ServerResolver] Vault is corrupted:', e);
                return { state: ResolutionState.CORRUPTED, servers: [], activeServer: null };
            }
            // A session key that cannot decrypt the data behaves as locked: the
            // user must re-enter the password, which either works or reports
            // the real problem.
            console.error('[ServerResolver] Vault access error, treating as locked:', e);
            return { state: ResolutionState.LOCKED, servers: [], activeServer: null };
        }

        if (servers.length === 0) {
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
