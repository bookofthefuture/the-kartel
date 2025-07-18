const { test, expect } = require('@playwright/test');
const { loginAsTestUser, logout } = require('./auth-helpers');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888';

test.describe('Members Page - Minimal Tests', () => {
  
  test('should load members page and show login form when not authenticated', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await expect(page).toHaveTitle('The Kartel - Members Area');
    
    // Should show login form when not authenticated
    await expect(page.locator('#loginContainer')).toBeVisible();
  });

  test('should display login form structure', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the auth system to initialize and show login form
    await expect(page.locator('#loginContainer')).toBeVisible();
    
    // Check login form elements exist within the login container
    await expect(page.locator('#loginContainer .login-card')).toBeVisible();
    await expect(page.locator('#loginContainer .login-title')).toBeVisible();
    
    // Check for authentication method tabs
    await expect(page.locator('.login-tabs')).toBeVisible();
  });

  test('should have magic link and password login options', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Check both login method tabs are present
    await expect(page.locator('.login-tab')).toHaveCount(2);
    
    // Check magic link form is visible by default
    await expect(page.locator('#magicLinkForm')).toBeVisible();
    
    // Check password form exists (may be hidden)
    await expect(page.locator('#passwordForm')).toBeAttached();
  });

  test('should show dashboard when authenticated as member', async ({ page }) => {
    // Mock authentication before visiting page
    await loginAsTestUser(page, 'member');
    await page.goto(`${baseURL}/members.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Should show dashboard instead of login
    await expect(page.locator('#dashboardSection')).toBeVisible();
    await expect(page.locator('#loginContainer')).not.toBeVisible();
    
    // Check dashboard has basic structure
    await expect(page.locator('.dashboard-title')).toBeVisible();
    await expect(page.locator('.tab-navigation')).toBeVisible();
  });

  test('should show member info in header when authenticated', async ({ page }) => {
    await loginAsTestUser(page, 'member');
    await page.goto(`${baseURL}/members.html`, { timeout: 60000 });
    await page.waitForLoadState('domcontentloaded');
    
    // Check user info appears in header (scope to visible header to avoid multiple matches)
    await expect(page.locator('.header .user-info')).toBeVisible();
    await expect(page.locator('.header .logout-btn')).toBeVisible();
    
    // Should show member name (just check for "Test" since that's what appears)
    await expect(page.locator('.header .user-info')).toContainText('Test');
  });

});