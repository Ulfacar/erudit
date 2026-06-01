import { chromium } from 'playwright';
const BASE='https://bilimos.kg';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p=await ctx.newPage();
const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100))}); p.on('pageerror',e=>errs.push('PE:'+e.message.slice(0,100)));
const ov=async()=>p.evaluate(()=>({o:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,sw:document.documentElement.scrollWidth}));
const USER='input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])';

async function tryLogin(login){
  await p.goto(BASE+'/login',{waitUntil:'networkidle',timeout:60000});
  await p.waitForSelector(USER,{timeout:15000});
  if(login){ const u=p.locator(USER).first(); await u.fill(login); }
  await p.waitForTimeout(300);
  await p.locator('button[type="submit"]').first().click();
  try{ await p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:12000}); return true; }
  catch{ const t=await p.locator('text=Неверный').first().textContent().catch(()=>null); console.log(`  '${login||"default"}' FAIL err="${t}" url=${p.url()}`); return false; }
}
let ok=await tryLogin(null); console.log('default(admin1) ->',ok,p.url());
if(!ok){ ok=await tryLogin('admin'); console.log('admin ->',ok,p.url()); }
if(!ok){ await p.screenshot({path:'qa-screenshots/m-login-fail.png'}); console.log('BOTH FAILED'); await b.close(); process.exit(0); }
await p.waitForLoadState('networkidle').catch(()=>{}); await p.waitForTimeout(2500);
console.log('landed',p.url(),'ov',JSON.stringify(await ov()));
await p.screenshot({path:'qa-screenshots/m-10-dashboard.png',fullPage:true});
for(const [name,r] of [['analytics','/analytics'],['students','/students'],['moderation','/grading/moderation'],['schedule','/schedule'],['diary','/diary']]){
  try{ await p.goto(BASE+r,{waitUntil:'networkidle',timeout:45000}); await p.waitForTimeout(1800);
    const o=await ov(); console.log(`${r} -> ${p.url().replace(BASE,'')} overflow=${o.o} sw=${o.sw}`);
    await p.screenshot({path:`qa-screenshots/m-${name}.png`,fullPage:true});
  }catch(e){console.log(`${r} ERR ${e.message.slice(0,60)}`);}
}
console.log('ERRORS',errs.length,JSON.stringify([...new Set(errs)].slice(0,6)));
await b.close();
