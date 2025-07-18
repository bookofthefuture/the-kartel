const { test, expect } = require('@playwright/test');
const { loginAsTestUser, logout } = require('./auth-helpers');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Super Admin Page - Basic Tests', () => {

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should load the super admin page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page).toHaveTitle('The Kartel - Super Admin');
  });

  test('should display login container when not authenticated', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
  });

  test('should load without errors and show proper structure', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#loginSection')).toBeVisible();
    await expect(page.locator('#dashboardSection')).toHaveClass(/hidden/);
  });

  test('should show dashboard when super admin authenticated', async ({ page }) => {
    await loginAsTestUser(page, 'super-admin');
    await page.goto(`${baseURL}/super-admin.html`);
    
    await expect(page.locator('#dashboardSection')).toBeVisible();
    await expect(page.locator('#loginSection')).toHaveClass(/hidden/);
  });

});
