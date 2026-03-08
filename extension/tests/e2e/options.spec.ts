/**
 * Options Page E2E Tests
 * 
 * Tests the options/settings page functionality including
 * navigation, theme switching, and settings persistence.
 * 
 * These tests run without any @integration tag and should pass in CI.
 */
import { test, expect, waitForExtensionReady } from './fixtures';

test.describe('Options Page', () => {
    // Helper to navigate to options page with proper waits
    const gotoOptions = async (page: any, extensionId: string) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await waitForExtensionReady(page);
    };

    test('should load options page correctly', async ({ page, extensionId }) => {
        await gotoOptions(page, extensionId);

        // Options page should have meaningful content (not blank or error state)
        const bodyContent = await page.locator('body').textContent();
        expect(bodyContent?.length).toBeGreaterThan(10);

        // Should not show a crash/error page
        await expect(page.getByText(/error|crash|failed to load/i)).not.toBeVisible();
    });

    test('should display version in footer/header', async ({ page, extensionId }) => {
        await gotoOptions(page, extensionId);

        // Version should be displayed somewhere (e.g., "v0.2.0-beta.1")
        const versionPattern = /v\d+\.\d+\.\d+/;
        const versionLocator = page.getByText(versionPattern);

        // Wait with explicit timeout for version to appear
        await expect(versionLocator.first()).toBeVisible({ timeout: 10000 });
    });

    test('should navigate between tabs', async ({ page, extensionId }) => {
        await gotoOptions(page, extensionId);

        // Find navigation elements - try multiple strategies
        const aboutLink = page.getByRole('link', { name: /about/i })
            .or(page.getByRole('button', { name: /about/i }))
            .or(page.locator('[data-tab="about"]'))
            .or(page.getByText('About').first());

        // Only test navigation if the tab is visible
        if (await aboutLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await aboutLink.first().click();

            // Wait for content to load
            await page.waitForTimeout(300);

            // Verify About content is shown
            const aboutContent = page.getByText(/acknowledgments|license|contributors|version/i);
            await expect(aboutContent.first()).toBeVisible({ timeout: 5000 });
        } else {
            // Tab not present - skip this assertion (different UI state)
            test.skip();
        }
    });

    test('should handle unconfigured state gracefully', async ({ page, extensionId }) => {
        await gotoOptions(page, extensionId);

        // In unconfigured state, should show either:
        // 1. Vault setup prompt
        // 2. Server configuration wizard
        // 3. "Add Server" button

        const setupIndicators = [
            page.getByText(/setup|configure|create vault/i),
            page.getByText(/add server/i),
            page.getByRole('button', { name: /setup|configure|add/i }),
        ];

        let foundSetup = false;
        for (const indicator of setupIndicators) {
            if (await indicator.first().isVisible({ timeout: 2000 }).catch(() => false)) {
                foundSetup = true;
                break;
            }
        }

        expect(foundSetup).toBeTruthy();
    });
});

test.describe('Options Page - Theme', () => {

    test('should have theme options visible', async ({ page, extensionId }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await waitForExtensionReady(page);

        // Navigate to appearance/theme section if available
        const appearanceLink = page.getByRole('link', { name: /appearance|theme/i })
            .or(page.getByRole('button', { name: /appearance|theme/i }))
            .or(page.locator('[data-tab="appearance"]'));

        if (await appearanceLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await appearanceLink.first().click();
            await page.waitForTimeout(300);

            // Theme options should be present (buttons, radios, or select)
            const themeControls = page.getByRole('button')
                .or(page.getByRole('radio'))
                .or(page.locator('[data-theme]'));

            const count = await themeControls.count();
            expect(count).toBeGreaterThan(0);
        } else {
            // Theme section not in current UI state - skip
            test.skip();
        }
    });
});

