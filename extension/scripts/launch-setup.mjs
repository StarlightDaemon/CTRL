import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    console.log('--- MANUAL SETUP SESSION ---');
    console.log('Launching browser with Persistent Profile...');

    // Paths
    const projectRoot = path.resolve(__dirname, '..');
    const userDataDir = path.resolve(projectRoot, 'tests', 'e2e', '.persistent-data');
    const extensionPath = path.resolve(projectRoot, 'builds', 'chrome-mv3');

    // Ensure directory existence
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }
    if (!fs.existsSync(extensionPath)) {
        console.error(`ERROR: Extension build not found at ${extensionPath}`);
        console.error("Please run 'npm run build:chrome' first.");
        process.exit(1);
    }

    console.log(`Profile:   ${userDataDir}`);
    console.log(`Extension: ${extensionPath}`);

    // Launch
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
        viewport: null
    });

    console.log('\nBROWSER OPENED!');
    console.log('1. Go to extensions or click the icon.');
    console.log('2. Perform the setup manualy.');
    console.log('3. Add your local server.');
    console.log('4. Verify everything works.');
    console.log('\nPress Ctrl+C in this terminal when you are done to close the browser.');

    // Attempt to open popup directly to be helpful
    try {
        // Wait for service worker to initialize
        await new Promise(r => setTimeout(r, 2000));
        let [worker] = context.serviceWorkers();
        if (worker) {
            const extId = worker.url().split('/')[2];
            const page = await context.newPage();
            await page.goto(`chrome-extension://${extId}/popup.html`);
        }
    } catch (e) {
        console.log('Could not auto-open popup tab, please open extension manually.');
    }

    // Keep alive until killed
    await new Promise(() => { });
}

run().catch(console.error);
