import { chromium } from 'playwright';
const BASE='https://bilimos.kg';
const b=await chromium.launch();
const p=await (await b.newContext({viewport:{width:390,height:844},isMobile:true})).newPage();
const USER='input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])';
await p.goto(BASE+'/login?cb='+Date.now(),{waitUntil:'networkidle',timeout:60000});
await p.waitForSelector(USER,{timeout:15000});
const prefill=await p.locator(USER).first().inputValue();
console.log('prefilled login =', JSON.stringify(prefill));
// submit defaults as-is (simulate salesperson just clicking Войти)
await p.locator('button[type="submit"]').first().click();
let ok=false; try{ await p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:15000}); ok=true; }catch{}
console.log('default-submit logged in =', ok, '-> url', p.url().replace(BASE,''));
await b.close();
