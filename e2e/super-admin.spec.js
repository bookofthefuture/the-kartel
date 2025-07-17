const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Super Admin Page', () => {

  test('should load the super admin page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page).toHaveTitle('The Kartel - Super Admin');
  });

  test('should display login container', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
  });

  test('should load without errors', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page.locator('body')).toBeVisible();
  });

});
