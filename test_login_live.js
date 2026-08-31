import { chromium } from 'playwright';

async function main() {
  console.log("Launching headless browser to test live sign in...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`HTTP ${resp.status()} for ${resp.url()}`);
    }
  });

  await page.goto('https://driver-induction-platform.vercel.app', { waitUntil: 'networkidle' });
  console.log("Page loaded. Clicking Compliance Manager tab...");

  const adminTab = page.locator('button:has-text("Compliance Manager")');
  await adminTab.click();

  console.log("Filling email and password...");
  await page.fill('input[type="email"]', 'admin@bntlogistics.com.au');
  await page.fill('input[type="password"]', 'Param@2001');

  console.log("Clicking Sign In button...");
  await page.click('button[type="submit"]');

  await page.waitForTimeout(4000);

  const bodyText = await page.innerText('body');
  console.log("PAGE BODY AFTER SIGN IN:\n", bodyText.slice(0, 500));

  await page.screenshot({ path: 'login_result.png' });
  await browser.close();
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
