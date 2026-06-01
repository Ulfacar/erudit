import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 820 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:3000/?x='+Date.now(), { waitUntil:'networkidle', timeout:60000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'qa-screenshots/nav-logo.png', clip: { x: 0, y: 0, width: 460, height: 88 } });
await b.close();
