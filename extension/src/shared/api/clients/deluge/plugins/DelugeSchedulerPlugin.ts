/**
 * Deluge Scheduler Plugin Interface
 * 
 * Manages time-based bandwidth limits via configuration injection.
 * The schedule is a 168-integer array (7 days × 24 hours).
 * Values: 0=Normal, 1=Low limits, 2=Paused
 */
import { DelugeAdapter } from '../DelugeAdapter';

export interface SchedulerConfig {
    enabled: boolean;
    low_down: number;    // KiB/s during "scheduled" slots
    low_up: number;      // KiB/s during "scheduled" slots
    low_active: number;  // Max active torrents during "scheduled"
    schedule: number[];  // 168 integers (7 days × 24 hours)
}

export type ScheduleSlot = 0 | 1 | 2; // 0=Normal, 1=Low, 2=Paused

/**
 * Wrapper class that extends DelugeAdapter to access protected methods.
 */
class DelugeSchedulerPluginAdapter extends DelugeAdapter {
    async pluginCall<T>(method: string, params: unknown[] = []): Promise<T> {
        return this.ensureAuth(() => this.call<T>(method, params));
    }
}

export class DelugeSchedulerPlugin {
    private pluginAdapter: DelugeSchedulerPluginAdapter;

    constructor(adapter: DelugeAdapter) {
        this.pluginAdapter = adapter as unknown as DelugeSchedulerPluginAdapter;
    }

    /**
     * Gets the current Scheduler configuration.
     */
    async getConfig(): Promise<SchedulerConfig> {
        return await this.pluginAdapter.pluginCall<SchedulerConfig>('scheduler.get_config');
    }

    /**
     * Sets the Scheduler configuration.
     */
    async setConfig(config: Partial<SchedulerConfig>): Promise<void> {
        await this.pluginAdapter.pluginCall('scheduler.set_config', [config]);
    }

    /**
     * Helper to set the schedule from a 7×24 matrix.
     * Matrix is [day][hour] where day 0 = Monday.
     */
    async setScheduleMatrix(matrix: ScheduleSlot[][]): Promise<void> {
        if (matrix.length !== 7) {
            throw new Error('Schedule matrix must have 7 days');
        }

        for (const day of matrix) {
            if (day.length !== 24) {
                throw new Error('Each day in schedule matrix must have 24 hours');
            }
        }

        // Flatten 7×24 matrix to 168-integer array
        const flatSchedule = matrix.flat();
        await this.setConfig({ schedule: flatSchedule });
    }

    /**
     * Gets the current schedule as a 7×24 matrix.
     */
    async getScheduleMatrix(): Promise<ScheduleSlot[][]> {
        const config = await this.getConfig();
        const schedule = config.schedule || new Array(168).fill(0);

        const matrix: ScheduleSlot[][] = [];
        for (let day = 0; day < 7; day++) {
            matrix.push(schedule.slice(day * 24, (day + 1) * 24) as ScheduleSlot[]);
        }

        return matrix;
    }

    /**
     * Enables/disables the scheduler.
     */
    async setEnabled(enabled: boolean): Promise<void> {
        await this.setConfig({ enabled });
    }

    /**
     * Sets the bandwidth limits for "low" schedule slots.
     */
    async setLowLimits(download: number, upload: number, active?: number): Promise<void> {
        const config: Partial<SchedulerConfig> = {
            low_down: download,
            low_up: upload
        };

        if (active !== undefined) {
            config.low_active = active;
        }

        await this.setConfig(config);
    }
}
