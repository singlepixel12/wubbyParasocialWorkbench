const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.locator('body').click();
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();