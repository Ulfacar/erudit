import { chromium } from 'playwright';
const url = 'https://erudit-school.vercel.app/?cb=' + Date.now();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERR: '+e.message));
await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3500);
const info = await p.evaluate(() => {
  const g = (sel) => { const el=document.querySelector(sel); if(!el) return null; const cs=getComputedStyle(el); return {text: el.textContent.trim().slice(0,30), color: cs.color, fill: cs.webkitTextFillColor, opacity: cs.opacity, font: cs.fontFamily, vis: cs.visibility, display: cs.display}; };
  const h1 = document.querySelector('h1');
  return {
    title: document.title,
    h1: g('h1'),
    firstH2: g('h2'),
    firstP: g('p'),
    gradientSpan: g('.text-gradient'),
    fontsReady: document.fonts ? document.fonts.status : 'n/a',
    bodyColor: getComputedStyle(document.body).color,
  };
});
console.log('ERRORS:', JSON.stringify(errs, null, 1));
console.log('INFO:', JSON.stringify(info, null, 1));
await p.screenshot({ path: 'qa-screenshots/live-check.png', fullPage: false });
await p.screenshot({ path: 'qa-screenshots/live-check-full.png', fullPage: true });
await b.close();
