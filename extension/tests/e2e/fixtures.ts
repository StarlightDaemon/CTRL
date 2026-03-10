/**
 * E2E Test Fixtures for CTRL Extension
 * 
 * Provides:
 * - Persistent browser context with extension loaded
 * - Extension ID extraction from service worker
 * - Unique temp directories per test to avoid conflicts
 */
import { test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Extension build path
const EXTENSION_PATH = path.resolve(__dirname, '../../builds/chrome-mv3');

/**
 * Custom test fixture extending Playwright's base
 */
export const test = base.extend<{
    context: BrowserContext;
    extensionId: string;
    extensionPage: Page;
}>({
    // Persistent context with extension loaded
    context: async ({ }, use, testInfo) => {
        // Validate extension build exists
        if (!fs.existsSync(EXTENSION_PATH)) {
            throw new Error(
                `Extension build not found at ${EXTENSION_PATH}.\n` +
                `Run 'npm run build:chrome' first.`
            );
        }

        // Use unique temp directory per test to avoid SingletonLock conflicts
        const userDataDir = path.join(
            os.tmpdir(),
            `ctrl-e2e-${testInfo.workerIndex}-${Date.now()}`
        );
        await fs.promises.mkdir(userDataDir, { recursive: true });

        // Launch persistent context with extension
        const context = await chromium.launchPersistentContext(userDataDir, {
            headless: true,
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage', // Prevent shared memory issues in CI
            ],
        });

        // Wait for service worker to be ready
        await waitForServiceWorker(context);

        await use(context);

        // Cleanup
        await context.close();
        await cleanupTempDir(userDataDir);
    },

    // Extract extension ID from service worker URL
    extensionId: async ({ context }, use) => {
        const worker = await getServiceWorker(context);
        const extensionId = worker.url().split('/')[2];
        await use(extensionId);
    },

    // Convenience: Pre-opened extension page
    extensionPage: async ({ context, extensionId }, use) => {
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForLoadState('domcontentloaded');
        await use(page);
        await page.close();
    },
});

export const expect = test.expect;

// ============ Helper Functions ============

/**
 * Wait for service worker to be available
 */
async function waitForServiceWorker(context: BrowserContext, timeout = 30000): Promise<void> {
    const startTime = Date.now();

    let eventFired = false;
    const listener = () => { eventFired = true; };
    context.once('serviceworker', listener);

    try {
        while (Date.now() - startTime < timeout) {
            if (context.serviceWorkers().length > 0 || eventFired) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100)); // Poll every 100ms
        }
        throw new Error(`Timeout ${timeout}ms exceeded while waiting for service worker to initialize.`);
    } finally {
        context.off('serviceworker', listener);
    }
}

/**
 * Get the extension's service worker
 */
async function getServiceWorker(context: BrowserContext, timeout = 30000) {
    const startTime = Date.now();

    let workerFromEvent: any = null;
    const listener = (worker: any) => { workerFromEvent = worker; };
    context.once('serviceworker', listener);

    try {
        while (Date.now() - startTime < timeout) {
            const workers = context.serviceWorkers();
            if (workers.length > 0) {
                return workers[0];
            }
            if (workerFromEvent) {
                return workerFromEvent;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error(`Timeout ${timeout}ms exceeded while getting service worker.`);
    } finally {
        context.off('serviceworker', listener);
    }
}

/**
 * Clean up temp directory, ignoring errors
 */
async function cleanupTempDir(dir: string): Promise<void> {
    try {
        await fs.promises.rm(dir, { recursive: true, force: true });
    } catch {
        // Ignore cleanup errors - Windows often has file locks
    }
}

// ============ Test Utilities ============

/**
 * Wait for extension to be fully loaded and responsive
 */
export async function waitForExtensionReady(page: Page): Promise<void> {
    // Wait for React to hydrate
    await page.waitForLoadState('networkidle');

    // Wait for any loading spinners to disappear
    const spinner = page.locator('[data-testid="loading"], .loading, [aria-busy="true"]');
    if (await spinner.count() > 0) {
        await spinner.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
    }
}

/**
 * Navigate to extension page with proper waits
 */
export async function gotoExtensionPage(
    page: Page,
    extensionId: string,
    pageName: 'popup' | 'options' = 'popup'
): Promise<void> {
    await page.goto(`chrome-extension://${extensionId}/${pageName}.html`);
    await waitForExtensionReady(page);
}

