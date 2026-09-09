import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServerForm, CREDENTIAL_DISCLOSURE, HTTP_WARNING_TITLE, SERVER_FORM_IDS } from '@/features/torrent-control/ui/ServerForm';
import type { ServerConfig } from '@/shared/lib/types';
import { stubPermissions, stubSendMessage, type PermissionStub } from './browserStubs';

/** The notification element that shows `text`; Carbon inputs also render empty alert announcers, so query by content. */
const notificationWithText = async (text: string | RegExp, role: 'alert' | 'status') => {
    const node = await screen.findByText(text);
    const region = node.closest(`[role="${role}"]`);
    expect(region, `expected "${text}" inside a role=${role} region`).not.toBeNull();
    return region as HTMLElement;
};

const existing: ServerConfig = {
    id: 'srv-1',
    name: 'Home box',
    application: 'transmission',
    type: 'transmission',
    hostname: 'https://home.example:8443/apps/transmission/',
    username: 'alice',
    password: 'secret',
    directories: [],
    clientOptions: {},
};

describe('ServerForm', () => {
    let permissions: PermissionStub;
    let alertSpy: ReturnType<typeof vi.spyOn>;
    let confirmSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        permissions = stubPermissions();
        stubSendMessage(async () => ({ connected: true }));
        alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => { });
        confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    });

    afterEach(() => {
        cleanup();
        alertSpy.mockRestore();
        confirmSpy.mockRestore();
    });

    it('labels every control and associates the credential disclosure', () => {
        render(<ServerForm server={null} onSave={vi.fn()} onCancel={vi.fn()} />);

        const name = screen.getByLabelText('Server name');
        const client = screen.getByLabelText('BitTorrent client');
        const address = screen.getByLabelText('Server address');
        const username = screen.getByLabelText('Username');
        const password = screen.getByLabelText('Password');

        expect(name.id).toBe(SERVER_FORM_IDS.name);
        expect(client.id).toBe(SERVER_FORM_IDS.client);
        expect(address.id).toBe(SERVER_FORM_IDS.address);
        expect(username.id).toBe(SERVER_FORM_IDS.username);
        expect(password.id).toBe(SERVER_FORM_IDS.password);
        expect(password).toHaveAttribute('type', 'password');

        const disclosure = document.getElementById(SERVER_FORM_IDS.credentialDisclosure);
        expect(disclosure).toHaveTextContent(CREDENTIAL_DISCLOSURE);
        expect(username).toHaveAttribute('aria-describedby', SERVER_FORM_IDS.credentialDisclosure);
        expect(password).toHaveAttribute('aria-describedby', SERVER_FORM_IDS.credentialDisclosure);
        expect(CREDENTIAL_DISCLOSURE).toMatch(/encrypts/);
        expect(CREDENTIAL_DISCLOSURE).toMatch(/sent only to the server address/);
        expect(CREDENTIAL_DISCLOSURE).toMatch(/never sends them to the CTRL developer/);
    });

    it('offers only the public clients for a new server', () => {
        render(<ServerForm server={null} onSave={vi.fn()} onCancel={vi.fn()} />);
        const options = within(screen.getByLabelText('BitTorrent client')).getAllByRole('option').map((o) => o.textContent);
        expect(options).toEqual(['Transmission', 'qBittorrent', 'Aria2 / Motrix']);
    });

    it('keeps a hidden client selectable when editing such a server', () => {
        render(<ServerForm server={{ ...existing, type: 'deluge', application: 'deluge' }} onSave={vi.fn()} onCancel={vi.fn()} />);
        const select = screen.getByLabelText('BitTorrent client') as HTMLSelectElement;
        expect(select.value).toBe('deluge');
        expect(within(select).getByRole('option', { name: 'Deluge Web UI (experimental, not verified)' })).toBeInTheDocument();
    });

    it('shows the full stored URL including the sub-path and saves it unchanged', async () => {
        const user = userEvent.setup({ delay: null });
        const onSave = vi.fn(async () => { });
        permissions.granted.add('https://home.example:8443/*');
        render(<ServerForm server={existing} onSave={onSave} onCancel={vi.fn()} />);

        const address = screen.getByLabelText('Server address') as HTMLInputElement;
        expect(address.value).toBe('https://home.example:8443/apps/transmission/');

        await user.click(screen.getByRole('button', { name: 'Save server' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const saved = onSave.mock.calls[0][0] as ServerConfig;
        expect(saved.hostname).toBe('https://home.example:8443/apps/transmission/');
        expect(saved.id).toBe('srv-1');
        expect(saved.username).toBe('alice');
        expect(saved.password).toBe('secret');
    });

    it('normalises a typed address and assigns an id on save', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const onSave = vi.fn(async () => { });
        render(<ServerForm server={null} onSave={onSave} onCancel={vi.fn()} />);

        await user.type(screen.getByLabelText('Server name'), 'NAS');
        screen.getByLabelText('Server address').focus();
        await user.paste('[fd00::5]:9091');
        await user.type(screen.getByLabelText('Username'), 'bob');
        await user.type(screen.getByLabelText('Password'), 'pw');
        await user.click(screen.getByRole('button', { name: 'Save server' }));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        const saved = onSave.mock.calls[0][0] as ServerConfig;
        expect(saved.hostname).toBe('http://[fd00::5]:9091/');
        expect(saved.type).toBe('transmission');
        expect(saved.id).toBeTruthy();
        expect(saved.username).toBe('bob');
        expect(saved.password).toBe('pw');
    });

    it('blocks submission with actionable errors and moves focus to the first invalid field', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const onSave = vi.fn(async () => { });
        render(<ServerForm server={null} onSave={onSave} onCancel={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Save server' }));

        expect(onSave).not.toHaveBeenCalled();
        expect(screen.getByLabelText('Server name')).toHaveFocus();
        expect(screen.getByLabelText('Server name')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByText('Enter a name for this server.')).toBeInTheDocument();
        expect(screen.getByText('Enter the server address.')).toBeInTheDocument();

        await user.type(screen.getByLabelText('Server name'), 'X');
        await user.type(screen.getByLabelText('Server address'), 'ftp://x.example/');
        expect(screen.getByText('Only http:// and https:// addresses are supported.')).toBeInTheDocument();
    });

    it('warns about plain HTTP to a non-private host and not for LAN or HTTPS', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        render(<ServerForm server={null} onSave={vi.fn()} onCancel={vi.fn()} />);
        const address = screen.getByLabelText('Server address');

        await user.type(address, 'http://seedbox.example:9091/');
        expect(screen.getByText(HTTP_WARNING_TITLE)).toBeInTheDocument();
        expect(screen.getByText(/can be read or altered/)).toBeInTheDocument();

        await user.clear(address);
        await user.type(address, 'http://192.168.1.20:9091/');
        expect(screen.queryByText(HTTP_WARNING_TITLE)).not.toBeInTheDocument();

        await user.clear(address);
        await user.type(address, 'https://seedbox.example/');
        expect(screen.queryByText(HTTP_WARNING_TITLE)).not.toBeInTheDocument();
    });

    it('reports a missing host permission, lets the user grant it, and reacts to revocation', async () => {
        const user = userEvent.setup({ delay: null });
        render(<ServerForm server={existing} onSave={vi.fn()} onCancel={vi.fn()} />);

        const grant = await screen.findByRole('button', { name: 'Grant access to https://home.example:8443' });
        expect(screen.getByText('Access not granted')).toBeInTheDocument();

        await user.click(grant);
        expect(permissions.request).toHaveBeenCalledWith({ origins: ['https://home.example:8443/*'] });
        await screen.findByText('CTRL may contact https://home.example:8443.');
        expect(screen.queryByText('Access not granted')).not.toBeInTheDocument();

        // The user revokes it from the browser while the form is open.
        permissions.granted.clear();
        permissions.emitRemoved();
        await screen.findByText('Access not granted');
    });

    it('tests the connection with the normalised configuration and reports the result', async () => {
        const user = userEvent.setup({ delay: null });
        permissions.granted.add('https://home.example:8443/*');
        const sendMessage = stubSendMessage(async () => ({ connected: true }));
        render(<ServerForm server={existing} onSave={vi.fn()} onCancel={vi.fn()} />);
        await screen.findByText('CTRL may contact https://home.example:8443.');

        await user.click(screen.getByRole('button', { name: 'Test connection' }));

        await screen.findByText('Connection successful');
        expect(sendMessage).toHaveBeenCalledTimes(1);
        const request = sendMessage.mock.calls[0][0] as { type: string; config: ServerConfig };
        expect(request.type).toBe('TEST_CONNECTION');
        expect(request.config.hostname).toBe('https://home.example:8443/apps/transmission/');
        expect(request.config.id).toBe('srv-1');
    });

    it('shows the server error when the test fails and never uses native dialogs', async () => {
        const user = userEvent.setup({ delay: null });
        permissions.granted.add('https://home.example:8443/*');
        stubSendMessage(async () => ({ connected: false, error: 'Authentication failed: check the username and password.' }));
        render(<ServerForm server={existing} onSave={vi.fn()} onCancel={vi.fn()} />);
        await screen.findByText('CTRL may contact https://home.example:8443.');

        await user.click(screen.getByRole('button', { name: 'Test connection' }));

        const alert = await notificationWithText('Connection failed', 'alert');
        expect(alert).toHaveTextContent('Authentication failed: check the username and password.');
        expect(alertSpy).not.toHaveBeenCalled();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('refuses to test before access is granted and says why', async () => {
        const user = userEvent.setup({ delay: null });
        const sendMessage = stubSendMessage(async () => ({ connected: true }));
        render(<ServerForm server={existing} onSave={vi.fn()} onCancel={vi.fn()} />);
        await screen.findByText('Access not granted');

        await user.click(screen.getByRole('button', { name: 'Test connection' }));

        expect(sendMessage).not.toHaveBeenCalled();
        await notificationWithText('Grant CTRL access to https://home.example:8443 before testing the connection.', 'alert');
    });

    it('surfaces a save failure in place', async () => {
        const user = userEvent.setup({ delay: null });
        const onSave = vi.fn(async () => { throw new Error('Vault is locked. Cannot save server settings.'); });
        render(<ServerForm server={existing} onSave={onSave} onCancel={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'Save server' }));

        const alert = await notificationWithText('Not saved', 'alert');
        expect(alert).toHaveTextContent('Vault is locked. Cannot save server settings.');
    });

    it('is operable with the keyboard alone', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        const onSave = vi.fn(async () => { });
        render(<ServerForm server={null} onSave={onSave} onCancel={vi.fn()} />);

        await user.tab();
        expect(screen.getByLabelText('Server name')).toHaveFocus();
        await user.keyboard('Keyboard box');
        await user.tab();
        expect(screen.getByLabelText('BitTorrent client')).toHaveFocus();
        await user.tab();
        expect(screen.getByLabelText('Server address')).toHaveFocus();
        await user.keyboard('http://10.0.0.7:9091{Enter}');

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect((onSave.mock.calls[0][0] as ServerConfig).hostname).toBe('http://10.0.0.7:9091/');
    });
});
