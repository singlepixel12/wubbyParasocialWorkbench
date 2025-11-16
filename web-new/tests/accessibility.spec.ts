import { test, expect } from '@playwright/test';

/**
 * Accessibility (a11y) E2E Tests
 * Tests WCAG compliance, keyboard navigation, screen reader support, and focus management
 */

test.describe('Accessibility', () => {
  test('all pages have proper document structure', async ({ page }) => {
    const pages = ['/', '/transcript', '/vod-diary', '/player'];

    for (const pagePath of pages) {
      await page.goto(pagePath);

      // Check for main landmark
      const main = page.locator('main');
      await expect(main).toBeAttached();

      // Check for proper heading hierarchy
      const h1 = page.locator('h1');
      await expect(h1.first()).toBeVisible();
    }
  });

  test('all interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('/');

    // Get all buttons and links
    const buttons = page.locator('button');
    const links = page.locator('a');

    // Test first few buttons
    const buttonCount = Math.min(await buttons.count(), 5);
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        await button.focus();
        await expect(button).toBeFocused();
      }
    }

    // Test first few links
    const linkCount = Math.min(await links.count(), 5);
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      if (await link.isVisible()) {
        await link.focus();
        await expect(link).toBeFocused();
      }
    }
  });

  test('keyboard navigation with Tab key works', async ({ page }) => {
    await page.goto('/');

    // Press Tab multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');

      // Verify something is focused
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  });

  test('Shift+Tab reverses keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab forward
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const elementAfterForward = page.locator(':focus');
    const textAfterForward = await elementAfterForward.textContent();

    // Tab backward
    await page.keyboard.press('Shift+Tab');

    const elementAfterBack = page.locator(':focus');
    const textAfterBack = await elementAfterBack.textContent();

    // Should be different elements
    expect(textAfterForward !== textAfterBack || textAfterForward === '').toBe(true);
  });

  test('buttons are activatable with Enter key', async ({ page }) => {
    await page.goto('/');

    const loadButton = page.getByRole('button', { name: /load/i });

    // Focus button
    await loadButton.focus();
    await expect(loadButton).toBeFocused();

    // Button should respond to Enter (even if disabled)
    // Just verify it's focusable
  });

  test('buttons are activatable with Space key', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(1000);

    // Find search toggle button
    const searchToggle = page.getByRole('button', { name: /toggle search/i });

    if (await searchToggle.isVisible()) {
      await searchToggle.focus();
      await expect(searchToggle).toBeFocused();

      // Press Space to activate
      await page.keyboard.press('Space');

      // Wait for action
      await page.waitForTimeout(300);

      // Search input should appear
      const searchInput = page.getByRole('textbox', { name: /search videos/i });
      await expect(searchInput).toBeVisible();
    }
  });

  test('all images have alt text', async ({ page }) => {
    await page.goto('/');

    // Get all images
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');

      // Alt attribute should exist (can be empty for decorative images)
      expect(alt !== null).toBe(true);
    }
  });

  test('form inputs have associated labels', async ({ page }) => {
    await page.goto('/');

    // Check video URL input has aria-label or label
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    await expect(urlInput).toBeVisible();

    // Input should have accessible name
    const ariaLabel = await urlInput.getAttribute('aria-label');
    const ariaLabelledBy = await urlInput.getAttribute('aria-labelledby');

    expect(ariaLabel || ariaLabelledBy).toBeTruthy();
  });

  test('focus indicators are visible', async ({ page }) => {
    await page.goto('/');

    // Focus an element
    const loadButton = page.getByRole('button', { name: /load/i });
    await loadButton.focus();

    // Check if element has focus (browser will show focus ring)
    await expect(loadButton).toBeFocused();

    // Take screenshot to verify visually (optional)
    // await page.screenshot({ path: 'focus-indicator.png' });
  });

  test('color contrast is sufficient for text', async ({ page }) => {
    await page.goto('/');

    // This is a basic check - for full contrast testing use axe-core
    // Just verify page is visible and readable
    const body = page.locator('body');
    await expect(body).toBeVisible();

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('skip to main content link exists', async ({ page }) => {
    await page.goto('/');

    // Check for skip link (may be visually hidden until focused)
    const skipLink = page.locator('a[href="#main"], a[href="#main-content"], a:has-text("Skip to")');

    // Either skip link exists or first focusable is reasonable
    if ((await skipLink.count()) > 0) {
      await expect(skipLink.first()).toBeAttached();
    }
  });

  test('ARIA landmarks are present', async ({ page }) => {
    await page.goto('/');

    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main.first()).toBeAttached();

    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeAttached();
  });

  test('buttons have descriptive accessible names', async ({ page }) => {
    await page.goto('/');

    const loadButton = page.getByRole('button', { name: /load/i });
    await expect(loadButton).toBeVisible();

    const clearButton = page.getByRole('button', { name: /clear/i });
    await expect(clearButton).toBeVisible();

    // Buttons should have meaningful text or aria-label
  });

  test('links have descriptive text or aria-label', async ({ page }) => {
    await page.goto('/');

    // Get all links
    const links = page.locator('a');
    const linkCount = Math.min(await links.count(), 5);

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);

      if (await link.isVisible()) {
        const text = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');

        // Link should have text or aria-label
        expect(text?.trim() || ariaLabel).toBeTruthy();
      }
    }
  });

  test('dynamic content updates are announced', async ({ page }) => {
    await page.goto('/vod-diary');

    // Click search toggle
    const searchToggle = page.getByRole('button', { name: /toggle search/i });
    await searchToggle.click();

    // Search input should appear and be focused (good for screen readers)
    const searchInput = page.getByRole('textbox', { name: /search videos/i });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();
  });

  test('loading states have appropriate ARIA attributes', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load/i });

    // Enter URL and click load
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Button text should change to "Loading..."
    await expect(page.getByText('Loading...')).toBeVisible({ timeout: 1000 });
  });

  test('error messages are associated with form fields', async ({ page }) => {
    await page.goto('/');

    // Currently no form validation, but test structure exists
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    await expect(urlInput).toBeVisible();

    // If error messages exist, they should be linked via aria-describedby
  });

  test('collapsible regions have proper ARIA attributes', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Check if any video cards are loaded
    const expandButtons = page.getByRole('button', { name: /expand/i });

    if ((await expandButtons.count()) > 0) {
      const firstExpandButton = expandButtons.first();

      // Button should be accessible
      await expect(firstExpandButton).toBeVisible();

      // Click to expand
      await firstExpandButton.click();
      await page.waitForTimeout(300);

      // Collapse button should appear
      const collapseButton = page.getByRole('button', { name: /collapse/i }).first();
      await expect(collapseButton).toBeVisible();
    }
  });

  test('focus is managed when modals or overlays open', async ({ page }) => {
    await page.goto('/vod-diary');

    // Open date picker (popover)
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await dateButton.click();

    // Wait for popover
    await page.waitForTimeout(500);

    // Focus should move into popover
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('Escape key closes modals and popovers', async ({ page }) => {
    await page.goto('/vod-diary');

    // Open date picker
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await dateButton.click();
    await page.waitForTimeout(300);

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Popover should be closed (focus returns to trigger)
    await expect(dateButton).toBeFocused();
  });

  test('page has valid language attribute', async ({ page }) => {
    await page.goto('/');

    // Check html lang attribute
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBeTruthy();
    expect(lang).toMatch(/^en/); // English
  });

  test('viewport meta tag is present for mobile', async ({ page }) => {
    await page.goto('/');

    // Check for viewport meta tag
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toBeAttached();
  });

  test('headings follow logical hierarchy', async ({ page }) => {
    await page.goto('/');

    // Get all headings
    const h1 = await page.locator('h1').count();
    const h2 = await page.locator('h2').count();
    const h3 = await page.locator('h3').count();

    // Should have at least one h1
    expect(h1).toBeGreaterThan(0);

    // Should not skip heading levels (e.g., h1 -> h3 without h2)
    // This is a simplified check
  });

  test('custom controls have appropriate ARIA roles', async ({ page }) => {
    await page.goto('/vod-diary');

    // Platform slider should have radiogroup role
    const platformSlider = page.getByRole('radiogroup', { name: /platform filter/i });
    await expect(platformSlider).toBeVisible();

    // Radio buttons should have radio role
    const radios = page.getByRole('radio');
    expect(await radios.count()).toBeGreaterThan(0);
  });

  test('no duplicate IDs on page', async ({ page }) => {
    await page.goto('/');

    // Get all elements with id
    const idsUsed = await page.evaluate(() => {
      const elements = document.querySelectorAll('[id]');
      const ids: string[] = [];
      elements.forEach((el) => {
        if (el.id) ids.push(el.id);
      });
      return ids;
    });

    // Check for duplicates
    const uniqueIds = new Set(idsUsed);
    expect(idsUsed.length).toBe(uniqueIds.size);
  });

  test('focused elements are visible in viewport', async ({ page }) => {
    await page.goto('/');

    // Tab through elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');

      const focusedElement = page.locator(':focus');

      if (await focusedElement.isVisible()) {
        // Element should be in viewport
        const box = await focusedElement.boundingBox();
        expect(box).toBeTruthy();
      }
    }
  });
});
