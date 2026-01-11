import { ClientCapability, AppOptions } from './types';

export const CLIENT_LIST: ClientCapability[] = [
    {
        id: 'biglybt',
        name: 'BiglyBT',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        clientCapabilities: ['paused', 'path', 'httpAuth']
    },
    {
        id: 'deluge',
        name: 'Deluge Web UI',
        addressPlaceholder: 'http://127.0.0.1:8112/',
        defaultPort: '8112',
        clientCapabilities: ['paused', 'label', 'path']
    },
    {
        id: 'flood',
        name: 'Flood',
        addressPlaceholder: 'http://127.0.0.1:3000/',
        defaultPort: '3000',
        clientCapabilities: ['paused', 'label', 'path']
    },
    {
        id: 'rutorrent',
        name: 'ruTorrent',
        addressPlaceholder: 'http://127.0.0.1:80/',
        defaultPort: '80',
        clientCapabilities: ['paused', 'label', 'path', 'rss', 'httpAuth'],
        clientOptions: [
            {
                name: 'authType',
                description: 'Authentication Type',
                values: {
                    'httpAuth': 'HTTP Authentication',
                    'loginForm': 'Login Form',
                }
            },
            {
                name: 'fast_resume',
                description: 'Skip Hash Check'
            }
        ]
    },
    {
        id: 'transmission',
        name: 'Transmission',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        clientCapabilities: ['paused', 'label', 'path', 'httpAuth']
    },
    {
        id: 'utorrent',
        name: 'µTorrent',
        addressPlaceholder: 'http://127.0.0.1:8112/gui/',
        defaultPort: '8112'
    },
    {
        id: 'vuze_remoteui',
        name: 'Vuze Web Remote',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        clientCapabilities: ['paused', 'path', 'httpAuth']
    },
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        addressPlaceholder: 'http://127.0.0.1:8080/',
        defaultPort: '8080',
        clientCapabilities: ['paused', 'label', 'path', 'rss'],
        clientOptions: [
            {
                name: 'sequentialDownload',
                description: 'Sequential Download'
            },
            {
                name: 'firstLastPiecePrio',
                description: 'First and Last Piece Priority'
            },
            {
                name: 'skip_checking',
                description: 'Skip Hash Check'
            },
            {
                name: 'contentLayout',
                description: 'Content Layout',
                values: {
                    '': 'Original',
                    'Subfolder': 'Create Subfolder',
                    'NoSubfolder': 'Don\'t Create Subfolder',
                },
            },
        ]
    },
    {
        id: 'aria2',
        name: 'Aria2 / Motrix',
        addressPlaceholder: 'http://127.0.0.1:6800/jsonrpc',
        defaultPort: '6800',
        clientCapabilities: ['paused', 'httpAuth']
    }
];

export const DEFAULT_OPTIONS: AppOptions = {
    globals: {
        contextMenu: 1,
        addPaused: false,
        addAdvanced: false,
        enableNotifications: true,
        notificationLevel: 'standard',
        debugMode: false,
        matchRegExp: [],
        labels: [],
        currentServer: 0,
        showDiagnostics: false,
        badgeInfo: 'count',
        catchTorrents: true,
        notificationStyle: 'toast',
        contextMenuCustomOptions: {
            addToClient: true,
            pauseResume: true,
            openWebUI: true,
        },
    },
    servers: [],
    appearance: {
        theme: 'dark',
        performance: 'standard',
    },
    layout: {
        sidebar: [
            { id: 'torrents', visible: true, order: 0 },
            { id: 'utilities', visible: true, order: 1 }
        ]
    }
};
