// Скрины слайдов КП для проверки. node scripts/shot-kp.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path';

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(pathToFileURL(path.resolve('docs/kp-intellect/index.html')).href, { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
for (const n of [0, 1, 3, 6, 10, 11]) {
  await p.evaluate((k) => {
    [...document.querySelectorAll('.slide')].forEach((el, j) => el.classList.toggle('active', j === k));
  }, n);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `verify-shots/kp-slide-${n}.png` });
}
console.log('✓ слайды сняты');
await b.close();
