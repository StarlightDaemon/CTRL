export interface ClientCapability {
    id: string;
    name: string;
    addressPlaceholder: string;
    defaultPort: string;
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

export interface GlobalOptions {
    contextMenu: number;
    addPaused: boolean;
    addAdvanced: boolean;
    enableNotifications: boolean;
    notificationLevel: 'standard' | 'verbose' | 'error';
    debugMode: boolean;
    matchRegExp: string[];
    labels: string[];
    currentServer: number;
    showDiagnostics: boolean;
    badgeInfo: 'none' | 'count' | 'speed';
    catchTorrents: boolean;
    notificationStyle: 'toast' | 'banner' | 'modal';
    contextMenuCustomOptions?: {
        addToClient: boolean;
        pauseResume: boolean;
        openWebUI: boolean;
    };
}

export interface LayoutOptions {
    sidebar: SidebarItem[];
}

export interface SidebarItem {
    id: string;
    visible: boolean;
    order: number;
}

export interface AppOptions {
    servers: ServerConfig[];
    globals: GlobalOptions;
    appearance: {
        theme: string;
        performance: 'low' | 'standard' | 'fancy';
    };
    layout: LayoutOptions;
}

export type AppSettings = AppOptions; // Alias for consistency
