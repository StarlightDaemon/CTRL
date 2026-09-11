import { test, expect } from './fixtures';

/**
 * Popup first-run smoke test.
 *
 * On a fresh profile the vault is uninitialized, so the popup renders the
 * "Set up CTRL" prompt from src/features/torrent-control/ui/Dashboard.tsx:
 * a heading, one sentence about the master password, and a single action
 * that opens the options page. Assertions use the prompt's accessible roles
 * and names, not markup.
 */
test.describe('Popup UI - First Run', () => {
    test('shows the set-up prompt when the vault is uninitialized', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // The vault status is resolved asynchronously; the heading appears once it is known.
        await expect(page.getByRole('heading', { name: 'Set up CTRL' })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(/master password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Set up now' })).toBeVisible();

        // Nothing from the live dashboard may render before a vault exists.
        await expect(page.getByPlaceholder(/magnet:/i)).toHaveCount(0);
    });
});
