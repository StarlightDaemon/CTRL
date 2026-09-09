import { ClientCapability, AppOptions } from './types';

/**
 * Every adapter the extension can instantiate. `v1Status` decides whether a
 * client is offered for new configurations; existing configurations of any
 * type keep loading (see docs/release/v1/V1_SCOPE.md §3).
 */
export const CLIENT_LIST: ClientCapability[] = [
    {
        id: 'transmission',
        name: 'Transmission',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        v1Status: 'candidate',
        clientCapabilities: ['paused', 'label', 'path', 'httpAuth']
    },
    {
        id: 'qbittorrent',
        name: 'qBittorrent',
        addressPlaceholder: 'http://127.0.0.1:8080/',
        defaultPort: '8080',
        v1Status: 'candidate',
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
        v1Status: 'candidate',
        clientCapabilities: ['paused', 'httpAuth']
    },
    {
        id: 'biglybt',
        name: 'BiglyBT',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        v1Status: 'experimental',
        clientCapabilities: ['paused', 'path', 'httpAuth']
    },
    {
        id: 'deluge',
        name: 'Deluge Web UI',
        addressPlaceholder: 'http://127.0.0.1:8112/',
        defaultPort: '8112',
        v1Status: 'experimental',
        clientCapabilities: ['paused', 'label', 'path']
    },
    {
        id: 'flood',
        name: 'Flood',
        addressPlaceholder: 'http://127.0.0.1:3000/',
        defaultPort: '3000',
        v1Status: 'experimental',
        clientCapabilities: ['paused', 'label', 'path']
    },
    {
        id: 'rutorrent',
        name: 'ruTorrent',
        addressPlaceholder: 'http://127.0.0.1:80/',
        defaultPort: '80',
        v1Status: 'experimental',
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
        id: 'utorrent',
        name: 'µTorrent',
        addressPlaceholder: 'http://127.0.0.1:8112/gui/',
        defaultPort: '8112',
        v1Status: 'experimental'
    },
    {
        id: 'vuze_remoteui',
        name: 'Vuze Web Remote',
        addressPlaceholder: 'http://127.0.0.1:9091/',
        defaultPort: '9091',
        v1Status: 'experimental',
        clientCapabilities: ['paused', 'path', 'httpAuth']
    },
];

/** Clients offered when creating a new server configuration. */
export const PUBLIC_CLIENT_LIST: ClientCapability[] = CLIENT_LIST.filter((c) => c.v1Status === 'candidate');

export const DEFAULT_CLIENT_ID = PUBLIC_CLIENT_LIST[0].id;

export function getClientCapability(id: string | undefined): ClientCapability | undefined {
    return CLIENT_LIST.find((c) => c.id === id);
}

export function isPublicClient(id: string | undefined): boolean {
    return getClientCapability(id)?.v1Status === 'candidate';
}

export const DEFAULT_OPTIONS: AppOptions = {
    globals: {
        contextMenu: 1,
        addPaused: false,
        addAdvanced: false,
        enableNotifications: true,
        labels: [],
        currentServer: 0,
        badgeInfo: 'count',
    },
    servers: [],
};
