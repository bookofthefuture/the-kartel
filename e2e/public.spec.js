const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';

test.describe('Public Page', () => {

  test('should load the home page and display the correct title', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page).toHaveTitle('The Kartel - Where Business Meets the Track');
  });

  test('should have a members area link', async ({ page }) => {
    await page.goto(baseURL);
    const membersLink = page.locator('a:has-text("Members Area")');
    await expect(membersLink).toBeVisible();
    await expect(membersLink).toHaveAttribute('href', 'members.html');
  });

  test('should have a contact form', async ({ page }) => {
    await page.goto(baseURL);
    const contactForm = page.locator('#contactForm');
    await expect(contactForm).toBeVisible();
  });

});
