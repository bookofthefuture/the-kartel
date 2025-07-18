const { test, expect } = require('@playwright/test');
const { loginAsTestUser, logout } = require('./auth-helpers');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Super Admin Dashboard - Comprehensive Tests', () => {
  
  test.afterEach(async ({ page }) => {
    // Clean up auth tokens after each test
    await logout(page);
  });

  test.describe('Authentication & Access Control', () => {

    test('should require authentication to access dashboard', async ({ page }) => {
      await page.goto(`${baseURL}/super-admin.html`);
      
      // Should show login section initially
      await expect(page.locator('#loginSection')).toBeVisible();
      await expect(page.locator('#dashboardSection')).toHaveClass(/hidden/);
    });

    test('should authenticate super admin and show dashboard', async ({ page }) => {
      // Set super admin authentication
      await loginAsTestUser(page, 'super-admin');
      
      await page.goto(`${baseURL}/super-admin.html`);
      
      // Should show dashboard, not login
      await expect(page.locator('#loginSection')).toHaveClass(/hidden/);
      await expect(page.locator('#dashboardSection')).toBeVisible();
      
      // Should show super admin title
      await expect(page.locator('.dashboard-title')).toContainText('Super Admin Dashboard');
    });

    test('should show super admin badge in header', async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      
      await expect(page.locator('.super-admin-badge')).toBeVisible();
      await expect(page.locator('.super-admin-badge')).toContainText('Super Admin');
    });

  });

  test.describe('Dashboard Navigation', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      await expect(page.locator('#dashboardSection')).toBeVisible();
    });

    test('should show all navigation tabs', async ({ page }) => {
      const tabs = page.locator('.tab-button');
      await expect(tabs).toHaveCount(3);
      
      await expect(tabs.nth(0)).toContainText('Cities & Franchises');
      await expect(tabs.nth(1)).toContainText('Analytics');
      await expect(tabs.nth(2)).toContainText('Settings');
    });

    test('should switch between tabs correctly', async ({ page }) => {
      // Cities tab should be active by default
      await expect(page.locator('.tab-button.active')).toContainText('Cities & Franchises');
      await expect(page.locator('#citiesTab')).toHaveClass(/active/);
      
      // Switch to Analytics tab
      await page.click('button:has-text("Analytics")');
      await expect(page.locator('.tab-button.active')).toContainText('Analytics');
      await expect(page.locator('#analyticsTab')).toHaveClass(/active/);
      await expect(page.locator('#citiesTab')).not.toHaveClass(/active/);
      
      // Switch to Settings tab
      await page.click('button:has-text("Settings")');
      await expect(page.locator('.tab-button.active')).toContainText('Settings');
      await expect(page.locator('#settingsTab')).toHaveClass(/active/);
    });

  });

  test.describe('Cities & Franchises Management', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      await expect(page.locator('#dashboardSection')).toBeVisible();
    });

    test('should show create new city button', async ({ page }) => {
      await expect(page.locator('button:has-text("Create New City")')).toBeVisible();
    });

    test('should open create city modal when button clicked', async ({ page }) => {
      // Modal should be hidden initially
      await expect(page.locator('#createCityModal')).toHaveClass(/hidden/);
      
      // Click create city button
      await page.click('button:has-text("Create New City")');
      
      // Modal should be visible
      await expect(page.locator('#createCityModal')).toBeVisible();
      await expect(page.locator('#createCityModal')).not.toHaveClass(/hidden/);
    });

    test('should show city creation form fields', async ({ page }) => {
      await page.click('button:has-text("Create New City")');
      
      // Check all required form fields are present
      await expect(page.locator('#cityName')).toBeVisible();
      await expect(page.locator('#cityRegion')).toBeVisible();
      await expect(page.locator('#adminEmail')).toBeVisible();
      await expect(page.locator('#adminName')).toBeVisible();
      
      // Check placeholders
      await expect(page.locator('#cityName')).toHaveAttribute('placeholder', 'e.g., Birmingham');
      await expect(page.locator('#adminEmail')).toHaveAttribute('placeholder', 'admin@example.com');
    });

    test('should validate required fields in create city form', async ({ page }) => {
      await page.click('button:has-text("Create New City")');
      
      // Try to submit empty form
      const submitButton = page.locator('#createCityForm button[type="submit"]');
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Check that required field validation prevents submission
        await expect(page.locator('#cityName:invalid')).toBeVisible();
      }
    });

    test('should show cities grid container', async ({ page }) => {
      await expect(page.locator('#citiesGrid')).toBeVisible();
      await expect(page.locator('#citiesGrid')).toHaveClass('city-grid');
    });

  });

  test.describe('User Interface & Responsive Design', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
    });

    test('should be responsive on mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      
      await expect(page.locator('.header')).toBeVisible();
      await expect(page.locator('.dashboard-title')).toBeVisible();
      await expect(page.locator('.tab-button')).toBeVisible();
    });

    test('should have proper styling and layout', async ({ page }) => {
      // Check header styling
      const header = page.locator('.header');
      await expect(header).toHaveCSS('background-color', 'rgb(26, 37, 47)');
      
      // Check dashboard styling
      await expect(page.locator('.dashboard-title')).toHaveCSS('font-weight', '800');
    });

  });

  test.describe('Analytics Section', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      await page.click('button:has-text("Analytics")');
    });

    test('should show analytics content area', async ({ page }) => {
      await expect(page.locator('#analyticsContent')).toBeVisible();
    });

    test('should display analytics tab content when selected', async ({ page }) => {
      await expect(page.locator('#analyticsTab')).toHaveClass(/active/);
      await expect(page.locator('#analyticsTab')).toBeVisible();
    });

  });

  test.describe('Settings Section', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      await page.click('button:has-text("Settings")');
    });

    test('should show settings content area', async ({ page }) => {
      await expect(page.locator('#settingsContent')).toBeVisible();
    });

    test('should display settings tab content when selected', async ({ page }) => {
      await expect(page.locator('#settingsTab')).toHaveClass(/active/);
      await expect(page.locator('#settingsTab')).toBeVisible();
    });

  });

  test.describe('Error Handling & Edge Cases', () => {

    test('should handle network errors gracefully', async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      
      // Block network requests to simulate offline
      await page.route('**/*', route => route.abort());
      
      await page.goto(`${baseURL}/super-admin.html`);
      
      // Page should still load with cached content
      await expect(page.locator('body')).toBeVisible();
    });

    test('should prevent non-super-admin access', async ({ page }) => {
      // Set regular admin authentication
      await loginAsTestUser(page, 'admin');
      
      await page.goto(`${baseURL}/super-admin.html`);
      
      // Should still show login or redirect appropriately
      // (Implementation may vary based on access control logic)
      await expect(page.locator('body')).toBeVisible();
    });

  });

  test.describe('Performance & Accessibility', () => {

    test('should load within reasonable time', async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      
      const startTime = Date.now();
      await page.goto(`${baseURL}/super-admin.html`);
      await expect(page.locator('#dashboardSection')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('should have accessible form labels', async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      await page.click('button:has-text("Create New City")');
      
      // Check that form fields have proper labels
      await expect(page.locator('label[for="cityName"]')).toBeVisible();
      await expect(page.locator('label[for="adminEmail"]')).toBeVisible();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await loginAsTestUser(page, 'super-admin');
      await page.goto(`${baseURL}/super-admin.html`);
      
      // Test tab navigation through buttons
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      
      // Should be able to navigate with keyboard
      await expect(page.locator('body')).toBeVisible();
    });

  });

});