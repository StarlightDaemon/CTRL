import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Core User Flows', () => {
    let browserContext;
    let extensionId;

    test.setTimeout(60000);

    test.beforeAll(async () => {
        const pathToExtension = path.join(__dirname, '../builds/chrome-mv3');
        const userDataDir = path.join(__dirname, `../test-user-data-core-${Date.now()}`);

        browserContext = await chromium.launchPersistentContext(userDataDir, {
            headless: false,
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
                '--no-sandbox',
                '--disable-gpu',
            ],
        });

        // Wait for extension to load (Service Worker for MV3)
        let [serviceWorker] = browserContext.serviceWorkers();
        if (!serviceWorker) {
            serviceWorker = await browserContext.waitForEvent('serviceworker');
        }

        extensionId = serviceWorker.url().split('/')[2];
        console.log('Extension ID:', extensionId);

        // Verify worker is alive
        const runtimeId = await serviceWorker.evaluate(() => chrome.runtime.id);
        console.log('Runtime ID from Worker:', runtimeId);

        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test.afterAll(async () => {
        await browserContext.close();
    });

    test('Extension Loads and Popup Works', async ({ page }) => {
        console.log(`Navigating to chrome-extension://${extensionId}/popup.html`);
        await page.goto(`chrome-extension://${extensionId}/popup.html`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('text=Torrent Control')).toBeVisible();
    });

    test('Options Page - About Tab', async ({ page }) => {
        console.log(`Navigating to chrome-extension://${extensionId}/options.html`);
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });

        // Navigate to About tab
        await page.click('text=About');

        // Verify Content
        await expect(page.locator('text=Torrent Control')).toBeVisible();
        await expect(page.locator('text=Reloaded')).toBeVisible();
        await expect(page.locator('text=High Performance')).toBeVisible();

        // Verify Scrolling (indirectly by checking visibility of bottom elements)
        await expect(page.locator('text=Released under the MIT License')).toBeVisible();
    });

    test('Options Page - Add Server UI', async ({ page }) => {
        console.log(`Navigating to chrome-extension://${extensionId}/options.html`);
        await page.goto(`chrome-extension://${extensionId}/options.html`, { waitUntil: 'domcontentloaded' });

        // Navigate to Servers tab (it's under Torrent Control -> Servers)
        await page.click('text=Servers');

        // Check for Add Server button
        await expect(page.locator('button:has-text("Add Server")')).toBeVisible();

        // Click Add Server
        await page.click('button:has-text("Add Server")');

        // Check for form fields
        await expect(page.locator('input[placeholder="e.g., My Seedbox"]')).toBeVisible();
        await expect(page.locator('text=Client Type')).toBeVisible();
    });
});
