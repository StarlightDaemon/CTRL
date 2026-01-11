/**
 * TorrentDiffer - RFC 6902 JSON-Patch generator for torrent state updates
 * 
 * Computes minimal patches between previous and current torrent arrays,
 * significantly reducing data transfer between background and UI.
 */

import { Torrent } from '@/entities/torrent/model/Torrent';

export interface JsonPatchOperation {
    op: 'add' | 'remove' | 'replace';
    path: string;
    value?: any;
}

export interface DiffResult {
    patches: JsonPatchOperation[];
    hasChanges: boolean;
}

// Fields that frequently change and should be tracked
const DYNAMIC_FIELDS: (keyof Torrent)[] = [
    'progress',
    'status',
    'downloadSpeed',
    'uploadSpeed',
    'eta',
];

/**
 * Computes RFC 6902 JSON-Patch operations between two torrent arrays
 */
export function computeTorrentDiff(
    previous: Torrent[],
    current: Torrent[],
    startIndex: number = 0
): DiffResult {
    const patches: JsonPatchOperation[] = [];

    // Build lookup map for previous torrents by id
    const previousMap = new Map<string | number, { torrent: Torrent; index: number }>();
    previous.forEach((t, i) => {
        previousMap.set(t.id, { torrent: t, index: i });
    });

    // Build lookup for current torrents
    const currentMap = new Map<string | number, { torrent: Torrent; index: number }>();
    current.forEach((t, i) => {
        currentMap.set(t.id, { torrent: t, index: i });
    });

    // Detect additions and modifications
    current.forEach((currentTorrent, currentIdx) => {
        const prev = previousMap.get(currentTorrent.id);
        const globalIndex = startIndex + currentIdx;

        if (!prev) {
            // New torrent - add operation
            patches.push({
                op: 'add',
                path: `/${globalIndex}`,
                value: currentTorrent
            });
        } else {
            // Existing torrent - check for changes in dynamic fields
            for (const field of DYNAMIC_FIELDS) {
                if (prev.torrent[field] !== currentTorrent[field]) {
                    patches.push({
                        op: 'replace',
                        path: `/${globalIndex}/${String(field)}`,
                        value: currentTorrent[field]
                    });
                }
            }
        }
    });

    // Detect removals (torrents in previous but not in current)
    previous.forEach((prevTorrent, prevIdx) => {
        if (!currentMap.has(prevTorrent.id)) {
            const globalIndex = startIndex + prevIdx;
            patches.push({
                op: 'remove',
                path: `/${globalIndex}`
            });
        }
    });

    return {
        patches,
        hasChanges: patches.length > 0
    };
}

/**
 * Applies RFC 6902 patches to a torrent record
 */
export function applyTorrentPatches(
    torrents: Record<number, Torrent>,
    patches: JsonPatchOperation[],
    startIndex: number
): Record<number, Torrent> {
    const result = { ...torrents };

    for (const patch of patches) {
        // Parse path: /index or /index/field
        const pathParts = patch.path.split('/').filter(Boolean);
        const index = parseInt(pathParts[0], 10);
        const field = pathParts[1] as keyof Torrent | undefined;

        switch (patch.op) {
            case 'add':
                result[index] = patch.value;
                break;

            case 'remove':
                delete result[index];
                break;

            case 'replace':
                if (field && result[index]) {
                    result[index] = {
                        ...result[index],
                        [field]: patch.value
                    };
                }
                break;
        }
    }

    return result;
}

/**
 * Estimates bandwidth savings from using patches vs full update
 */
export function estimateSavings(
    fullPayload: Torrent[],
    patches: JsonPatchOperation[]
): { fullSize: number; patchSize: number; savedPercent: number } {
    const fullSize = JSON.stringify(fullPayload).length;
    const patchSize = JSON.stringify(patches).length;
    const savedPercent = fullSize > 0 ? Math.round((1 - patchSize / fullSize) * 100) : 0;

    return { fullSize, patchSize, savedPercent };
}
