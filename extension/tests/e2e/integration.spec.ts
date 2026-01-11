import { test, expect } from './fixtures';

// Tagged @integration - requires real qBittorrent server, skipped in CI
test.describe('Integration: Smart Self-Configuring @integration', () => {

    test('should add a real magnet link (auto-configuring if needed)', async ({ page, context, extensionId }) => {
        try {
            console.error('Step: Open Extension');
            // Increase timeout for this test
            test.setTimeout(120000);

            await page.goto(`chrome-extension://${extensionId}/popup.html`);
            await page.waitForLoadState('networkidle');

            // 1. Check State
            const setupBtn = page.getByRole('button', { name: 'Setup Now' });
            if (await setupBtn.isVisible()) {
                console.error('Step: Detected Setup Needed - Configuring Automatically...');

                // Perform Setup
                const [optionsPage] = await Promise.all([
                    context.waitForEvent('page'),
                    setupBtn.click()
                ]);
                await optionsPage.waitForLoadState();

                // Setup Vault
                console.error('Step: Setup - Creating Vault');
                await optionsPage.getByPlaceholder('Min. 8 characters').fill('securepassword123');
                await optionsPage.getByPlaceholder('Repeat password').fill('securepassword123');
                await optionsPage.getByRole('button', { name: /Create Vault|Encrypt & Migrate/ }).click();

                // Setup Server
                console.error('Step: Setup - Adding Server');
                // Wait for transitions
                await expect(optionsPage.getByText('Server Configuration', { exact: false })).toBeVisible({ timeout: 15000 });

                // Add Server
                await optionsPage.locator('button').filter({ hasText: 'Add Server' }).click();

                // Fill Form (qBittorrent)
                console.error('Step: Setup - Filling qBittorrent Details');
                await optionsPage.locator('input[value="New Server"]').fill('Local qBit');
                await optionsPage.locator('select').first().selectOption('qbittorrent');

                // Using 192.168.1.82:8080 as verified by user
                // Clear default 127.0.0.1 inputs first just in case
                await optionsPage.locator('input[placeholder="127.0.0.1"]').fill('192.168.1.82');
                await optionsPage.locator('input[placeholder="8080"]').fill('8080');

                // Auth
                await optionsPage.locator('input[type="text"]').nth(2).fill('agent007');
                // Password usually last input
                await optionsPage.locator('input[type="password"]').last().fill('agent007');

                // GRANT PERMISSION if visible (It might be needed due to IP usage)
                const grantBtn = optionsPage.getByRole('button', { name: 'Grant' }); // Fuzzy match
                if (await grantBtn.isVisible()) {
                    console.error('Step: Setup - Granting Permissions');
                    await grantBtn.click();
                    // Wait for browser permission dialogue handling? 
                    // Playwright usually auto-accepts? Or we might be stuck.
                    // With host_permissions in manifest, usually it just works or we mock it.
                    // But let's hope it works or isn't needed if already granted.
                }

                console.error('Step: Setup - Saving');
                // Force click the now-always-enabled Save button
                await optionsPage.getByRole('button', { name: 'Save Server' }).click();

                // Wait for list
                await expect(optionsPage.getByText('Local qBit')).toBeVisible({ timeout: 15000 });
                await optionsPage.close();

                // Reload Popup
                await page.reload();
            } else {
                console.error('Step: Already Configured - Skipping Setup');
            }

            // 2. Add Torrent
            console.error('Step: Add Torrent Flow');
            // Ubuntu 24.04 LTS
            const ubuntuMagnet = 'magnet:?xt=urn:btih:3b245504cf56117d4a0456906d642e0640d63255&dn=ubuntu-23.04-desktop-amd64.iso';

            await page.getByPlaceholder('Magnet link or URL').fill(ubuntuMagnet);
            await page.locator('button[aria-label="Add Torrent"]').click();

            // 3. Verify
            console.error('Step: Verifying Addition');
            await expect(page.getByText('ubuntu', { exact: false }).first()).toBeVisible({ timeout: 20000 });
            console.error('Step: Success! Torrent added.');

        } catch (e: any) {
            console.error('TEST FAILED:', e.message);
            throw e;
        }
    });

});
