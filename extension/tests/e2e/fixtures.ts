import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
    context: BrowserContext;
    extensionId: string;
    backgroundWorker: Worker;
}>({
    context: async ({ }, use, testInfo) => {
        // Resolve to the WXT build output
        const pathToExtension = path.resolve(__dirname, '../../builds/chrome-mv3');

        // Validation
        if (!fs.existsSync(pathToExtension)) {
            throw new Error(`Extension build not found at ${pathToExtension}. Run 'npm run build:chrome' first.`);
        }

        // Use unique temp directory per test to avoid SingletonLock conflicts
        const userDataDir = path.join(os.tmpdir(), `pw-ext-${testInfo.workerIndex}-${Date.now()}`);
        await fs.promises.mkdir(userDataDir, { recursive: true });

        // Launch Persistent Context
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: false, // Explicitly false for extensions
            args: [
                process.env.CI ? '--headless=new' : '', // Use new headless in CI
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ].filter(Boolean),
        });

        await use(context);

        await context.close();
        // Clean up temp directory
        try {
            await fs.promises.rm(userDataDir, { recursive: true, force: true });
        } catch (e) { /* Ignore cleanup errors */ }
    },

    extensionId: async ({ context }, use) => {
        let [worker] = context.serviceWorkers();
        if (!worker) {
            worker = await context.waitForEvent('serviceworker');
        }
        const extensionId = worker.url().split('/')[2];
        await use(extensionId);
    },
});

export const expect = test.expect;
