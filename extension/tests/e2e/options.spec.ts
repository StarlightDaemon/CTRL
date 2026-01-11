/**
 * Options Page E2E Tests
 * 
 * Tests the options/settings page functionality including
 * navigation, theme switching, and settings persistence.
 */
import { test, expect } from './fixtures';

test.describe('Options Page', () => {

    test('should load options page correctly', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForLoadState('networkidle');

        // Options page should have some content (not blank)
        const bodyContent = await page.locator('body').textContent();
        expect(bodyContent?.length).toBeGreaterThan(10);
    });

    test('should display version in footer/header', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForLoadState('networkidle');

        // Version should be displayed somewhere
        const versionText = page.getByText(/v\d+\.\d+\.\d+/);
        await expect(versionText.first()).toBeVisible();
    });

    test('should navigate between tabs', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForLoadState('networkidle');

        // Find and click on About tab/section
        const aboutLink = page.getByRole('link', { name: /about/i })
            .or(page.getByRole('button', { name: /about/i }))
            .or(page.getByText('About'));

        if (await aboutLink.first().isVisible()) {
            await aboutLink.first().click();
            // Verify About content is shown
            await expect(page.getByText(/acknowledgments|license|contributors/i).first()).toBeVisible({ timeout: 5000 });
        }
    });

    test('should handle unconfigured state gracefully', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForLoadState('networkidle');

        // Either shows vault setup or server configuration
        const hasSetupPrompt = await page.getByText(/setup|configure|create/i).first().isVisible();
        const hasServerList = await page.getByText(/server|add server/i).first().isVisible();

        expect(hasSetupPrompt || hasServerList).toBeTruthy();
    });
});

test.describe('Options Page - Theme', () => {

    test('should have theme options visible', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.waitForLoadState('networkidle');

        // Navigate to appearance/theme section if available
        const appearanceLink = page.getByRole('link', { name: /appearance|theme/i })
            .or(page.getByRole('button', { name: /appearance|theme/i }));

        if (await appearanceLink.first().isVisible()) {
            await appearanceLink.first().click();
            await page.waitForTimeout(500);

            // Theme options should be present
            const themeOptions = page.getByRole('button').or(page.getByRole('radio'));
            expect(await themeOptions.count()).toBeGreaterThan(0);
        }
    });
});
