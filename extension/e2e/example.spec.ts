import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Extension E2E', () => {
    let browserContext;
    let extensionId;

    test.beforeAll(async () => {
        const pathToExtension = path.join(__dirname, '../builds/chrome-mv3');
        const userDataDir = path.join(__dirname, '../test-user-data');

        browserContext = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
        });

        // Wait for extension to load
        let [backgroundPage] = browserContext.backgroundPages();
        if (!backgroundPage) {
            backgroundPage = await browserContext.waitForEvent('backgroundpage');
        }

        // Extract Extension ID from background page URL
        // chrome-extension://<id>/background.js
        extensionId = backgroundPage.url().split('/')[2];
    });

    test.afterAll(async () => {
        await browserContext.close();
    });

    test('Popup opens and renders title', async ({ page }) => {
        // Open Popup directly
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        await expect(page.locator('text=Torrent Control')).toBeVisible();
    });
});
