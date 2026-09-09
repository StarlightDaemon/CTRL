import React from 'react';
import { InlineNotification } from '@carbon/react';
import type { ConnectionState } from '@/shared/api/messaging/protocol';

export interface ConnectionPresentation {
    kind: 'success' | 'info' | 'warning' | 'error';
    title: string;
    detail: string;
}

/**
 * Single source of truth for how a connection state is described to users.
 * Shared by the popup, the options dashboard and the torrent list so the same
 * situation never reads differently in two places.
 */
export function describeConnection(connection: ConnectionState): ConnectionPresentation {
    const server = connection.serverName ?? 'the server';
    switch (connection.status) {
        case 'uninitialized':
            return { kind: 'info', title: 'Not set up', detail: 'Create a master password to start using CTRL.' };
        case 'locked':
            return { kind: 'warning', title: 'Locked', detail: 'Unlock CTRL with your master password to see your torrents.' };
        case 'vault_corrupted':
            return { kind: 'error', title: 'Vault damaged', detail: 'The stored vault data is incomplete or damaged and cannot be unlocked. Open CTRL settings to reset it.' };
        case 'no_servers':
            return { kind: 'info', title: 'No server configured', detail: 'Add a torrent client in Settings → Servers.' };
        case 'invalid_config':
            return { kind: 'error', title: 'Server configuration invalid', detail: connection.lastError ?? 'Check the server address and client type in Settings → Servers.' };
        case 'permission_missing':
            if (connection.lastErrorType === 'PERMISSION_REVOKED') {
                return { kind: 'warning', title: 'Access revoked', detail: `Access to ${server} was removed in the browser. Grant it again to reconnect.` };
            }
            return { kind: 'warning', title: 'Access not granted', detail: `CTRL needs permission to contact ${server}. Grant access in Settings → Servers.` };
        case 'connecting':
            return { kind: 'info', title: 'Connecting…', detail: `Contacting ${server}.` };
        case 'connected':
            return { kind: 'success', title: 'Connected', detail: `Live data from ${server}.` };
        case 'stale':
            return { kind: 'warning', title: 'Connection lost', detail: `Showing the last data received from ${server}. ${connection.lastError ?? ''}`.trim() };
        case 'unavailable':
            return { kind: 'error', title: 'Server unavailable', detail: connection.lastError ?? `${server} cannot be reached.` };
        case 'auth_failed':
            return { kind: 'error', title: 'Authentication failed', detail: connection.lastError ?? `${server} rejected the saved credentials.` };
        default:
            return { kind: 'info', title: 'Unknown', detail: '' };
    }
}

interface Props {
    connection: ConnectionState;
    /** Hide the banner when everything is fine. */
    hideWhenConnected?: boolean;
}

export const ConnectionBanner: React.FC<Props> = ({ connection, hideWhenConnected = true }) => {
    if (hideWhenConnected && connection.status === 'connected') return null;
    if (connection.status === 'connecting' && hideWhenConnected) return null;
    const presentation = describeConnection(connection);
    return (
        <div className="mb-2">
            <InlineNotification
                kind={presentation.kind}
                title={presentation.title}
                subtitle={presentation.detail}
                lowContrast
                hideCloseButton
                role="status"
                aria-live="polite"
            />
        </div>
    );
};
