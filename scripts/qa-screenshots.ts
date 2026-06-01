import { chromium, type Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'https://erudit-school.vercel.app';
const PASS = 'erudit2025';
const OUT = path.join(process.cwd(), 'qa-screenshots');

const ROLES = [
  { login: 'admin', label: 'admin', pages: ['/dashboard', '/analytics', '/grading', '/schedule', '/students', '/reports'] },
  { login: 'azhibaeva', label: 'teacher', pages: ['/grading', '/schedule', '/homework'] },
  { login: 'student1', label: 'student', pages: ['/diary', '/schedule', '/homework', '/news'] },
  { login: 'parent1', label: 'parent', pages: ['/diary', '/schedule', '/homework', '/news'] },
];

async function login(page: Page, username: string) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="text"], input[name="login"], input:first-of-type', username);
  // Find password field
  const pwField = page.locator('input[type="password"]');
  await pwField.fill(PASS);
  // Click submit button
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

async function run() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  // Desktop
  console.log('=== DESKTOP (1440x900) ===');
  const desktopCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  for (const role of ROLES) {
    await desktopCtx.clearCookies();
    const page = await desktopCtx.newPage();
    console.log(`\nLogin as ${role.label}...`);
    await login(page, role.login);

    for (const p of role.pages) {
      console.log(`  ${role.label}: ${p}`);
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);

      // Check for console errors
      const errors: string[] = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

      await page.screenshot({ path: path.join(OUT, `desktop-${role.label}-${p.replace(/\//g, '-').slice(1) || 'home'}.png`), fullPage: true });

      if (errors.length > 0) {
        console.log(`    ⚠ Console errors: ${errors.join('; ')}`);
      }
    }

    // Check blocked pages for student/parent
    if (role.label === 'student' || role.label === 'parent') {
      for (const blocked of ['/dashboard', '/incidents', '/students']) {
        await page.goto(`${BASE}${blocked}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUT, `desktop-${role.label}-BLOCKED-${blocked.slice(1)}.png`), fullPage: true });
        console.log(`  ${role.label}: ${blocked} (should be blocked)`);
      }
    }

    await page.close();
  }
  await desktopCtx.close();

  // Mobile
  console.log('\n=== MOBILE (375x812 iPhone) ===');
  const mobileCtx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
  });

  for (const role of [ROLES[0], ROLES[2], ROLES[3]]) { // admin, student, parent
    await mobileCtx.clearCookies();
    const page = await mobileCtx.newPage();
    console.log(`\nMobile login as ${role.label}...`);
    await login(page, role.login);

    for (const p of role.pages.slice(0, 3)) { // first 3 pages
      console.log(`  mobile-${role.label}: ${p}`);
      await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(OUT, `mobile-${role.label}-${p.replace(/\//g, '-').slice(1) || 'home'}.png`), fullPage: true });
    }
    await page.close();
  }
  await mobileCtx.close();

  // Login page
  console.log('\n=== LOGIN PAGE ===');
  const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const loginPage = await loginCtx.newPage();
  await loginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await loginPage.waitForTimeout(1000);
  await loginPage.screenshot({ path: path.join(OUT, 'desktop-login.png'), fullPage: true });

  const mobileLoginCtx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mobileLoginPage = await mobileLoginCtx.newPage();
  await mobileLoginPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await mobileLoginPage.waitForTimeout(1000);
  await mobileLoginPage.screenshot({ path: path.join(OUT, 'mobile-login.png'), fullPage: true });

  await browser.close();
  console.log(`\n✅ Screenshots saved to ${OUT}`);
}

run().catch(console.error);
