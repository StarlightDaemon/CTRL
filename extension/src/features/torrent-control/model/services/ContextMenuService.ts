import { singleton } from 'tsyringe';
import { storage } from 'wxt/storage';
import { ITorrentClient } from '@/entities/client/model/ITorrentClient';
import { AppSettings, ServerConfig } from '@/shared/lib/types';
import { VaultService, SESSION_KEY_KEY, VAULT_DATA_KEY } from '@/shared/api/security/VaultService';

@singleton()
export class ContextMenuService {
    private clientProvider: (serverIndex?: number) => Promise<ITorrentClient>;

    constructor() {
        this.clientProvider = async () => { throw new Error('Client provider not initialized'); };
    }

    initialize(clientProvider: (serverIndex?: number) => Promise<ITorrentClient>) {
        this.clientProvider = clientProvider;
        this.setupMenus();
        this.setupListeners();

        // Watch for settings changes to rebuild menus
        storage.watch<AppSettings>('local:options', (settings) => {
            this.setupMenus();
        });

        // Watch for Vault Data changes (e.g. servers updated)
        storage.watch(VAULT_DATA_KEY, () => {
            this.setupMenus();
        });

        // Watch for Session Key (Unlock/Lock)
        storage.watch(SESSION_KEY_KEY, () => {
            this.setupMenus();
        });
    }

    private async setupMenus() {
        const settings = await storage.getItem<AppSettings>('local:options');
        if (!settings) return;

        // Check Vault Status
        let servers: ServerConfig[] = [];
        let isLocked = false;
        try {
            if (await VaultService.isLocked()) {
                isLocked = true;
            } else {
                servers = await VaultService.getServers();
            }
        } catch (e: unknown) {
            console.warn('ContextMenu: Vault check failed', e);
            isLocked = true;
        }

        chrome.contextMenus.removeAll(() => {
            if (isLocked) {
                chrome.contextMenus.create({
                    id: 'unlock-vault',
                    title: 'Unlock CTRL to add torrents',
                    contexts: ['link', 'selection', 'page'],
                });
                return;
            }

            // 1. Add to Torrent Control (Default)
            chrome.contextMenus.create({
                id: 'add-torrent',
                title: 'Add to Torrent Control',
                contexts: ['link', 'selection'],
            });

            // 1.5 Scan Page
            chrome.contextMenus.create({
                id: 'scan-page',
                title: 'Scan Page for Magnets (CTRL)',
                contexts: ['page', 'frame'],
            });

            // 2. Add Paused (if supported)
            if (settings.globals.contextMenu === 1) { // Full Menu
                chrome.contextMenus.create({
                    id: 'add-torrent-paused',
                    title: 'Add Paused',
                    contexts: ['link'],
                });
            }

            // 3. Server Selection (if multiple servers)
            if (servers.length > 1) {
                // 3a. Top Level Servers
                servers.forEach((server: ServerConfig, index: number) => {
                    if (server.showInContextMenu) {
                        chrome.contextMenus.create({
                            id: `add-torrent-server-${index}`,
                            title: `Add to ${server.name}`,
                            contexts: ['link'],
                        });
                    }
                });

                // 3b. Submenu Servers (those NOT shown in top level)
                const submenuServers = servers
                    .map((server: ServerConfig, index: number) => ({ ...server, originalIndex: index }))
                    .filter((server: ServerConfig & { showInContextMenu?: boolean }) => !server.showInContextMenu);

                if (submenuServers.length > 0) {
                    chrome.contextMenus.create({
                        id: 'server-selection',
                        title: 'Add to Server...',
                        contexts: ['link'],
                    });

                    submenuServers.forEach((server: ServerConfig & { originalIndex: number }) => {
                        chrome.contextMenus.create({
                            id: `add-torrent-server-${server.originalIndex}`,
                            parentId: 'server-selection',
                            title: server.name,
                            contexts: ['link'],
                        });
                    });
                }
            }

            // 4. Add with Label (if labels exist)
            if (settings.globals.labels && settings.globals.labels.length > 0) {
                chrome.contextMenus.create({
                    id: 'label-selection',
                    title: 'Add with Label...',
                    contexts: ['link'],
                });

                settings.globals.labels.forEach((label: string, index: number) => {
                    chrome.contextMenus.create({
                        id: `add-torrent-label-${index}`,
                        parentId: 'label-selection',
                        title: label,
                        contexts: ['link'],
                    });
                });
            }

            // 5. Add to Path (if directories exist for current server)
            const currentServer = servers[settings.globals.currentServer || 0];
            if (currentServer && currentServer.directories && currentServer.directories.length > 0) {
                chrome.contextMenus.create({
                    id: 'path-selection',
                    title: 'Add to Path...',
                    contexts: ['link'],
                });

                currentServer.directories.forEach((path: string, index: number) => {
                    chrome.contextMenus.create({
                        id: `add-torrent-path-${index}`,
                        parentId: 'path-selection',
                        title: path,
                        contexts: ['link'],
                    });
                });
            }
        });
    }

    private setupListeners() {
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
            if (info.menuItemId === 'unlock-vault') {
                chrome.runtime.openOptionsPage();
                return;
            }

            const url = info.linkUrl || info.selectionText;

            try {
                if (info.menuItemId === 'scan-page') {
                    if (tab && tab.id) {
                        chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            func: () => {
                                const magnets = Array.from(document.querySelectorAll('a[href^="magnet:"]'))
                                    .map(a => a.getAttribute('href'))
                                    .filter(href => href !== null) as string[];
                                return magnets;
                            }
                        }, async (results) => {
                            const magnets = results?.[0]?.result;
                            if (magnets && magnets.length > 0) {
                                this.notify(true, `Found ${magnets.length} magnets. Adding...`);
                                try {
                                    const client = await this.clientProvider();
                                    for (const magnet of magnets) {
                                        await client.addTorrentUrl(magnet);
                                    }
                                    this.notify(true, `Added ${magnets.length} torrents.`);
                                } catch (e: unknown) {
                                    const errMsg = e instanceof Error ? e.message : 'Failed to add torrents';
                                    this.notify(false, errMsg);
                                }
                            } else {
                                this.notify(false, 'No magnet links found on this page.');
                            }
                        });
                    }
                    return;
                }

                if (!url) return;

                if (info.menuItemId === 'add-torrent') {
                    const client = await this.clientProvider();
                    await client.addTorrentUrl(url);
                    this.notify(true, 'Torrent added successfully');
                }
                else if (info.menuItemId === 'add-torrent-paused') {
                    const client = await this.clientProvider();
                    await client.addTorrentUrl(url, { paused: true });
                    this.notify(true, 'Torrent added (paused)');
                }
                else if (typeof info.menuItemId === 'string') {
                    // We need servers to resolve names, fetch from Vault again?
                    // Or trust index.
                    // If vault locked, clientProvider will fail anyway.
                    if (info.menuItemId.startsWith('add-torrent-server-')) {
                        const serverIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        // Just let clientProvider handle it
                        const client = await this.clientProvider(serverIndex);
                        await client.addTorrentUrl(url);
                        this.notify(true, `Torrent added to server`);
                    }
                    else if (info.menuItemId.startsWith('add-torrent-label-')) {
                        const labelIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        const settings = await storage.getItem<AppSettings>('local:options');
                        const label = settings?.globals.labels[labelIndex];

                        if (label) {
                            const client = await this.clientProvider();
                            await client.addTorrentUrl(url, { label });
                            this.notify(true, `Torrent added with label: ${label}`);
                        }
                    }
                    else if (info.menuItemId.startsWith('add-torrent-path-')) {
                        const pathIndex = parseInt(info.menuItemId.split('-').pop() || '0');
                        // Need keys to look up path
                        const servers = await VaultService.getServers();
                        const settings = await storage.getItem<AppSettings>('local:options');

                        if (settings && servers.length) {
                            const currentServer = servers[settings.globals.currentServer || 0];
                            const path = currentServer.directories[pathIndex];
                            if (path) {
                                const client = await this.clientProvider();
                                await client.addTorrentUrl(url, { path });
                                this.notify(true, `Torrent added to path: ${path}`);
                            }
                        }
                    }
                }
            } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : 'Unknown error';
                console.error('Context Menu Error:', e);
                this.notify(false, `Failed to add torrent: ${errMsg}`);
            }
        });
    }

    private notify(success: boolean, message: string) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon/default-64.png',
            title: success ? 'Torrent Control' : 'Error',
            message: message,
        });
    }
}
