/**
 * Deluge AutoAdd Plugin Interface
 * 
 * Manages watch folders via configuration injection.
 * AutoAdd does NOT expose high-level RPC methods - we must
 * read/modify/write the entire config dictionary.
 */
import { DelugeAdapter } from '../DelugeAdapter';

export interface WatchDir {
    path: string;
    abspath?: string;
    enabled: boolean;
    download_location?: string;
    label?: string;
    append_extension?: string;  // e.g., ".added"
    copy_torrent?: boolean;
    delete_copy?: boolean;
}

export interface AutoAddConfig {
    watchdirs: Record<string, WatchDir>;
}

/**
 * Wrapper class that extends DelugeAdapter to access protected methods.
 */
class DelugeAutoAddPluginAdapter extends DelugeAdapter {
    async pluginCall<T>(method: string, params: unknown[] = []): Promise<T> {
        return this.ensureAuth(() => this.call<T>(method, params));
    }
}

export class DelugeAutoAddPlugin {
    private pluginAdapter: DelugeAutoAddPluginAdapter;

    constructor(adapter: DelugeAdapter) {
        // Cast to access protected methods via subclass pattern
        this.pluginAdapter = adapter as unknown as DelugeAutoAddPluginAdapter;
    }

    /**
     * Gets the current AutoAdd configuration.
     */
    async getConfig(): Promise<AutoAddConfig> {
        return await this.pluginAdapter.pluginCall<AutoAddConfig>('autoadd.get_config');
    }

    /**
     * Sets the AutoAdd configuration.
     */
    async setConfig(config: AutoAddConfig): Promise<void> {
        await this.pluginAdapter.pluginCall('autoadd.set_config', [config]);
    }

    /**
     * Gets all configured watch directories.
     */
    async getWatchDirs(): Promise<Record<string, WatchDir>> {
        const config = await this.getConfig();
        return config.watchdirs || {};
    }

    /**
     * Adds a new watch directory.
     * @returns The generated ID for the new watch dir
     */
    async addWatchDir(watchDir: WatchDir): Promise<string> {
        const config = await this.getConfig();
        const watchDirs = config.watchdirs || {};

        // Generate new ID (find max existing ID + 1)
        const ids = Object.keys(watchDirs).map(k => parseInt(k, 10)).filter(n => !isNaN(n));
        const newId = (ids.length > 0 ? Math.max(...ids) + 1 : 1).toString();

        // Create entry
        watchDirs[newId] = {
            path: watchDir.path,
            abspath: watchDir.abspath || watchDir.path,
            enabled: watchDir.enabled,
            download_location: watchDir.download_location || '',
            label: watchDir.label || '',
            append_extension: watchDir.append_extension || '.added',
            copy_torrent: watchDir.copy_torrent ?? false,
            delete_copy: watchDir.delete_copy ?? false
        };

        config.watchdirs = watchDirs;
        await this.setConfig(config);

        return newId;
    }

    /**
     * Updates an existing watch directory.
     */
    async updateWatchDir(id: string, updates: Partial<WatchDir>): Promise<void> {
        const config = await this.getConfig();

        if (!config.watchdirs[id]) {
            throw new Error(`Watch directory with ID '${id}' not found`);
        }

        config.watchdirs[id] = { ...config.watchdirs[id], ...updates };
        await this.setConfig(config);
    }

    /**
     * Removes a watch directory.
     */
    async removeWatchDir(id: string): Promise<void> {
        const config = await this.getConfig();

        if (!config.watchdirs[id]) {
            throw new Error(`Watch directory with ID '${id}' not found`);
        }

        delete config.watchdirs[id];
        await this.setConfig(config);
    }
}
