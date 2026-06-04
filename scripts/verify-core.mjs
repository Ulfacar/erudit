// Визуальная проверка ядра: /core, /admission, виджет ассистента.
// Запуск: node scripts/verify-core.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = 'verify-shots';
mkdirSync(OUT, { recursive: true });

async function login(page, who, password = 'erudit2025') {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  const loginInput = page
    .locator('input[name="login"], input[type="text"], input:not([type="password"]):not([type="hidden"]):not([type="checkbox"])')
    .first();
  await loginInput.fill(who);
  await page.locator('input[type="password"]').fill(password);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.endsWith('/login'), { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── админ ──
  await login(page, 'admin');
  console.log('admin: вошёл');

  await page.goto(`${BASE}/core`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000); // даём физике графа разлететься
  await page.screenshot({ path: `${OUT}/01-core-graph.png` });
  console.log('✓ /core');

  await page.goto(`${BASE}/admission`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/02-admission.png` });
  console.log('✓ /admission');

  // виджет ассистента
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.click('[aria-label="Открыть ассистента"]');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/03-assistant-admin.png` });
  console.log('✓ виджет (admin)');

  // ── родитель ──
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await login(p2, 'parent1');
  await p2.waitForTimeout(2000);
  await p2.click('[aria-label="Открыть ассистента"]');
  await p2.waitForTimeout(1200);
  await p2.screenshot({ path: `${OUT}/04-assistant-parent.png` });
  console.log('✓ виджет (parent)');

  await browser.close();
  console.log('DONE');
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
