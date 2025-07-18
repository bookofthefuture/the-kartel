const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Public Page', () => {

  test('should load the home page and display the correct title', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page).toHaveTitle('The Kartel - Where Business Meets the Track');
  });

  test('should load without errors', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have navigation elements', async ({ page }) => {
    await page.goto(baseURL);
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Check for basic navigation structure (hero navigation)
    await expect(page.locator('.hero-nav')).toBeVisible();
  });

});
