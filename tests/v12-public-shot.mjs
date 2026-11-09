import { chromium, devices } from 'playwright';
const B='https://ghost-ticker.vercel.app'; const SHOTS=new URL('../shots/', import.meta.url).pathname;
const b=await chromium.launch();
for (const [name,opts] of [['mobile-390',{...devices['iPhone 13'],viewport:{width:390,height:844}}],['desktop-1440',{viewport:{width:1440,height:900}}]]) {
  const ctx=await b.newContext(opts); const p=await ctx.newPage();
  await p.goto(B+'/',{waitUntil:'networkidle'});
  const sizes=await p.$$eval('.gt-tag, .satire-badge, a.clr, [data-testid=disinfo-badge]',els=>els.slice(0,40).map(e=>{const r=e.getBoundingClientRect();return Math.round(r.height)}));
  console.log(name,'badge heights',sizes.slice(0,8),'min/max',Math.min(...sizes),Math.max(...sizes));
  const draft=await p.content(); console.log(name,'DRAFT',/DRAFT/.test(draft),'adsbygoogle',/adsbygoogle/.test(draft),'noindex',/noindex/.test(draft));
  await p.screenshot({path:`${SHOTS}v12-public-${name}-home.png`});
  const hl=p.locator('[data-testid=headline]').nth(1);
  await hl.screenshot({path:`${SHOTS}v12-public-${name}-headline.png`}).catch(()=>{});
  await p.goto(B+'/c/weird',{waitUntil:'networkidle'});
  await p.screenshot({path:`${SHOTS}v12-public-${name}-c-weird.png`});
  await ctx.close();
}
await b.close();
