const { test, expect } = require('@playwright/test');
const { loginAsTestUser, logout } = require('./auth-helpers');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888';

test.describe('Admin Page - Minimal Tests', () => {
  
  test('should load admin page and show login form when not authenticated', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await expect(page).toHaveTitle('The Kartel - Admin Dashboard');
    
    // Should show login form when not authenticated
    await expect(page.locator('#loginContainer')).toBeVisible();
  });

  test('should display login form structure', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for the auth system to initialize and show login form
    await expect(page.locator('#loginContainer')).toBeVisible();
    
    // Check login form elements exist within the login container
    await expect(page.locator('#loginContainer .login-card')).toBeVisible();
    await expect(page.locator('#loginContainer .login-title')).toBeVisible();
    
    // Check for authentication method tabs
    await expect(page.locator('.login-tabs')).toBeVisible();
  });

  test('should have password login as primary option for admin', async ({ page }) => {
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Check both login method tabs are present
    await expect(page.locator('.login-tab')).toHaveCount(2);
    
    // Check password form exists
    await expect(page.locator('#passwordForm')).toBeAttached();
    
    // Check magic link form exists
    await expect(page.locator('#magicLinkForm')).toBeAttached();
  });

  test('should show admin dashboard when authenticated as admin', async ({ page }) => {
    // Mock authentication before visiting page
    await loginAsTestUser(page, 'admin');
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Should show dashboard instead of login
    await expect(page.locator('#dashboardSection')).toBeVisible();
    await expect(page.locator('#loginContainer')).not.toBeVisible();
    
    // Check admin dashboard has basic structure
    await expect(page.locator('.dashboard-title')).toBeVisible();
    await expect(page.locator('.dashboard-title')).toContainText('Admin Dashboard');
    await expect(page.locator('.tab-navigation')).toBeVisible();
  });

  test('should show admin navigation tabs', async ({ page }) => {
    await loginAsTestUser(page, 'admin');
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for dashboard to be visible (indicates auth success)
    await expect(page.locator('#dashboardSection')).toBeVisible();
    
    // Check all admin tabs are present
    await expect(page.locator('.tab-button')).toHaveCount(4);
    await expect(page.getByText('👥 Applications')).toBeVisible();
    await expect(page.getByText('📅 Events')).toBeVisible();
    await expect(page.getByText('🏁 Venues')).toBeVisible();
    await expect(page.getByText('📝 Content')).toBeVisible();
    
    // Applications tab should be active by default
    await expect(page.locator('.tab-button.active')).toContainText('Applications');
  });

  test('should show applications section by default', async ({ page }) => {
    await loginAsTestUser(page, 'admin');
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for dashboard to be visible (indicates auth success)
    await expect(page.locator('#dashboardSection')).toBeVisible();
    
    // Check applications tab content is visible
    await expect(page.locator('#applicationsTab')).toBeVisible();
    
    // Check stats grid exists in applications tab
    await expect(page.locator('#applicationsTab .stats-grid')).toBeVisible();
    await expect(page.locator('#totalApplications')).toBeVisible();
    await expect(page.locator('#pendingApplications')).toBeVisible();
    
    // Check applications table exists in applications tab
    await expect(page.locator('#applicationsTab .applications-table')).toBeVisible();
  });

  test('should show admin info in header when authenticated', async ({ page }) => {
    await loginAsTestUser(page, 'admin');
    await page.goto(`${baseURL}/admin.html`);
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for dashboard to be visible (indicates auth success)
    await expect(page.locator('#dashboardSection')).toBeVisible();
    
    // Check user info appears in visible header
    await expect(page.locator('.header .user-info')).toBeVisible();
    await expect(page.locator('.header .logout-btn')).toBeVisible();
    
    // Should show admin name
    await expect(page.locator('.header .user-info')).toContainText('Test');
  });

});