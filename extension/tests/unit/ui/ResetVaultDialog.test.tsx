import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetVaultDialog } from '@/shared/ui/security/ResetVaultDialog';
import { VaultGuard } from '@/shared/ui/security/VaultGuard';
import { VaultService, VAULT_KEY } from '@/shared/api/security/VaultService';
import { storage } from 'wxt/utils/storage';

describe('ResetVaultDialog', () => {
    afterEach(cleanup);

    it('requires an explicit acknowledgement before the destructive action is enabled', async () => {
        const user = userEvent.setup({ delay: null });
        const onConfirm = vi.fn(async () => { });
        const onClose = vi.fn();
        render(<ResetVaultDialog open onClose={onClose} onConfirm={onConfirm} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveTextContent('every saved server: its address, username and password');
        expect(dialog).toHaveTextContent('the master password');
        expect(dialog).toHaveTextContent('Your preferences (context menu, badge, add-paused, notifications, labels) are kept.');

        const primary = within(dialog).getByRole('button', { name: /Delete servers and reset$/ });
        expect(primary).toBeDisabled();

        await user.click(within(dialog).getByRole('checkbox', { name: 'I understand that every saved server and login will be deleted' }));
        expect(primary).toBeEnabled();

        await user.click(primary);
        await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it('shows a failure inside the dialog and stays open', async () => {
        const user = userEvent.setup({ delay: null });
        const onConfirm = vi.fn(async () => { throw new Error('storage unavailable'); });
        const onClose = vi.fn();
        render(<ResetVaultDialog open onClose={onClose} onConfirm={onConfirm} />);
        const dialog = screen.getByRole('dialog');

        await user.click(within(dialog).getByRole('checkbox'));
        await user.click(within(dialog).getByRole('button', { name: /Delete servers and reset$/ }));

        expect((await within(dialog).findByText('storage unavailable')).closest('[role="alert"]')).not.toBeNull();
        expect(onClose).not.toHaveBeenCalled();
    });
});

describe('VaultGuard with a corrupted vault', () => {
    afterEach(cleanup);

    it('never renders the unlocked content and recovers through the confirmed reset', { timeout: 20000 }, async () => {
        const user = userEvent.setup({ delay: null });
        // A damaged envelope: right shape marker, unusable material.
        await storage.setItem(VAULT_KEY, { version: 2, salt: [1], iv: [], ciphertext: [], revision: 1 });
        expect(await VaultService.getState()).toBe('corrupted');

        const children = vi.fn(() => <div>UNLOCKED CONTENT</div>);
        render(<VaultGuard>{children}</VaultGuard>);

        await screen.findByText('Vault damaged');
        expect(children).not.toHaveBeenCalled();
        expect(screen.queryByText('UNLOCKED CONTENT')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Reset vault…$/ }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('checkbox'));
        await user.click(within(dialog).getByRole('button', { name: /Delete servers and reset$/ }));

        // The vault is gone; the guard now offers first-time setup.
        await screen.findByText('Secure Your Data');
        expect(await VaultService.getState()).toBe('uninitialized');
        expect(await storage.getItem(VAULT_KEY)).toBeNull();
    });
});
