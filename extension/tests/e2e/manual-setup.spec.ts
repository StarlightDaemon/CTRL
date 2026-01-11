import { test } from './fixtures';

// Tagged @integration - manual test for development, skipped in CI
test('Manual Setup Session @integration', async ({ page }) => {
    // Set 10 minute timeout
    test.setTimeout(600000);

    console.log('BROWSER OPEN FOR MANUAL SETUP');
    console.log('1. Click the Extension Icon or Setup Now');
    console.log('2. Configure your Vault and Local Server');
    console.log('3. Verify you can see your torrent list (if any)');
    console.log('4. Close the browser window or stop this script when done.');

    // Attempt to navigate to popup
    try {
        const workers = page.context().serviceWorkers();
        if (workers.length > 0) {
            const extId = workers[0].url().split('/')[2];
            await page.goto(`chrome-extension://${extId}/popup.html`);
        }
    } catch (e) {
        console.log('Could not auto-navigate to popup, please open manually.');
    }

    // Keep open
    await page.waitForTimeout(300000);
});
