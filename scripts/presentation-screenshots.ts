import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'https://erudit-school.vercel.app';
const PASS = 'erudit2025';
const OUT = path.join('C:', 'Users', 'alanb', 'OneDrive', 'Рабочий стол', 'presentation-screenshots');

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  // 1. Dashboard директора (десктоп 1440x900)
  console.log('1. Дашборд директора (десктоп)...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input:first-of-type', 'admin');
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // Скрин только видимой области (не fullPage) — как реальный экран
    await page.screenshot({ path: path.join(OUT, '01-dashboard-desktop.png') });
    console.log('  ✓ saved');
    await ctx.close();
  }

  // 2. Дневник родителя (мобильный iPhone 14)
  console.log('2. Дневник родителя (мобильный)...');
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input:first-of-type', 'parent1');
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/diary`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '02-diary-parent-mobile.png') });
    console.log('  ✓ saved');
    await ctx.close();
  }

  // 3. Расписание (мобильный iPhone 14)
  console.log('3. Расписание (мобильный)...');
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input:first-of-type', 'student1');
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/schedule`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '03-schedule-mobile.png') });
    console.log('  ✓ saved');
    await ctx.close();
  }

  // 4. Аналитика (десктоп)
  console.log('4. Аналитика (десктоп)...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input:first-of-type', 'admin');
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/analytics`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '04-analytics-desktop.png') });
    console.log('  ✓ saved');
    await ctx.close();
  }

  // 5. Электронный журнал (десктоп)
  console.log('5. Электронный журнал (десктоп)...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input:first-of-type', 'azhibaeva');
    await page.locator('input[type="password"]').fill(PASS);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto(`${BASE}/grading`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, '05-gradebook-desktop.png') });
    console.log('  ✓ saved');
    await ctx.close();
  }

  await browser.close();
  console.log(`\n✅ 5 скриншотов для презентации сохранены в:\n${OUT}`);
}

run().catch(console.error);
