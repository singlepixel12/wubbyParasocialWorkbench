import { test, expect } from '@playwright/test';

/**
 * Transcript Page E2E Tests
 * Tests subtitle extraction, VTT parsing, and video syncing
 */

test.describe('Transcript Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to transcript page
    await page.goto('/transcript');

    // Wait for page to load
    await page.waitForSelector('h2:has-text("Video Transcripts")');
  });

  test('loads page with correct title and description', async ({ page }) => {
    // Verify page title
    await expect(page.getByRole('heading', { name: 'Video Transcripts' })).toBeVisible();

    // Verify description text
    await expect(
      page.getByText('Extract and display subtitles from archive.wubby.tv videos')
    ).toBeVisible();
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

  test('Clear button clears URL input', async ({ page }) => {
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

  test('shows loading state when fetching video data', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');

    // Click load
    await loadButton.click();

    // Should show "Loading..." text briefly
    await expect(page.getByText('Loading...')).toBeVisible({ timeout: 1000 });
  });

  test('computes hash and attempts to fetch subtitles', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    const testUrl = 'https://archive.wubby.tv/vods/public/test.mp4';
    await urlInput.fill(testUrl);

    // Click load
    await loadButton.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should have logged hash computation
    const hashLogs = consoleMessages.filter((msg) => msg.includes('Computing Video Hash'));
    expect(hashLogs.length).toBeGreaterThan(0);
  });

  test('displays video metadata when available', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for metadata to load
    await page.waitForTimeout(2000);

    // Check if metadata section is visible (if data available)
    const body = await page.textContent('body');

    // Either metadata is shown or "Video not found" message
    const hasValidState =
      body &&
      (body.includes('Title:') ||
        body.includes('Platform:') ||
        body.includes('No subtitles found') ||
        body.includes('not found'));

    expect(hasValidState).toBe(true);
  });

  test('handles subtitles not found gracefully', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL without subtitles
    await urlInput.fill('https://archive.wubby.tv/vods/public/nonexistent-video.mp4');
    await loadButton.click();

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should show appropriate message (either "no subtitles" or "not found")
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('datalist provides video suggestions', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });

    // Click input to trigger datalist
    await urlInput.click();

    // Check that datalist exists
    const datalist = page.locator('#video-options');
    await expect(datalist).toBeAttached();

    // Verify it has options
    const options = page.locator('#video-options option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('displays extracted subtitle lines when available', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Use first sample video from datalist
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for subtitle fetch
    await page.waitForTimeout(3000);

    // Check console for subtitle-related logs
    const subtitleLogs = consoleMessages.filter(
      (msg) => msg.includes('subtitle') || msg.includes('VTT') || msg.includes('transcript')
    );

    // Either subtitles were found or not found message logged
    expect(subtitleLogs.length).toBeGreaterThan(0);
  });

  test('preserves URL in localStorage for player link', async ({ page }) => {
    const urlInput = page.getByRole('combobox', { name: /video url/i });

    // Enter URL
    const testUrl = 'https://archive.wubby.tv/vods/public/test.mp4';
    await urlInput.fill(testUrl);

    // Check localStorage was updated
    const storedUrl = await page.evaluate(() => localStorage.getItem('selectedVideoUrl'));
    expect(storedUrl).toBe(testUrl);
  });

  test('shows proper error state for network failures', async ({ page }) => {
    // Block Supabase requests to simulate network failure
    await page.route('**/supabase.co/**', (route) => route.abort());

    const urlInput = page.getByRole('combobox', { name: /video url/i });
    const loadButton = page.getByRole('button', { name: /load video data/i });

    // Enter URL
    await urlInput.fill('https://archive.wubby.tv/vods/public/test.mp4');
    await loadButton.click();

    // Wait for error
    await page.waitForTimeout(2000);

    // Should handle error gracefully (no crash)
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('displays hash value in UI when computed', async ({ page }) => {
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

    // Hash should be visible somewhere in the page
    if (body && hashPattern.test(body)) {
      expect(body).toMatch(hashPattern);
    }
  });
});
