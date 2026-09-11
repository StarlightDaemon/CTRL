import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsToggle } from '@/shared/ui/settings/SettingsToggle';

describe('SettingsToggle', () => {
    afterEach(cleanup);

    it('exposes a switch named by its visible label with a stable id', () => {
        render(<SettingsToggle id="setting-add-paused" checked={false} onChange={vi.fn()} label="Add torrents paused" description="New torrents start paused." />);
        const toggle = screen.getByRole('switch', { name: 'Add torrents paused' });
        expect(toggle.id).toBe('setting-add-paused');
        expect(toggle).toHaveAttribute('aria-checked', 'false');
        expect(toggle).toHaveAccessibleDescription('New torrents start paused.');
    });

    it('toggles from the switch and from its label, with mouse and keyboard', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<SettingsToggle id="setting-x" checked={false} onChange={onChange} label="Enable notifications" />);

        await user.click(screen.getByRole('switch', { name: 'Enable notifications' }));
        expect(onChange).toHaveBeenCalledTimes(1);

        await user.click(screen.getByText('Enable notifications'));
        expect(onChange).toHaveBeenCalledTimes(2);

        screen.getByRole('switch').focus();
        await user.keyboard(' ');
        expect(onChange).toHaveBeenCalledTimes(3);
    });
});
