import { test, expect } from './fixtures';

test.describe('Popup UI - First Run', () => {
    test('should display setup prompt when unconfigured', async ({ page, extensionId }) => {
        // 1. Navigate to the popup
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // 2. Assert Initial State
        const setupButton = page.getByRole('button', { name: 'Setup Now' });
        await expect(setupButton).toBeVisible();

        const statusMessage = page.getByText('Extension not configured.');
        await expect(statusMessage).toBeVisible();

        // 3. Verify Version Overlay (shows app loaded)
        // Using data-component attribute as per project standards
        const versionOverlay = page.locator('[data-component="VersionOverlay"]');
        await expect(versionOverlay).toBeVisible();
    });
});
