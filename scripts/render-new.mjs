import { chromium } from 'playwright';
const b = await chromium.launch();
const errs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERR: '+e.message));
await p.goto('http://localhost:3000/?cb='+Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3600);
const checks = await p.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
  h1: document.querySelector('h1')?.textContent.trim().slice(0,40),
  bodyBg: getComputedStyle(document.body).backgroundColor,
  logo: !!document.querySelector('img[src*="logo"]'),
  counters: [...document.querySelectorAll('.counter')].map(c=>c.textContent),
  imgsLoaded: [...document.querySelectorAll('img')].map(i=>({src:i.getAttribute('src'), ok:i.naturalWidth>0})),
  sections: [...document.querySelectorAll('section,header')].length,
}));
console.log('CHECKS:', JSON.stringify(checks, null, 1));
console.log('ERRORS:', JSON.stringify(errs));
await p.screenshot({ path: 'qa-screenshots/edukids-desktop.png', fullPage: true });
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto('http://localhost:3000/?cb='+Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
await m.waitForTimeout(3600);
const mob = await m.evaluate(()=>({overflow: document.documentElement.scrollWidth>document.documentElement.clientWidth, scrollW:document.documentElement.scrollWidth}));
console.log('MOBILE:', JSON.stringify(mob));
await m.screenshot({ path: 'qa-screenshots/edukids-mobile.png', fullPage: true });
await b.close();
