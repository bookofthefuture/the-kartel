// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Quick test configuration for faster development testing
 * Only runs on Chromium with minimal retries
 */
module.exports = defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* No retries for quick tests */
  retries: 0,
  /* Use fewer workers for quick tests */
  workers: 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Faster timeouts for quick tests */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers - only Chromium for quick tests */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});