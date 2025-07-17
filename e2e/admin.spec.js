const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Admin Page', () => {

  test('should load the admin page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await expect(page).toHaveTitle('The Kartel - Admin Dashboard');
  });

  test('should display login container', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
  });

  test('should load without errors', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await expect(page.locator('body')).toBeVisible();
  });

});
