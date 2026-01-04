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

export interface OneThreeThreeSevenXOptions {
    enabled: boolean; // Added
    showDiagnostics: boolean;
    listView: {
        addMagnetLinks: boolean;
        batchActions: boolean;
        showImages: boolean;
        cleanTitles: boolean;
        filterPanel: boolean;
    };
    detailPage: {
        showImdb: boolean;
        hideAds: boolean;
        fullWidth: boolean;
    };
}

export interface NyaaOptions {
    enabled: boolean;
    autoDarkMode: boolean;
    infiniteScroll: boolean;
    magnetLinks: boolean;
    batchActions: boolean;
    hoverPreviews: boolean;
    highlightDeadTorrents: boolean;
    filterPanel: boolean;
}

export interface FitGirlOptions {
    enabled: boolean; // Added
    autoDarkMode: boolean;
    infiniteScroll: boolean;
    redirectFakeSites: boolean;
    showTrailers: boolean;
    magnetLinks: boolean;
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
    '1337x'?: OneThreeThreeSevenXOptions;
    nyaa?: NyaaOptions;
    fitgirl?: FitGirlOptions;
    audiobook_bay?: import('@/features/audiobook-bay/lib/types').ABBSettings;
    torrent_galaxy?: TorrentGalaxyOptions;
    the_pirate_bay?: { enabled: boolean; magnetEnhancer: boolean };
    rarbg?: { enabled: boolean; qualityFilter?: boolean; magnetProps?: boolean };
}

export interface TorrentGalaxyOptions {
    enabled: boolean;
    qualityFilter: boolean;
    magnetEnhancer: boolean;
    titleNormalizer: boolean;
}

export type AppSettings = AppOptions; // Alias for consistency

// Re-export ABBSettings from canonical location
export type { ABBSettings } from '@/features/audiobook-bay/lib/types';

