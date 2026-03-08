/**
 * Deluge Execute Plugin Interface
 * 
 * Manages post-download script hooks via configuration injection.
 * Scripts reference files already on the daemon filesystem.
 */
import { DelugeAdapter } from '../DelugeAdapter';

export type ExecuteEvent = 'complete' | 'added';

export interface ExecuteCommand {
    id: string;
    event: ExecuteEvent;
    command: string;  // Script path on daemon filesystem
}

export interface ExecuteConfig {
    commands: [string, string, string][]; // [id, event, command]
}

/**
 * Wrapper class that extends DelugeAdapter to access protected methods.
 */
class DelugeExecutePluginAdapter extends DelugeAdapter {
    async pluginCall<T>(method: string, params: unknown[] = []): Promise<T> {
        return this.ensureAuth(() => this.call<T>(method, params));
    }
}

export class DelugeExecutePlugin {
    private pluginAdapter: DelugeExecutePluginAdapter;

    constructor(adapter: DelugeAdapter) {
        this.pluginAdapter = adapter as unknown as DelugeExecutePluginAdapter;
    }

    /**
     * Gets the current Execute configuration.
     */
    async getConfig(): Promise<ExecuteConfig> {
        return await this.pluginAdapter.pluginCall<ExecuteConfig>('execute.get_config');
    }

    /**
     * Sets the Execute configuration.
     */
    async setConfig(config: ExecuteConfig): Promise<void> {
        await this.pluginAdapter.pluginCall('execute.set_config', [config]);
    }

    /**
     * Gets all configured commands as a friendly array.
     */
    async getCommands(): Promise<ExecuteCommand[]> {
        const config = await this.getConfig();
        const commands = config.commands || [];

        return commands.map(([id, event, command]) => ({
            id,
            event: event as ExecuteEvent,
            command
        }));
    }

    /**
     * Adds a new command.
     * @param event - 'complete' or 'added'
     * @param scriptPath - Path to script on daemon filesystem
     * @returns The generated UUID for the new command
     */
    async addCommand(event: ExecuteEvent, scriptPath: string): Promise<string> {
        const config = await this.getConfig();
        const commands = config.commands || [];

        // Generate UUID
        const newId = this.generateUuid();

        commands.push([newId, event, scriptPath]);
        config.commands = commands;

        await this.setConfig(config);
        return newId;
    }

    /**
     * Removes a command by ID.
     */
    async removeCommand(commandId: string): Promise<void> {
        const config = await this.getConfig();
        const commands = config.commands || [];

        const index = commands.findIndex(([id]) => id === commandId);
        if (index === -1) {
            throw new Error(`Command with ID '${commandId}' not found`);
        }

        commands.splice(index, 1);
        config.commands = commands;

        await this.setConfig(config);
    }

    /**
     * Generates a simple UUID.
     */
    private generateUuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
