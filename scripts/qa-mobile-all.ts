import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'https://erudit-school.vercel.app';
const PASS = 'erudit2025';
const OUT = path.join(process.cwd(), 'qa-screenshots', 'mobile-detailed');

const DEVICES = [
  { name: 'iphone-se', w: 375, h: 667, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
  { name: 'iphone-14', w: 390, h: 844, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
  { name: 'iphone-14-pro-max', w: 430, h: 932, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
  { name: 'pixel-7', w: 412, h: 915, ua: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)' },
  { name: 'samsung-s23', w: 360, h: 780, ua: 'Mozilla/5.0 (Linux; Android 13; SM-S911B)' },
  { name: 'tablet-ipad', w: 768, h: 1024, ua: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)' },
];

const ROLES = [
  { login: 'admin', label: 'admin', pages: ['/dashboard', '/analytics', '/grading'] },
  { login: 'azhibaeva', label: 'teacher', pages: ['/grading', '/schedule', '/homework'] },
  { login: 'student1', label: 'student', pages: ['/diary', '/schedule', '/homework', '/news'] },
  { login: 'parent1', label: 'parent', pages: ['/diary', '/schedule', '/homework'] },
];

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  for (const device of DEVICES) {
    console.log(`\n=== ${device.name} (${device.w}x${device.h}) ===`);

    for (const role of ROLES) {
      const ctx = await browser.newContext({
        viewport: { width: device.w, height: device.h },
        userAgent: device.ua,
      });
      const page = await ctx.newPage();

      // Login
      await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
      await page.fill('input:first-of-type', role.login);
      const pwField = page.locator('input[type="password"]');
      await pwField.fill(PASS);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      for (const p of role.pages) {
        await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(1500);
        const fname = `${device.name}-${role.label}-${p.replace(/\//g, '-').slice(1)}.png`;
        await page.screenshot({ path: path.join(OUT, fname), fullPage: true });
        console.log(`  ${role.label}: ${p} ✓`);
      }

      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\n✅ All mobile screenshots saved to ${OUT}`);
}

run().catch(console.error);
