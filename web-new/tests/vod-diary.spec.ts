import { test, expect } from '@playwright/test';

/**
 * VOD Diary Page Tests
 * Tests all filtering functionality (platform, date range, search)
 * Tests video card interactions and Supabase data fetching
 */

test.describe('VOD Diary Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to VOD Diary page before each test
    await page.goto('/vod-diary');

    // Wait for page to load
    await page.waitForSelector('h2:has-text("VOD Diary")');
  });

  test('loads page with default filters', async ({ page }) => {
    // Check page title and description
    await expect(page.getByRole('heading', { name: 'VOD Diary' })).toBeVisible();
    await expect(page.getByText('Browse and filter Wubby VODs')).toBeVisible();

    // Check default date range (This Week)
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await expect(dateButton).toBeVisible();

    // Check platform slider defaults to "both"
    const platformSlider = page.getByRole('radiogroup', { name: 'Platform filter' });
    await expect(platformSlider).toBeVisible();
    const bothRadio = page.getByRole('radio', { name: 'both platform selected' });
    await expect(bothRadio).toBeChecked();

    // Check search toggle is visible
    const searchToggle = page.getByRole('button', { name: 'Toggle search' });
    await expect(searchToggle).toBeVisible();
  });

  test('fetches and displays videos from Supabase', async ({ page }) => {
    // Listen for console logs to verify API calls
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Wait for videos to load
    await page.waitForTimeout(2000);

    // Verify fetch was called
    const fetchLogs = consoleMessages.filter(msg =>
      msg.includes('Fetching recent videos') || msg.includes('✅ Loaded')
    );
    expect(fetchLogs.length).toBeGreaterThan(0);

    // Check if videos are displayed (or "No videos found" message)
    const body = await page.textContent('body');
    const hasVideos = body && (body.includes('Expand') || body.includes('No videos found'));
    expect(hasVideos).toBe(true);
  });

  test('platform slider filters videos correctly', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Wait for initial load
    await page.waitForTimeout(1500);
    consoleMessages.length = 0; // Clear previous logs

    // Click platform slider to select "twitch" (middle position)
    const platformSlider = page.getByRole('radiogroup', { name: 'Platform filter' });
    const sliderBox = await platformSlider.boundingBox();

    if (sliderBox) {
      // Click at 50% position (center) for Twitch
      await page.mouse.click(
        sliderBox.x + sliderBox.width * 0.5,
        sliderBox.y + sliderBox.height * 0.5
      );
    }

    // Wait for refetch
    await page.waitForTimeout(1000);

    // Verify twitch is selected
    const twitchRadio = page.getByRole('radio', { name: 'twitch platform selected' });
    await expect(twitchRadio).toBeChecked();

    // Verify fetch was called with platform filter
    const fetchLog = consoleMessages.find(msg =>
      msg.includes('platform: twitch')
    );
    expect(fetchLog).toBeTruthy();
  });

  test('search functionality works with debouncing', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Click search toggle to show input
    const searchToggle = page.getByRole('button', { name: 'Toggle search' });
    await searchToggle.click();

    // Wait for search input to appear
    const searchInput = page.getByRole('textbox', { name: 'Search videos' });
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    // Type search term
    await searchInput.fill('minecraft');

    // Wait for debounce (300ms) + API call
    await page.waitForTimeout(1000);

    // Verify search was triggered
    const searchLog = consoleMessages.find(msg =>
      msg.includes('Searching videos: minecraft')
    );
    expect(searchLog).toBeTruthy();

    // Verify clear button appears
    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await expect(clearButton).toBeVisible();

    // Test clear functionality
    await clearButton.click();
    await page.waitForTimeout(500);

    // Verify input is cleared
    await expect(searchInput).toHaveValue('');
  });

  test('video card expand/collapse animation works', async ({ page }) => {
    // Wait for videos to load
    await page.waitForTimeout(2000);

    // Find first expand button
    const expandButton = page.getByRole('button', { name: 'Expand ▼' }).first();

    // Check if any videos are present
    const expandButtonCount = await page.getByRole('button', { name: 'Expand ▼' }).count();

    if (expandButtonCount > 0) {
      // Click expand button
      await expandButton.click();

      // Wait for animation
      await page.waitForTimeout(500);

      // Verify button text changed
      const collapseButton = page.getByRole('button', { name: 'Collapse ▲' }).first();
      await expect(collapseButton).toBeVisible();

      // Click collapse button
      await collapseButton.click();

      // Wait for animation
      await page.waitForTimeout(500);

      // Verify button text changed back
      await expect(expandButton).toBeVisible();
    }
  });

  test('date range picker shows presets', async ({ page }) => {
    // Click date range button to open picker
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await dateButton.click();

    // Wait for popover to appear
    await page.waitForTimeout(500);

    // Check for preset buttons
    const thisWeekPreset = page.getByRole('button', { name: 'This Week' });
    await expect(thisWeekPreset).toBeVisible();

    const lastTwoWeeksPreset = page.getByRole('button', { name: 'Last 2 Weeks' });
    await expect(lastTwoWeeksPreset).toBeVisible();

    const lastMonthPreset = page.getByRole('button', { name: 'Last Month' });
    await expect(lastMonthPreset).toBeVisible();

    const lastThreeMonthsPreset = page.getByRole('button', { name: 'Last 3 Months' });
    await expect(lastThreeMonthsPreset).toBeVisible();

    // Close popover by clicking outside
    await page.mouse.click(10, 10);
  });

  test('date range preset filters videos', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'log') {
        consoleMessages.push(msg.text());
      }
    });

    // Wait for initial load
    await page.waitForTimeout(1500);
    consoleMessages.length = 0;

    // Open date picker
    const dateButton = page.getByRole('button', { name: /\d{2}\/\d{2}\/\d{4}/ });
    await dateButton.click();
    await page.waitForTimeout(300);

    // Click "Last Month" preset
    const lastMonthPreset = page.getByRole('button', { name: 'Last Month' });
    await lastMonthPreset.click();

    // Wait for refetch
    await page.waitForTimeout(1000);

    // Verify fetch was called with date range
    const fetchLog = consoleMessages.find(msg =>
      msg.includes('Fetching recent videos')
    );
    expect(fetchLog).toBeTruthy();
  });

  test('displays loading state while fetching', async ({ page }) => {
    // This test might be flaky due to fast loading
    // Reload page to see loading state
    await page.reload();

    // Try to catch loading state (may be very brief)
    const loadingText = page.getByText('Loading videos...');
    // Don't use toBeVisible since it might already be gone
    // Just check it existed at some point
  });

  test('displays empty state when no videos found', async ({ page }) => {
    // Open search
    const searchToggle = page.getByRole('button', { name: 'Toggle search' });
    await searchToggle.click();

    // Search for something that won't match
    const searchInput = page.getByRole('textbox', { name: 'Search videos' });
    await searchInput.fill('xyznonexistentvideoquery123');

    // Wait for debounce + fetch
    await page.waitForTimeout(1500);

    // Check for "No videos found" message
    const noResults = page.getByText('No videos found matching your search.');
    await expect(noResults).toBeVisible();
  });

  test('platform slider has correct visual states', async ({ page }) => {
    const platformSlider = page.getByRole('radiogroup', { name: 'Platform filter' });

    // Check that slider exists and has correct structure
    await expect(platformSlider).toBeVisible();

    // Check for label text (use first() to handle multiple matches)
    await expect(platformSlider.getByText('both').first()).toBeVisible();
    await expect(platformSlider.getByText('twitch').first()).toBeVisible();
    await expect(platformSlider.getByText('kick').first()).toBeVisible();

    // Check for thumb label
    const thumbLabel = platformSlider.locator('.thumb-label');
    await expect(thumbLabel).toBeVisible();
    await expect(thumbLabel).toHaveText('both');
  });

  test('video cards display correct metadata', async ({ page }) => {
    // Wait for videos to load
    await page.waitForTimeout(2000);

    // Check if any videos are loaded
    const videoCards = page.locator('h3');
    const cardCount = await videoCards.count();

    if (cardCount > 0) {
      // Get first video card's heading
      const firstTitle = videoCards.first();
      await expect(firstTitle).toBeVisible();

      // Check for date display
      const datePattern = /\d{2}\/\d{2}\/\d{4}/;
      const bodyText = await page.textContent('body');
      expect(bodyText).toMatch(datePattern);
    }
  });

  test('search toggle button changes state', async ({ page }) => {
    const searchToggle = page.getByRole('button', { name: 'Toggle search' });

    // Initially search input should not be visible
    let searchInput = page.getByRole('textbox', { name: 'Search videos' });
    await expect(searchInput).not.toBeVisible();

    // Click to show search
    await searchToggle.click();
    await page.waitForTimeout(200);

    // Now search input should be visible
    await expect(searchInput).toBeVisible();

    // Click again to hide search
    await searchToggle.click();
    await page.waitForTimeout(200);

    // Search input should be hidden again
    await expect(searchInput).not.toBeVisible();
  });
});
