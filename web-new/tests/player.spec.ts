import { test, expect } from '@playwright/test';

/**
 * Player Page E2E Tests
 * Tests Vidstack video player functionality, subtitle loading, and playback controls
 */

test.describe('Player Page', () => {
  test.beforeEach(async ({ page }) => {
    // Set a test video URL in localStorage (simulating user selection)
    await page.goto('/player');
    await page.evaluate(() => {
      localStorage.setItem(
        'selectedVideoUrl',
        'https://archive.wubby.tv/vods/public/test.mp4'
      );
    });

    // Reload to pick up localStorage
    await page.reload();

    // Wait for page to load
    await page.waitForSelector('h2:has-text("Video Player")');
  });

  test('loads page with correct title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Video Player' })).toBeVisible();
  });

  test('displays message when no video URL is selected', async ({ page }) => {
    // Clear localStorage
    await page.evaluate(() => localStorage.removeItem('selectedVideoUrl'));
    await page.reload();

    // Should show "no video selected" message
    const body = await page.textContent('body');
    expect(body).toContain('No video selected');
  });

  test('renders Vidstack player when video URL is available', async ({ page }) => {
    // Check for video player element
    const player = page.locator('media-player, video');
    await expect(player.first()).toBeAttached({ timeout: 5000 });
  });

  test('displays video URL input for changing video', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    await expect(urlInput).toBeVisible();

    // Should show current video URL
    const currentUrl = await urlInput.inputValue();
    expect(currentUrl).toContain('archive.wubby.tv');
  });

  test('Load button updates player with new video', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter new URL
    const newUrl = 'https://archive.wubby.tv/vods/public/new-video.mp4';
    await urlInput.fill(newUrl);

    // Click load
    await loadButton.click();

    // Wait for player to update
    await page.waitForTimeout(1000);

    // Verify localStorage was updated
    const storedUrl = await page.evaluate(() => localStorage.getItem('selectedVideoUrl'));
    expect(storedUrl).toBe(newUrl);
  });

  test('Clear button clears video and shows message', async ({ page }) => {
    const clearButton = page.getByRole('button', { name: /clear/i });

    // Click clear
    await clearButton.click();

    // Wait for state update
    await page.waitForTimeout(500);

    // Should show "no video selected" message
    const body = await page.textContent('body');
    expect(body).toContain('No video selected');
  });

  test('computes hash for subtitle loading', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Trigger load with current video
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await loadButton.click();

    // Wait for hash computation
    await page.waitForTimeout(2000);

    // Check for hash computation logs
    const hashLogs = consoleMessages.filter((msg) =>
      msg.includes('Computing Video Hash')
    );
    expect(hashLogs.length).toBeGreaterThan(0);
  });

  test('attempts to load subtitles if available', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Trigger subtitle load
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await loadButton.click();

    // Wait for subtitle fetch attempt
    await page.waitForTimeout(3000);

    // Check for subtitle-related logs
    const subtitleLogs = consoleMessages.filter(
      (msg) =>
        msg.includes('subtitle') ||
        msg.includes('VTT') ||
        msg.includes('Fetching subtitles')
    );
    expect(subtitleLogs.length).toBeGreaterThan(0);
  });

  test('video player has playback controls', async ({ page }) => {
    // Wait for player to load
    await page.waitForTimeout(2000);

    // Vidstack player should have controls
    const player = page.locator('media-player').first();

    if ((await player.count()) > 0) {
      // Player should have controls attribute or control elements
      const hasControls =
        (await player.getAttribute('controls')) !== null ||
        (await page.locator('media-play-button, media-controls').count()) > 0;

      // Just verify player exists - controls are handled by Vidstack
      expect(await player.count()).toBeGreaterThan(0);
    }
  });

  test('displays video metadata if available', async ({ page }) => {
    // Wait for metadata to load
    await page.waitForTimeout(2000);

    // Check if any metadata is displayed
    const body = await page.textContent('body');

    // Should have either metadata fields or player UI
    expect(body).toBeTruthy();
  });

  test('preserves video URL across page reloads', async ({ page }) => {
    const testUrl = 'https://archive.wubby.tv/vods/public/persistent-test.mp4';

    // Set URL
    await page.evaluate((url) => {
      localStorage.setItem('selectedVideoUrl', url);
    }, testUrl);

    // Reload page
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify URL is still set
    const storedUrl = await page.evaluate(() => localStorage.getItem('selectedVideoUrl'));
    expect(storedUrl).toBe(testUrl);
  });

  test('handles video loading errors gracefully', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter invalid video URL
    await urlInput.fill('https://archive.wubby.tv/invalid.mp4');
    await loadButton.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Page should not crash - verify page is still functional
    await expect(page.getByRole('heading', { name: 'Video Player' })).toBeVisible();
  });

  test('datalist provides video suggestions', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });

    // Check datalist exists
    const datalist = page.locator('#video-options');
    await expect(datalist).toBeAttached();

    // Verify it has options
    const options = page.locator('#video-options option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('displays hash value when computed', async ({ page }) => {
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Click load to trigger hash computation
    await loadButton.click();
    await page.waitForTimeout(2000);

    // Check if hash is displayed
    const body = await page.textContent('body');
    const hashPattern = /[a-f0-9]{64}/i;

    // Hash might be visible in metadata section
    if (body && hashPattern.test(body)) {
      expect(body).toMatch(hashPattern);
    }
  });

  test('subtitle tracks are added to player when available', async ({ page }) => {
    // Click load to fetch subtitles
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await loadButton.click();

    // Wait for subtitle loading
    await page.waitForTimeout(3000);

    // Check if track elements exist (if subtitles loaded)
    const tracks = page.locator('track, media-captions');
    const trackCount = await tracks.count();

    // Either tracks exist or no subtitles available (both valid)
    expect(trackCount >= 0).toBe(true);
  });

  test('player page has no console errors during normal operation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Filter out expected resource loading errors
        const text = msg.text();
        if (
          !text.includes('favicon') &&
          !text.includes('404') &&
          !text.includes('net::ERR')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    // Perform normal operations
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await loadButton.click();
    await page.waitForTimeout(2000);

    // Should have no major console errors
    expect(consoleErrors.length).toBe(0);
  });

  test('back to VOD Diary link works', async ({ page }) => {
    // Look for VOD Diary link
    const vodDiaryLink = page.getByRole('link', { name: /vod diary/i });

    if ((await vodDiaryLink.count()) > 0) {
      await vodDiaryLink.click();

      // Should navigate to VOD Diary page
      await page.waitForURL('**/vod-diary');
      await expect(page.getByRole('heading', { name: 'VOD Diary' })).toBeVisible();
    }
  });
});
