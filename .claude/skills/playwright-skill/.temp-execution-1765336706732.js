const { chromium } = require('playwright');

const TARGET_URL = 'http://localhost:5173';
const DGR_TOKEN = '3khDbQr3-1JLDdIBpkcYZ7SGiPS2c4QLZ1k0p0x7F4I';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      logs.push(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  // Capture network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      logs.push(`[HTTP ${response.status()}] ${response.url().substring(0, 80)}`);
    }
  });

  try {
    // Step 1: Navigate to DGR write page
    console.log('📍 Step 1: Navigate to DGR write page');
    await page.goto(`${TARGET_URL}/dgr/write/${DGR_TOKEN}`, { waitUntil: 'networkidle', timeout: 20000 });
    console.log('✅ Page loaded:', page.url());

    // Wait for page to be ready
    await page.waitForTimeout(1000);

    // Step 2: Check what's on the page
    console.log('\n📍 Step 2: Analyze page content');
    const pageTitle = await page.title();
    console.log('   Page title:', pageTitle || '(no title)');

    // Look for contributor name
    const contributorName = await page.locator('text=Donna Brennan').first().isVisible().catch(() => false);
    if (contributorName) {
      console.log('✅ Contributor identified on page');
    }

    // Check for date selector
    const dateSelector = await page.locator('[data-testid="date-selector"], .date-picker, select, button:has-text("Select")').first().isVisible().catch(() => false);
    console.log('   Date selector visible:', dateSelector);

    // Step 3: Look for available dates
    console.log('\n📍 Step 3: Check for available dates');
    const dateButtons = await page.locator('button').filter({ hasText: /\d{1,2}/ }).count();
    console.log('   Date buttons found:', dateButtons);

    // Take screenshot of initial state
    await page.screenshot({ path: '/tmp/dgr-write-1-initial.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/dgr-write-1-initial.png');

    // Step 4: Try to select a date (click first available)
    console.log('\n📍 Step 4: Select a date');
    const firstDateLink = await page.locator('a[href*="/dgr/write/"], button:has-text("pending"), button:has-text("draft")').first();
    if (await firstDateLink.isVisible().catch(() => false)) {
      await firstDateLink.click();
      await page.waitForTimeout(1500);
      console.log('✅ Clicked on a date entry');
    } else {
      // Try clicking on a date in a list
      const dateItem = await page.locator('.cursor-pointer, [role="button"]').first();
      if (await dateItem.isVisible().catch(() => false)) {
        await dateItem.click();
        await page.waitForTimeout(1500);
        console.log('✅ Clicked on date item');
      }
    }

    await page.screenshot({ path: '/tmp/dgr-write-2-date-selected.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/dgr-write-2-date-selected.png');

    // Step 5: Look for reflection form fields
    console.log('\n📍 Step 5: Check for form fields');
    const titleInput = await page.locator('input[placeholder*="title"], input[name="title"], input#title').first();
    const contentTextarea = await page.locator('textarea').first();

    const hasTitleInput = await titleInput.isVisible().catch(() => false);
    const hasContentArea = await contentTextarea.isVisible().catch(() => false);

    console.log('   Title input visible:', hasTitleInput);
    console.log('   Content textarea visible:', hasContentArea);

    // Step 6: If form is visible, try filling it
    if (hasContentArea) {
      console.log('\n📍 Step 6: Fill reflection form');

      // Fill title if available
      if (hasTitleInput) {
        await titleInput.fill('Test Reflection Title');
        console.log('✅ Filled title');
      }

      // Fill content
      await contentTextarea.fill('This is a test reflection written by Playwright automation. The Gospel today reminds us of the importance of faith in our daily lives.');
      console.log('✅ Filled reflection content');

      await page.screenshot({ path: '/tmp/dgr-write-3-form-filled.png', fullPage: true });
      console.log('📸 Screenshot: /tmp/dgr-write-3-form-filled.png');

      // Step 7: Look for save/submit button (but don't click it)
      console.log('\n📍 Step 7: Check for save/submit buttons');
      const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("send")').first();
      const saveBtnVisible = await saveBtn.isVisible().catch(() => false);
      console.log('   Save/Submit button visible:', saveBtnVisible);

      if (saveBtnVisible) {
        const btnText = await saveBtn.textContent();
        console.log('   Button text:', btnText.trim());
      }
    }

    // Final state
    console.log('\n✅ Test completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/dgr-write-error.png' });
    console.log('📸 Error screenshot: /tmp/dgr-write-error.png');
  } finally {
    // Print captured logs
    if (logs.length > 0) {
      console.log('\n📋 Browser/Network issues:');
      logs.forEach(log => console.log('  ', log));
    } else {
      console.log('\n📋 No browser errors or failed requests');
    }

    await browser.close();
    console.log('\n🏁 Browser closed');
  }
})();
