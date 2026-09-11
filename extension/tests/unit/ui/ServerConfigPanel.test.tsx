import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerConfigPanel } from '@/features/torrent-control/ui/ServerConfigPanel';
import { useTorrentStore } from '@/stores/useTorrentStore';
import { DEFAULT_OPTIONS } from '@/shared/lib/constants';
import type { AppOptions, ServerConfig } from '@/shared/lib/types';
import { emptyStats, initialConnectionState } from '@/shared/api/messaging/protocol';
import { stubPermissions, stubSendMessage, type PermissionStub } from './browserStubs';

const alpha: ServerConfig = {
    id: 'alpha',
    name: 'Alpha',
    application: 'transmission',
    type: 'transmission',
    hostname: 'http://192.168.1.10:9091/',
    directories: [],
    clientOptions: {},
};
const beta: ServerConfig = {
    id: 'beta',
    name: 'Beta',
    application: 'deluge',
    type: 'deluge',
    hostname: 'http://192.168.1.11:8112/',
    directories: [],
    clientOptions: {},
};

function settingsWith(servers: ServerConfig[], currentServer = 0): AppOptions {
    return { globals: { ...DEFAULT_OPTIONS.globals, currentServer }, servers };
}

describe('ServerConfigPanel', () => {
    let permissions: PermissionStub;
    let alertSpy: ReturnType<typeof vi.spyOn>;
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        permissions = stubPermissions(['http://192.168.1.10:9091/*', 'http://192.168.1.11:8112/*']);
        stubSendMessage(async () => ({ connected: true }));
        useTorrentStore.getState().reset();
        alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
        confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    });

    afterEach(() => {
        cleanup();
        alertSpy.mockRestore();
        confirmSpy.mockRestore();
    });

    it('lists servers with named actions and marks hidden clients as experimental', () => {
        render(<ServerConfigPanel settings={settingsWith([alpha, beta])} updateSettings={vi.fn(async () => { })} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        const list = screen.getByRole('list', { name: 'Configured servers' });
        expect(within(list).getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Edit Alpha' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Remove Beta' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Make Beta the default server' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Make Alpha the default server' })).not.toBeInTheDocument();
        expect(screen.getByText('experimental, not verified')).toBeInTheDocument();
    });

    it('removes a server through an in-product confirmation, never window.confirm', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const updateSettings = vi.fn(async () => { });
        render(<ServerConfigPanel settings={settingsWith([alpha, beta], 1)} updateSettings={updateSettings} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Remove Alpha' }));

        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('Remove server?');
        expect(dialog).toHaveTextContent('Nothing changes on the torrent client itself.');
        // Carbon prefixes danger buttons with a visually hidden "danger" label.
        await user.click(within(dialog).getByRole('button', { name: /Remove$/ }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
        const next = updateSettings.mock.calls[0][0] as AppOptions;
        expect(next.servers.map((s) => s.id)).toEqual(['beta']);
        // Beta was the default at index 1; it is now at index 0.
        expect(next.globals.currentServer).toBe(0);
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(alertSpy).not.toHaveBeenCalled();
        expect((await screen.findByText('Server removed')).closest('[role="status"]')).not.toBeNull();
    });

    it('cancelling the confirmation keeps the server', async () => {
        const user = userEvent.setup({ delay: null });
        const updateSettings = vi.fn(async () => { });
        render(<ServerConfigPanel settings={settingsWith([alpha])} updateSettings={updateSettings} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Remove Alpha' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

        expect(updateSettings).not.toHaveBeenCalled();
    });

    it('adds a server through the form and reports success in place', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const updateSettings = vi.fn(async () => { });
        render(<ServerConfigPanel settings={settingsWith([])} updateSettings={updateSettings} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Add server' }));
        await user.type(screen.getByLabelText('Server name'), 'New box');
        await user.type(screen.getByLabelText('Server address'), 'https://box.example/tm');
        await user.click(screen.getByRole('button', { name: 'Save server' }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
        const next = updateSettings.mock.calls[0][0] as AppOptions;
        expect(next.servers).toHaveLength(1);
        expect(next.servers[0].hostname).toBe('https://box.example/tm/');
        expect(next.globals.currentServer).toBe(0);
        expect((await screen.findByText('Server added')).closest('[role="status"]')).not.toBeNull();
    });

    it('edits the selected server in place, preserving its identity', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const updateSettings = vi.fn(async () => { });
        render(<ServerConfigPanel settings={settingsWith([alpha, beta])} updateSettings={updateSettings} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Edit Beta' }));
        const name = screen.getByLabelText('Server name');
        await user.clear(name);
        await user.type(name, 'Beta renamed');
        await user.click(screen.getByRole('button', { name: 'Save server' }));

        await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
        const next = updateSettings.mock.calls[0][0] as AppOptions;
        expect(next.servers.map((s) => s.id)).toEqual(['alpha', 'beta']);
        expect(next.servers[1].name).toBe('Beta renamed');
        expect(next.servers[1].type).toBe('deluge');
        expect(next.servers[1].hostname).toBe('http://192.168.1.11:8112/');
    });

    it('shows the canonical connection state for the active server and offers recovery when access was revoked', async () => {
        const user = userEvent.setup({ delay: null });
        useTorrentStore.getState().applyStatus({
            type: 'STATUS',
            connection: {
                ...initialConnectionState(),
                status: 'permission_missing',
                serverId: 'alpha',
                serverName: 'Alpha',
                lastErrorType: 'PERMISSION_REVOKED',
                lastError: 'Access to this server address was removed in the browser. Grant it again to reconnect.',
            },
            stats: emptyStats(),
            cleared: true,
        });
        render(<ServerConfigPanel settings={settingsWith([alpha, beta])} updateSettings={vi.fn(async () => { })} exportServerConfig={vi.fn()} importBackup={vi.fn()} />);

        expect(screen.getByText('Access revoked')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Grant access to Alpha' }));
        expect(permissions.request).toHaveBeenCalledWith({ origins: ['http://192.168.1.10:9091/*'] });
        // Beta is not the server the background reports on, so it shows no live state.
        expect(screen.queryByRole('button', { name: 'Grant access to Beta' })).not.toBeInTheDocument();
    });

    it('reports import results in place instead of alerting', async () => {
        const user = userEvent.setup({ delay: null });
        const importBackup = vi.fn(async () => ({ success: true, message: 'Server configuration imported.' }));
        render(<ServerConfigPanel settings={settingsWith([alpha])} updateSettings={vi.fn(async () => { })} exportServerConfig={vi.fn()} importBackup={importBackup} />);

        const file = new File(['{}'], 'servers.json', { type: 'application/json' });
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        await user.upload(input, file);

        await waitFor(() => expect(importBackup).toHaveBeenCalledTimes(1));
        expect((await screen.findByText('Server configuration imported.')).closest('[role="status"]')).not.toBeNull();
        expect(alertSpy).not.toHaveBeenCalled();
    });
});
