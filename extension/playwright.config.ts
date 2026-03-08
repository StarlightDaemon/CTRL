import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for CTRL Extension E2E Tests
 * 
 * Key stability settings:
 * - Extended timeouts for extension loading
 * - Single worker in CI to prevent resource thrashing
 * - Retries with trace capture for debugging flakes
 */
export default defineConfig({
    testDir: './tests/e2e',

    // Global timeout per test (increased for extension cold start)
    timeout: 60 * 1000,

    // Assertion timeout
    expect: {
        timeout: 15 * 1000,
    },

    // Run tests in parallel locally, sequential in CI
    fullyParallel: !process.env.CI,

    // Fail fast on .only in CI
    forbidOnly: !!process.env.CI,

    // Retry flaky tests in CI
    retries: process.env.CI ? 2 : 0,

    // CI: Single worker to prevent resource thrashing with heavy extensions
    // Local: 2 workers max for stability
    workers: process.env.CI ? 1 : 2,

    // Reporter configuration
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : [['list'], ['html', { open: 'never' }]],

    use: {
        // Action timeout for clicks, fills, etc.
        actionTimeout: 10 * 1000,

        // Navigation timeout
        navigationTimeout: 30 * 1000,

        // Capture trace on first retry for debugging
        trace: 'on-first-retry',

        // Screenshots on failure
        screenshot: 'only-on-failure',

        // Video on first retry
        video: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                // Slow down actions slightly for stability
                launchOptions: {
                    slowMo: process.env.CI ? 100 : 0,
                },
            },
        },
    ],
});

