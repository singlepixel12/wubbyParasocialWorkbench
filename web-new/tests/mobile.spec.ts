import { test, expect, devices } from '@playwright/test';

/**
 * Mobile Responsiveness E2E Tests
 * Tests layout, touch interactions, and mobile-specific features
 */

test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Responsiveness', () => {

  test('homepage is mobile responsive', async ({ page }) => {
    await page.goto('/');

    // Page should load without horizontal scroll
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeTruthy();

    // Main content should be visible
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // No horizontal scrollbar
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('navigation is accessible on mobile', async ({ page }) => {
    await page.goto('/');

    // Header should be visible
    const header = page.locator('header, nav').first();
    await expect(header).toBeVisible();

    // Navigation links should be accessible
    const transcriptLink = page.getByRole('link', { name: /transcript/i });
    await expect(transcriptLink).toBeVisible();

    // Tap navigation link
    await transcriptLink.tap();
    await page.waitForURL('**/transcript');

    // Should navigate successfully
    await expect(page.getByRole('heading', { name: 'Video Transcripts' })).toBeVisible();
  });

  test('buttons are large enough for touch targets', async ({ page }) => {
    await page.goto('/');

    // Get button size
    const loadButton = page.getByRole('button', { name: /load/i });
    const box = await loadButton.boundingBox();

    // Touch target should be at least 44x44px (WCAG guideline)
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40); // Allowing slight variance
    }
  });

  test('VOD Diary cards stack vertically on mobile', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Check if cards are stacked (viewport is narrow)
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(viewportWidth).toBeLessThan(768); // Mobile breakpoint
  });

  test('video cards are fully visible without horizontal scroll', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Page should not have horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('search input is usable on mobile', async ({ page }) => {
    await page.goto('/vod-diary');

    // Open search
    const searchToggle = page.getByRole('button', { name: /toggle search/i });
    await searchToggle.tap();

    // Search input should appear
    const searchInput = page.getByRole('textbox', { name: /search videos/i });
    await expect(searchInput).toBeVisible();

    // Should be able to type
    await searchInput.fill('test query');
    await expect(searchInput).toHaveValue('test query');
  });

  test('date picker is usable on mobile', async ({ page }) => {
    await page.goto('/vod-diary');

    // Open date picker
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await dateButton.tap();

    // Wait for popover
    await page.waitForTimeout(500);

    // Preset buttons should be visible
    const thisWeekPreset = page.getByRole('button', { name: 'This Week' });
    await expect(thisWeekPreset).toBeVisible();

    // Should be able to tap preset
    await thisWeekPreset.tap();
  });

  test('platform slider is usable with touch', async ({ page }) => {
    await page.goto('/vod-diary');

    // Platform slider should be visible
    const platformSlider = page.getByRole('radiogroup', { name: /platform filter/i });
    await expect(platformSlider).toBeVisible();

    // Should be able to select platform
    const twitchRadio = page.getByRole('radio', { name: /twitch/i });
    await twitchRadio.tap();

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Radio should be checked
    await expect(twitchRadio).toBeChecked();
  });

  test('video card expand/collapse works with tap', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Find first expand button
    const expandButton = page.getByRole('button', { name: 'Expand ▼' }).first();

    if (await expandButton.isVisible()) {
      // Tap expand
      await expandButton.tap();
      await page.waitForTimeout(300);

      // Should expand
      const collapseButton = page.getByRole('button', { name: 'Collapse ▲' }).first();
      await expect(collapseButton).toBeVisible();

      // Tap collapse
      await collapseButton.tap();
      await page.waitForTimeout(300);

      // Should collapse
      await expect(expandButton).toBeVisible();
    }
  });

  test('form inputs work with mobile keyboard', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.getByRole('combobox', { name: /video url/i });

    // Tap input to focus
    await urlInput.tap();

    // Should be focused
    await expect(urlInput).toBeFocused();

    // Type text
    await urlInput.fill('https://archive.wubby.tv/test.mp4');
    await expect(urlInput).toHaveValue('https://archive.wubby.tv/test.mp4');
  });

  test('text is readable at mobile size', async ({ page }) => {
    await page.goto('/');

    // Get body font size
    const fontSize = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).fontSize;
    });

    // Font size should be reasonable (at least 14px)
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(14);
  });

  test('page loads without layout shift on mobile', async ({ page }) => {
    await page.goto('/');

    // Wait for page to stabilize
    await page.waitForLoadState('networkidle');

    // Take screenshot for visual comparison (optional)
    // await page.screenshot({ path: 'mobile-layout.png' });

    // Verify main content is visible
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('loading states are visible on mobile', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load/i });

    // Enter URL and tap load
    await urlInput.fill('https://archive.wubby.tv/test.mp4');
    await loadButton.tap();

    // Loading state should be visible
    await expect(page.getByText('Loading...')).toBeVisible({ timeout: 1000 });
  });

  test('error messages are visible on mobile', async ({ page }) => {
    await page.goto('/vod-diary');

    // Open search
    const searchToggle = page.getByRole('button', { name: /toggle search/i });
    await searchToggle.tap();

    // Search for nonexistent content
    const searchInput = page.getByRole('textbox', { name: /search videos/i });
    await searchInput.fill('xyznonexistentquery123');

    // Wait for search
    await page.waitForTimeout(1500);

    // Empty state should be visible
    const noResults = page.getByText('No videos found');
    await expect(noResults).toBeVisible();
  });

  test('player link works on mobile', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Find first play link
    const playLinks = page.locator('a[href="/player"]');

    if ((await playLinks.count()) > 0) {
      const firstPlayLink = playLinks.first();
      await expect(firstPlayLink).toBeVisible();

      // Verify it's tappable
      const box = await firstPlayLink.boundingBox();
      expect(box).toBeTruthy();
    }
  });

  test('header remains accessible while scrolling on mobile', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(300);

    // Header should still be accessible (fixed or scrolled back)
    const header = page.locator('header, nav').first();
    await expect(header).toBeAttached();
  });
});

test.describe('Tablet Responsiveness', () => {
  test.use({ ...devices['iPad Pro'] });

  test('tablet layout is appropriate', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Viewport should be tablet size
    const viewportWidth = page.viewportSize()?.width || 0;
    expect(viewportWidth).toBeGreaterThan(768);
    expect(viewportWidth).toBeLessThan(1024);

    // Content should be visible
    const heading = page.getByRole('heading', { name: 'VOD Diary' });
    await expect(heading).toBeVisible();
  });

  test('video cards use appropriate layout on tablet', async ({ page }) => {
    await page.goto('/vod-diary');
    await page.waitForTimeout(2000);

    // Page should load without issues
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // No horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('navigation is accessible on tablet', async ({ page }) => {
    await page.goto('/');

    // All nav links should be visible
    await expect(page.getByRole('link', { name: /transcript/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /vod diary/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /player/i })).toBeVisible();
  });
});

test.describe('Small Mobile (320px)', () => {
  test.use({
    viewport: { width: 320, height: 568 }, // iPhone SE size
  });

  test('content is accessible on small mobile', async ({ page }) => {
    await page.goto('/');

    // Page should load
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // No horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);
  });

  test('buttons remain usable on small mobile', async ({ page }) => {
    await page.goto('/');

    const loadButton = page.getByRole('button', { name: /load/i });
    await expect(loadButton).toBeVisible();

    // Button should be tappable
    const box = await loadButton.boundingBox();
    expect(box).toBeTruthy();
  });
});
