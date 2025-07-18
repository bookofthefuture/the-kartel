const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888';

test.describe('Public Page - Minimal Tests', () => {
  
  test('should load homepage successfully', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page).toHaveTitle('The Kartel - Where Business Meets the Track');
  });

  test('should display basic page structure', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Check that the page has a body
    await expect(page.locator('body')).toBeVisible();
    
    // Check that main content is present
    await expect(page.locator('main, .main, #main')).toBeVisible();
  });

  test('should have contact form', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Check that a form exists on the page
    await expect(page.locator('form')).toBeVisible();
    
    // Check that basic form inputs exist
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="text"], input[name="name"]')).toBeVisible();
  });

});