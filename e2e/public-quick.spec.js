const { test, expect } = require('@playwright/test');

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8888';

test.describe('Public Page - Quick Tests', () => {
  
  test('should load homepage successfully', async ({ page }) => {
    await page.goto(baseURL);
    await expect(page).toHaveTitle('The Kartel - Where Business Meets the Track');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should display navigation and hero section', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Check navigation
    await expect(page.locator('.hero-nav')).toBeVisible();
    
    // Check hero section
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.hero')).toContainText('The Kartel');
  });

  test('should have working contact form', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Scroll to contact form
    await page.locator('#contact').scrollIntoViewIfNeeded();
    
    // Check form elements exist
    await expect(page.locator('#contact form')).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="company"]')).toBeVisible();
    
    // Test form validation
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1000);
    
    // Should show validation errors for required fields
    const nameField = page.locator('input[name="name"]');
    await expect(nameField).toHaveAttribute('required');
  });

  test('should display video section', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Check video section exists
    await expect(page.locator('.video-section')).toBeVisible();
    
    // Check for iframe (Vimeo embed)
    const iframe = page.locator('iframe[src*="vimeo"]');
    await expect(iframe).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Test navigation to different sections
    await page.locator('a[href="#about"]').click();
    await page.waitForTimeout(1000);
    
    await page.locator('a[href="#contact"]').click();
    await page.waitForTimeout(1000);
    
    // Check that contact section is visible
    await expect(page.locator('#contact')).toBeVisible();
  });

  test('should display FAQ section with accordion', async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
    
    // Check FAQ section
    await expect(page.locator('.faq-section')).toBeVisible();
    
    // Find and click first FAQ item
    const firstFaqItem = page.locator('.faq-item').first();
    await expect(firstFaqItem).toBeVisible();
    
    const firstFaqQuestion = firstFaqItem.locator('.faq-question');
    await firstFaqQuestion.click();
    await page.waitForTimeout(500);
    
    // Check if answer is visible after clicking
    const firstFaqAnswer = firstFaqItem.locator('.faq-answer');
    await expect(firstFaqAnswer).toBeVisible();
  });

});