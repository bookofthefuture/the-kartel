const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Members Page', () => {

  test('should load the members page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await expect(page).toHaveTitle('The Kartel - Members Area');
  });

  test('should display login container', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
  });

  test('should load without errors', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await expect(page.locator('body')).toBeVisible();
  });

});
