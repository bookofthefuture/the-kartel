const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Members Page', () => {

  test('should load the members page and display the correct title', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    await expect(page).toHaveTitle('The Kartel - Members Area');
  });

  test('should display a login form', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    // The login form is rendered dynamically, so we look for a container.
    const loginContainer = page.locator('#loginContainer');
    await expect(loginContainer).toBeVisible();
    // Check for a key element within the dynamically rendered form
    await expect(page.locator('h1:has-text("The Kartel Members")')).toBeVisible();
  });

  test('should have a button to request a login link', async ({ page }) => {
    await page.goto(`${baseURL}/members.html`);
    const loginButton = page.locator('button:has-text("Request Login Link")');
    await expect(loginButton).toBeVisible();
  });

});
