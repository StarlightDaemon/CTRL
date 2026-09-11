/** Release classification of a client adapter for the v1 program. */
export type ClientV1Status =
    /** Offered in the server type selector. Not proof of verification. */
    | 'candidate'
    /** Adapter code is retained and existing configurations keep loading, but the client is not offered for new configurations. */
    | 'experimental';

export interface ClientCapability {
    id: string;
    name: string;
    addressPlaceholder: string;
    defaultPort: string;
    v1Status: ClientV1Status;
    clientCapabilities?: string[];
    clientOptions?: ClientOptionDefinition[];
}

export interface ClientOptionDefinition {
    name: string;
    description: string;
    values?: Record<string, string>;
}

// Import for local use and re-export
import { ServerConfig } from '@/entities/server/model/types';
export type { ServerConfig };

/** 0 = hidden, 1 = full menu, 2 = simple (add only). */
export type ContextMenuMode = 0 | 1 | 2;

export interface GlobalOptions {
    contextMenu: ContextMenuMode;
    addPaused: boolean;
    addAdvanced: boolean;
    enableNotifications: boolean;
    labels: string[];
    currentServer: number;
    badgeInfo: 'none' | 'count' | 'speed';
}

export interface AppOptions {
    servers: ServerConfig[];
    globals: GlobalOptions;
}

export type AppSettings = AppOptions; // Alias for consistency
