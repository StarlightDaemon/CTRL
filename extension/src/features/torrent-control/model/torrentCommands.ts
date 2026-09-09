import { useTorrentStore } from '../../../stores/useTorrentStore';
import type { CommandResult, TorrentCommandRequest } from '@/shared/api/messaging/protocol';

type Action = 'pause' | 'resume' | 'remove';

const MESSAGE_TYPES: Record<Action, TorrentCommandRequest['type']> = {
    pause: 'PAUSE_TORRENT',
    resume: 'RESUME_TORRENT',
    remove: 'REMOVE_TORRENT',
};

/**
 * Sends a torrent command for the server the row belongs to and tracks its
 * pending/failed state in the store. There is no optimistic status change:
 * the row shows "pausing…" until the background confirms and the next
 * snapshot reflects the server's real state.
 */
export async function runTorrentCommand(serverId: string, torrentId: string, action: Action): Promise<CommandResult> {
    const { setPending, setFailure } = useTorrentStore.getState();
    setPending(torrentId, action);
    setFailure(torrentId, null);
    try {
        const request: TorrentCommandRequest = {
            type: MESSAGE_TYPES[action],
            serverId,
            torrentId,
            deleteData: false,
        };
        const result = (await chrome.runtime.sendMessage(request)) as CommandResult | undefined;
        if (!result || typeof result !== 'object') {
            const failure = { ok: false, error: 'No response from the extension background.' };
            setFailure(torrentId, failure.error);
            return failure;
        }
        if (!result.ok) {
            setFailure(torrentId, result.error ?? 'The command failed.');
        }
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setFailure(torrentId, message);
        return { ok: false, error: message };
    } finally {
        setPending(torrentId, null);
    }
}
