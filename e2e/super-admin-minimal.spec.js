const { test, expect } = require('@playwright/test');
const { loginAsTestUser, logout } = require('./auth-helpers');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Super Admin - Minimal Tests', () => {
  
  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test('should load super admin page with correct title', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page).toHaveTitle('The Kartel - Super Admin');
  });

  test('should show login container by default', async ({ page }) => {
    await page.goto(`${baseURL}/super-admin.html`);
    await expect(page.locator('#loginContainer')).toBeVisible();
    await expect(page.locator('#dashboardSection')).toHaveClass(/hidden/);
  });

  test('should authenticate super admin and show dashboard', async ({ page }) => {
    await loginAsTestUser(page, 'super-admin');
    await page.goto(`${baseURL}/super-admin.html`);
    
    await expect(page.locator('#dashboardSection')).toBeVisible();
    await expect(page.locator('.dashboard-title')).toContainText('Super Admin Dashboard');
  });

  test('should show navigation tabs when authenticated', async ({ page }) => {
    await loginAsTestUser(page, 'super-admin');
    await page.goto(`${baseURL}/super-admin.html`);
    
    await expect(page.locator('button:has-text("Cities & Franchises")')).toBeVisible();
    await expect(page.locator('button:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('button:has-text("Settings")')).toBeVisible();
  });

  test('should open create city modal', async ({ page }) => {
    await loginAsTestUser(page, 'super-admin');
    await page.goto(`${baseURL}/super-admin.html`);
    
    await page.click('button:has-text("Create New City")');
    await expect(page.locator('#createCityModal')).toBeVisible();
  });

});