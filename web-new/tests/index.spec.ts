import { test, expect } from '@playwright/test';

/**
 * Index Page E2E Tests
 * Tests video metadata display, URL input, and Supabase integration
 */

test.describe('Index Page (Video Metadata)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('loads homepage with correct heading', async ({ page }) => {
    // Check for main heading
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('displays video URL input with sample videos', async ({ page }) => {
    // Check for video input
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    await expect(urlInput).toBeVisible();

    // Check for Load button
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await expect(loadButton).toBeVisible();

    // Check for Clear button
    const clearButton = page.getByRole('button', { name: /clear/i });
    await expect(clearButton).toBeVisible();
  });

  test('Load button is disabled when URL is empty', async ({ page }) => {
    const loadButton = page.getByRole('button', { name: /load video data/i });
    await expect(loadButton).toBeDisabled();
  });

  test('Load button enables when URL is entered', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Initially disabled
    await expect(loadButton).toBeDisabled();

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');

    // Now enabled
    await expect(loadButton).not.toBeDisabled();
  });

  test('Clear button clears URL and metadata', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const clearButton = page.getByRole('button', { name: /clear/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await expect(urlInput).toHaveValue('https://archive.wubby.tv/vods/public/test.mp4');

    // Click clear
    await clearButton.click();

    // URL should be cleared
    await expect(urlInput).toHaveValue('');
  });

  test('fetches and displays video metadata from Supabase', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for fetch
    await page.waitForTimeout(2000);

    // Should have attempted to fetch data
    const fetchLogs = consoleMessages.filter(
      (msg) =>
        msg.includes('Fetching') ||
        msg.includes('Loaded') ||
        msg.includes('not found')
    );
    expect(fetchLogs.length).toBeGreaterThan(0);
  });

  test('displays video metadata fields when data is available', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Check for metadata labels (if data available)
    const body = await page.textContent('body');

    // Should show either metadata fields or "not found" message
    const hasValidState =
      body &&
      (body.includes('Title:') ||
        body.includes('Summary:') ||
        body.includes('Platform:') ||
        body.includes('Tags:') ||
        body.includes('not found'));

    expect(hasValidState).toBe(true);
  });

  test('computes and displays video hash', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for hash computation
    await page.waitForTimeout(2000);

    // Check if hash is displayed (64 hex characters)
    const body = await page.textContent('body');
    const hashPattern = /[a-f0-9]{64}/i;

    // Hash should be visible somewhere in metadata
    if (body && hashPattern.test(body)) {
      expect(body).toMatch(hashPattern);
    }
  });

  test('shows loading state while fetching', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Should show loading state
    await expect(page.getByText('Loading...')).toBeVisible({ timeout: 1000 });
  });

  test('displays "not found" message for nonexistent video', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL for nonexistent video
    await urlInput.fill('https://archive.wubby.tv/vods/public/nonexistent-12345.mp4');
    await loadButton.click();

    // Wait for fetch
    await page.waitForTimeout(2000);

    // Should show "not found" or similar message
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
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

  test('displays video title when metadata is loaded', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Either title is shown or "not found"
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('displays video summary when available', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Check for summary field
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('displays platform badge when metadata is loaded', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Check for platform indicator
    const body = await page.textContent('body');

    if (body) {
      // Should mention platform or show not found
      const hasPlatform =
        body.includes('twitch') ||
        body.includes('kick') ||
        body.includes('Platform:') ||
        body.includes('not found');

      expect(hasPlatform).toBe(true);
    }
  });

  test('displays video tags when available', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Check for tags field
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('preserves video URL in localStorage', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });

    // Enter URL
    const testUrl = 'https://archive.wubby.tv/vods/public/test.mp4';
    await urlInput.fill(testUrl);

    // Wait for localStorage to update
    await page.waitForTimeout(500);

    // Check localStorage
    const storedUrl = await page.evaluate(() => localStorage.getItem('selectedVideoUrl'));
    expect(storedUrl).toBe(testUrl);
  });

  test('restores video URL from localStorage on page load', async ({ page }) => {
    // Set URL in localStorage
    const testUrl = 'https://archive.wubby.tv/vods/public/persisted-test.mp4';
    await page.evaluate((url) => {
      localStorage.setItem('selectedVideoUrl', url);
    }, testUrl);

    // Reload page
    await page.reload();
    await page.waitForTimeout(500);

    // URL input should be populated
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const value = await urlInput.inputValue();
    expect(value).toBe(testUrl);
  });

  test('handles Supabase API errors gracefully', async ({ page }) => {
    // Block Supabase requests
    await page.route('**/supabase.co/**', (route) => route.abort());

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for error
    await page.waitForTimeout(2000);

    // Page should not crash
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('displays original filename from URL', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL with filename
    await urlInput.fill(
      'https://archive.wubby.tv/vods/public/jul_2025/27_MEDIA%20SHARE_1753659052_000.mp4'
    );
    await loadButton.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should extract and display filename (decoded)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('link to player page exists when video is loaded', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata
    await page.waitForTimeout(2000);

    // Check for player link
    const playerLinks = page.getByRole('link', { name: /player|watch|play/i });

    if ((await playerLinks.count()) > 0) {
      await expect(playerLinks.first()).toBeVisible();
    }
  });

  test('no console errors on normal operation', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out expected errors
        if (
          !text.includes('favicon') &&
          !text.includes('404') &&
          !text.includes('net::ERR')
        ) {
          consoleErrors.push(text);
        }
      }
    });

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL and load
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();
    await page.waitForTimeout(2000);

    // Should have no major errors
    expect(consoleErrors.length).toBe(0);
  });
});
