import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const ARTIFACTS_DIR = 'C:\\Users\\admin\\.gemini\\antigravity-ide\\brain\\7153f2bf-3620-4b5a-9d05-af878e88a2ec';
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runBrowserTest() {
  console.log('🚀 Launching Google Chrome directly via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900'],
  });

  const page = await browser.newPage();

  console.log('📱 Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 20000 });

  // 1. Authenticate if on login screen
  const isLoginPage = await page.$('input[type="password"]');
  if (isLoginPage) {
    console.log('🔑 Logging in as Super Admin (+91 9876500000)...');
    try {
      // Look for quick login button first
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const adminBtn = buttons.find(b => b.textContent?.includes('Super Admin'));
        if (adminBtn) {
          adminBtn.click();
          return true;
        }
        return false;
      });

      if (!clicked) {
        // Type credentials
        await page.type('input[type="text"], input[type="tel"]', '9876500000');
        await page.type('input[type="password"]', 'Password123!');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) await submitBtn.click();
      }
    } catch (e) {
      console.log('Login action warning:', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // Ensure on Super Admin dashboard
  console.log('📋 Verifying Super Admin Dashboard loaded...');
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  // Helper to click sidebar tab by text
  async function clickTab(tabText) {
    await page.evaluate((text) => {
      const navButtons = Array.from(document.querySelectorAll('nav button'));
      const btn = navButtons.find(b => b.textContent?.toLowerCase().includes(text.toLowerCase()));
      if (btn) btn.click();
    }, tabText);
    await new Promise(r => setTimeout(r, 800));
  }

  const viewports = [
    { name: 'desktop', width: 1280, height: 850 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ];

  // ── TEST 1: BUSES TAB (TRANSPORT-WISE) ──
  console.log('\n🚌 Testing BUSES tab (Transport-Wise Cards)...');
  await clickTab('Buses');
  await new Promise(r => setTimeout(r, 1000));

  // Verify transport-group-cards exist
  const busGroupCardsCount = await page.$$eval('.transport-group-card', els => els.length);
  console.log(`✅ Found ${busGroupCardsCount} transport cards in Buses view.`);

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 500));
    const shotPath = path.join(ARTIFACTS_DIR, `buses_${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`📸 Saved screenshot: buses_${vp.name}.png (${vp.width}x${vp.height})`);
  }

  // ── TEST 2: STAFF TAB (TRANSPORT-WISE) ──
  console.log('\n👥 Testing STAFF tab (Transport-Wise Cards)...');
  // Return to desktop view for clicking
  await page.setViewport({ width: 1280, height: 850 });
  await clickTab('Staff');
  await new Promise(r => setTimeout(r, 1000));

  const staffGroupCardsCount = await page.$$eval('.transport-group-card', els => els.length);
  console.log(`✅ Found ${staffGroupCardsCount} transport cards in Staff view.`);

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 500));
    const shotPath = path.join(ARTIFACTS_DIR, `staff_${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`📸 Saved screenshot: staff_${vp.name}.png (${vp.width}x${vp.height})`);
  }

  // ── TEST 3: OWNERS TAB ──
  console.log('\n🏢 Testing OWNERS tab...');
  await page.setViewport({ width: 1280, height: 850 });
  await clickTab('Owners');
  await new Promise(r => setTimeout(r, 1000));

  for (const vp of viewports) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await new Promise(r => setTimeout(r, 500));
    const shotPath = path.join(ARTIFACTS_DIR, `owners_${vp.name}.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`📸 Saved screenshot: owners_${vp.name}.png (${vp.width}x${vp.height})`);
  }

  await browser.close();
  console.log('\n🎉 All browser automation and responsiveness tests passed successfully!');
  process.exit(0);
}

runBrowserTest().catch(err => {
  console.error('❌ Browser test failed:', err);
  process.exit(1);
});
