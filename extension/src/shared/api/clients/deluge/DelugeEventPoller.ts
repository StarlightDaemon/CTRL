/**
 * Deluge Event Poller
 * 
 * Implements event polling since Deluge does NOT support WebSockets.
 * Uses web.register_event_listener and web.get_events for pseudo-streaming.
 */
import { DelugeAdapter } from './DelugeAdapter';

export type DelugeEventType =
    | 'TorrentAddedEvent'
    | 'TorrentRemovedEvent'
    | 'TorrentStateChangedEvent'
    | 'TorrentFinishedEvent'
    | 'TorrentFileRenamedEvent'
    | 'TorrentFolderRenamedEvent'
    | 'ConfigValueChangedEvent'
    | 'SessionStartedEvent'
    | 'SessionPausedEvent'
    | 'SessionResumedEvent';

export interface DelugeEventData {
    type: DelugeEventType;
    payload: unknown[];
    timestamp: number;
}

export type EventCallback = (events: DelugeEventData[]) => void;

/**
 * Wrapper class that extends DelugeAdapter to access protected methods.
 */
class DelugeEventPollerAdapter extends DelugeAdapter {
    async pollerCall<T>(method: string, params: unknown[] = []): Promise<T> {
        return this.ensureAuth(() => this.call<T>(method, params));
    }
}

export class DelugeEventPoller {
    private registeredEvents: Set<DelugeEventType> = new Set();
    private pollInterval: number = 2000; // Default 2 seconds
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private isPolling: boolean = false;
    private callback: EventCallback | null = null;
    private pollerAdapter: DelugeEventPollerAdapter;

    constructor(adapter: DelugeAdapter) {
        this.pollerAdapter = adapter as unknown as DelugeEventPollerAdapter;
    }

    /**
     * Registers interest in a specific event type.
     */
    async registerEvent(eventType: DelugeEventType): Promise<void> {
        if (this.registeredEvents.has(eventType)) {
            return; // Already registered
        }

        await this.pollerAdapter.pollerCall('web.register_event_listener', [eventType]);
        this.registeredEvents.add(eventType);
    }

    /**
     * Deregisters from a specific event type.
     */
    async deregisterEvent(eventType: DelugeEventType): Promise<void> {
        if (!this.registeredEvents.has(eventType)) {
            return; // Not registered
        }

        await this.pollerAdapter.pollerCall('web.deregister_event_listener', [eventType]);
        this.registeredEvents.delete(eventType);
    }

    /**
     * Polls for pending events.
     */
    async pollEvents(): Promise<DelugeEventData[]> {
        const rawEvents = await this.pollerAdapter.pollerCall<unknown[][]>('web.get_events');

        if (!rawEvents || !Array.isArray(rawEvents)) {
            return [];
        }

        const timestamp = Date.now();
        return rawEvents.map(event => {
            // Events come as [eventType, ...payload]
            const [type, ...payload] = event;
            return {
                type: type as DelugeEventType,
                payload,
                timestamp
            };
        });
    }

    /**
     * Registers for common torrent events.
     */
    async registerAllTorrentEvents(): Promise<void> {
        const events: DelugeEventType[] = [
            'TorrentAddedEvent',
            'TorrentRemovedEvent',
            'TorrentStateChangedEvent',
            'TorrentFinishedEvent',
            'TorrentFileRenamedEvent'
        ];

        for (const event of events) {
            await this.registerEvent(event);
        }
    }

    /**
     * Starts polling for events at the configured interval.
     */
    startPolling(callback: EventCallback, intervalMs?: number): void {
        if (this.isPolling) {
            this.stopPolling();
        }

        if (intervalMs) {
            this.pollInterval = intervalMs;
        }

        this.callback = callback;
        this.isPolling = true;

        this.pollTimer = setInterval(async () => {
            try {
                const events = await this.pollEvents();
                if (events.length > 0 && this.callback) {
                    this.callback(events);
                }
            } catch (error) {
                console.error('[DelugeEventPoller] Poll error:', error);
            }
        }, this.pollInterval);
    }

    /**
     * Stops polling for events.
     */
    stopPolling(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.isPolling = false;
        this.callback = null;
    }

    /**
     * Gets the current polling status.
     */
    isPollActive(): boolean {
        return this.isPolling;
    }

    /**
     * Gets the set of registered events.
     */
    getRegisteredEvents(): DelugeEventType[] {
        return Array.from(this.registeredEvents);
    }

    /**
     * Deregisters all events and stops polling.
     */
    async cleanup(): Promise<void> {
        this.stopPolling();

        for (const event of this.registeredEvents) {
            try {
                await this.deregisterEvent(event);
            } catch {
                // Ignore errors during cleanup
            }
        }

        this.registeredEvents.clear();
    }
}
