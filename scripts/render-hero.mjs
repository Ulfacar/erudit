import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 820 } });
await p.goto('http://localhost:3000/?cb='+Date.now(), { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(3600);
await p.screenshot({ path: 'qa-screenshots/edukids-hero.png' });
await b.close();
