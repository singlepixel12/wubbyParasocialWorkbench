import { test, expect } from '@playwright/test';

/**
 * Smoke tests - Basic health checks for the application
 * These tests ensure the app is running and pages load correctly
 */

test.describe('Application Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Check that the page loaded
    await expect(page).toHaveTitle(/Next/);

    // Verify the page contains expected content
    await expect(page.locator('h1')).toBeVisible();
  });

  test('homepage has no console errors', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to homepage
    await page.goto('/');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Check that there are no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('homepage has accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Check for basic semantic HTML structure
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
  });
});
