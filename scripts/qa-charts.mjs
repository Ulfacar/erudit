import { chromium } from 'playwright';
const BASE='https://bilimos.kg';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const p=await ctx.newPage();
const USER='input:not([type="password"]):not([type="checkbox"]):not([type="hidden"])';
await p.goto(BASE+'/login',{waitUntil:'networkidle',timeout:60000});
await p.waitForSelector(USER,{timeout:15000});
await p.locator(USER).first().fill('admin');
await p.locator('button[type="submit"]').first().click();
await p.waitForURL(u=>!u.pathname.startsWith('/login'),{timeout:15000});
await p.goto(BASE+'/analytics',{waitUntil:'networkidle',timeout:45000});
await p.waitForTimeout(5000); // let charts fetch+animate
const probe=await p.evaluate(()=>{
  const svgs=[...document.querySelectorAll('svg.recharts-surface, .recharts-wrapper svg, svg')];
  const recharts=document.querySelectorAll('.recharts-wrapper').length;
  const bars=document.querySelectorAll('.recharts-bar-rectangle, .recharts-rectangle').length;
  const lines=document.querySelectorAll('.recharts-line-curve, path.recharts-curve').length;
  const dots=document.querySelectorAll('.recharts-dot').length;
  const canvas=document.querySelectorAll('canvas').length;
  const noData=[...document.querySelectorAll('*')].filter(e=>/нет данных|no data|недостаточно/i.test(e.textContent)&&e.children.length===0).map(e=>e.textContent.trim().slice(0,40));
  return {recharts, bars, lines, dots, canvas, svgCount:svgs.length, noData:[...new Set(noData)].slice(0,4)};
});
console.log('CHART PROBE:', JSON.stringify(probe));
await p.screenshot({path:'qa-screenshots/m-analytics-top.png', clip:{x:0,y:60,width:390,height:780}});
await b.close();
