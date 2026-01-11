import { Torrent } from '@/entities/torrent/model/Torrent';
import { StateHydrator } from './StateHydrator';
import { browser } from 'wxt/browser';
import { computeTorrentDiff, JsonPatchOperation } from '@/shared/lib/diff/TorrentDiffer';

interface ViewportState {
    start: number;
    end: number;
    enabled: boolean;
}

export class ViewportManager {
    private fullTorrents: Torrent[] = [];
    private viewport: ViewportState = { start: 0, end: 50, enabled: false };
    private previousSlice: Torrent[] = [];
    private previousStart: number = 0;

    constructor() { }

    /**
     * Updates the full internal state with new data from the Torrent Client.
     * Automatically broadcasts the new viewport slice and updates the badge.
     */
    public updateTorrents(torrents: Torrent[]) {
        this.fullTorrents = torrents;
        this.broadcastViewport();
        // Persist full state for hydration safety (background crash recovery)
        StateHydrator.persist(torrents);
    }

    /**
     * Sets the visible range for the UI.
     * Called when the user scrolls the virtual list.
     */
    public setViewport(start: number, end: number) {
        const viewportChanged = this.viewport.start !== start || this.viewport.end !== end;
        this.viewport = { start, end, enabled: true };

        // If viewport range changed (scroll), send full update for new range
        if (viewportChanged) {
            this.previousSlice = []; // Force full update on scroll
        }
        this.broadcastViewport();
    }

    /**
     * Sends the current visible slice to the UI.
     * Uses diffing for incremental updates when possible.
     */
    private broadcastViewport() {
        if (!this.viewport.enabled) return;

        // Ensure bounds
        const start = Math.max(0, this.viewport.start);
        const end = Math.min(this.fullTorrents.length, this.viewport.end);
        const sliced = this.fullTorrents.slice(start, end);

        // Check if we can use incremental diff
        const canDiff = this.previousSlice.length > 0 &&
            this.previousStart === start &&
            Math.abs(this.previousSlice.length - sliced.length) <= 5;

        if (canDiff) {
            // Compute and send diff
            const { patches, hasChanges } = computeTorrentDiff(
                this.previousSlice,
                sliced,
                start
            );

            if (hasChanges) {
                browser.runtime.sendMessage({
                    type: 'VIEWPORT_DIFF',
                    data: {
                        patches,
                        total: this.fullTorrents.length,
                        start
                    }
                }).catch(() => { });
            }
            // No changes = no message needed
        } else {
            // Send full update (first sync, scroll, or major change)
            browser.runtime.sendMessage({
                type: 'VIEWPORT_UPDATE',
                data: {
                    items: sliced,
                    total: this.fullTorrents.length,
                    start
                }
            }).catch(() => { });
        }

        // Store for next diff
        this.previousSlice = sliced;
        this.previousStart = start;
    }

    public getSnapshot() {
        return this.fullTorrents;
    }
}

