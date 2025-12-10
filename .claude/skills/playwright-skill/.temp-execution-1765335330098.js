const { chromium } = require('playwright');

// SvelteKit dev server
const TARGET_URL = 'http://localhost:5173';

(async () => {
  console.log('🚀 Starting browser automation test...');

  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await browser.newPage();

  try {
    // Test homepage
    console.log(`📍 Navigating to ${TARGET_URL}`);
    await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 15000 });
    console.log('✅ Page loaded:', await page.title());

    // Take desktop screenshot
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.screenshot({ path: '/tmp/archtools-desktop.png', fullPage: true });
    console.log('📸 Desktop screenshot saved to /tmp/archtools-desktop.png');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.screenshot({ path: '/tmp/archtools-mobile.png', fullPage: true });
    console.log('📸 Mobile screenshot saved to /tmp/archtools-mobile.png');

    // Check for visible links/navigation
    const links = await page.locator('a').all();
    console.log(`🔗 Found ${links.length} links on page`);

    // Show current URL (in case of redirect)
    console.log('📍 Current URL:', page.url());

  } catch (error) {
    console.error('❌ Error:', error.message);
    // Take error screenshot
    await page.screenshot({ path: '/tmp/archtools-error.png' });
    console.log('📸 Error screenshot saved to /tmp/archtools-error.png');
  } finally {
    await browser.close();
    console.log('✅ Browser closed');
  }
})();
