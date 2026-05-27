const { chromium } = require('@playwright/test');

const roles = ['Админ', 'Завуч', 'Учитель', 'Ученик', 'Родитель'];

(async () => {
  const browser = await chromium.launch();
  const result = {};
  for (const r of roles) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('https://erudit-school.vercel.app/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: r, exact: true }).click();
    await page.waitForURL('**/dashboard', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(3000);
    let items = await page.locator('.mantine-NavLink-label').allInnerTexts().catch(() => []);
    if (!items.length) items = await page.locator('nav a').allInnerTexts().catch(() => []);
    items = items.map((s) => s.trim()).filter(Boolean);
    result[r] = items;
    console.log('\n=== ' + r + ' — ' + items.length + ' пунктов, URL: ' + page.url().replace('https://erudit-school.vercel.app', '') + ' ===');
    console.log(items.join(' | '));
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
