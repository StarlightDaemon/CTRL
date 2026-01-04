import { test, expect } from './fixtures';

// Tagged @integration - requires pre-configured extension, skipped in CI
test.describe('Critical Flow: Add Torrent @integration', () => {

    test('should configure extension and add a torrent successfully', async ({ page, context, extensionId }) => {

        // --- STEP 1: NETWORK MOCKING ---
        await context.route('http://localhost:8112/json', async route => {
            const request = route.request();
            const postData = request.postDataJSON() || {};

            if (postData.method === 'auth.login') {
                return route.fulfill({
                    json: { result: true, error: null, id: postData.id }
                });
            }

            if (postData.method === 'core.add_torrent_magnet') {
                return route.fulfill({
                    json: { result: 'hash12345', error: null, id: postData.id }
                });
            }

            if (postData.method === 'web.update_ui' || postData.method === 'core.get_torrents_status') {
                return route.fulfill({
                    json: {
                        result: {
                            torrents: {
                                'hash12345': {
                                    name: 'Ubuntu Linux.iso',
                                    progress: 50.5,
                                    state: 'Downloading',
                                    total_size: 734003200,
                                    download_payload_rate: 512000,
                                    upload_payload_rate: 10240,
                                    eta: 60,
                                    save_path: '/downloads',
                                    num_seeds: 10,
                                    num_peers: 5,
                                    time_added: Date.now() / 1000
                                }
                            },
                            filters: {}
                        },
                        error: null,
                        id: postData.id
                    }
                });
            }

            return route.fulfill({ json: { result: [], error: null, id: postData.id } });
        });

        // --- STEP 2: SETUP WIZARD ---
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        // Click Setup Now -> Expect New Page

        // Verify Dashboard
        await expect(page.getByText('My Mock Server')).toBeVisible();

        // Fill Magnet
        const addInput = page.getByPlaceholder('Magnet link or URL');
        await addInput.fill('magnet:?xt=urn:btih:hash12345&dn=Ubuntu+Linux.iso');

        // Click Add
        await page.locator('button[aria-label="Add Torrent"]').click();

        // Verify Success
        await expect(page.getByText('Ubuntu Linux.iso')).toBeVisible();
    });
});
