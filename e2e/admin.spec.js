const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Admin Page', () => {

  test('should load the admin page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await expect(page).toHaveTitle('The Kartel - Admin Dashboard');
  });

  test('should display a login form', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
    // Check for a key element within the dynamically rendered form
    await expect(page.locator('h1:has-text("Admin Access")')).toBeVisible();
  });

  test('should have a login button', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    const loginButton = page.locator('button:has-text("Admin Login")');
    await expect(loginButton).toBeVisible();
  });

});
