// v8 QA: Disinfo Desk (satire) — badges, disclaimer, isolation from news surfaces, search, about, console.
import { chromium, devices } from 'playwright';
import { SOURCES } from '../lib/sources.ts';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const SAT = SOURCES.filter((s) => s.category === 'satire').map((s) => s.name);
ok(SAT.length === 8, `8 satire outlets registered (${SAT.join(', ')})`);
const errs = [];
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(`${p.url()} ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message}`)); };
const grab = (p, sel = 'body') => p.$$eval(`${sel} [data-testid=headline]`, (ls) => ls.map((l) => ({ src: l.querySelector('[data-testid=source]')?.textContent?.trim() || '', tag: l.dataset.tag || '', sat: !!l.querySelector('[data-testid=satire-badge]'), dis: !!l.querySelector('[data-testid=disinfo-badge]'), clr: !!l.querySelector('[data-testid=clearance]'), where: l.closest('[data-testid^=section-],[data-testid=top-banner],[data-testid=ticker]')?.dataset.testid || '' })));
const b = await chromium.launch();
for (const [name, opts] of [['desktop-1440', { viewport: { width: 1440, height: 900 } }], ['mobile-390', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const rows = await grab(p);
  const satRows = rows.filter((r) => r.where === 'section-satire');
  ok(satRows.length >= 1 && satRows.every((r) => SAT.includes(r.src)), `${name} home Disinfo Desk: ${satRows.length} items, all from the 8 satire outlets`);
  ok(satRows.every((r) => r.sat && r.dis && !r.clr && !r.tag), `${name} home satire items: SATIRE + DISINFO badge, no L1–L4, no snark tag`);
  const leak = rows.filter((r) => r.where !== 'section-satire' && SAT.includes(r.src));
  ok(leak.length === 0, `${name} home: no satire outside the Disinfo Desk (top story/breaking/ticker/trending/other columns)${leak.length ? ' — ' + leak.map((r) => r.src + '@' + r.where).join(',') : ''}`);
  const banner = await p.$eval('[data-testid=top-banner]', (s) => s.textContent).catch(() => '');
  const ticker = await p.$eval('[data-testid=ticker]', (s) => s.textContent).catch(() => '');
  const trend = await p.$eval('[data-testid=section-trending]', (s) => s.textContent).catch(() => '');
  ok(!SAT.some((s) => banner.includes(s) || ticker.includes(s) || trend.includes(s)), `${name} home: top story, FLASH ticker and trending text name no satire outlet`);
  const sec = p.locator('section[data-testid=section-satire]');
  await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  await sec.screenshot({ path: `${SHOTS}v8-satire-${name}-home-block.png` });
  const r = await p.goto(BASE + '/c/satire', { waitUntil: 'networkidle' });
  const disc = await p.$eval('[data-testid=satire-disclaimer]', (d) => d.textContent).catch(() => '');
  const cr = (await grab(p, 'main')).filter((x) => x.where === 'section-satire');
  ok(r.status() === 200 && /not news/i.test(disc), `${name} /c/satire: 200 with header disclaimer ("${disc.trim()}")`);
  ok(cr.length >= 1 && cr.every((x) => x.sat && x.dis && !x.clr && !x.tag && SAT.includes(x.src)), `${name} /c/satire: ${cr.length} items, every one SATIRE + DISINFO, no L1–L4, no snark tag`);
  await p.screenshot({ path: `${SHOTS}v8-satire-${name}-c-satire.png` });
  for (const s of ['breaking', 'top', 'politics', 'weird', 'us', 'world', 'tech', 'sports', 'entertainment', 'pop-culture']) {
    await p.goto(BASE + '/c/' + s, { waitUntil: 'load' });
    const cx = await grab(p); const bad = cx.filter((x) => SAT.includes(x.src) || x.sat);
    ok(bad.length === 0, `${name} /c/${s}: no satire (${cx.length} items)`);
  }
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/trending', { waitUntil: 'load' });
  const t = await p.$eval('main', (m) => m.textContent);
  ok(!SAT.some((s) => t.includes(s)), '/trending names no satire outlet');
  await p.goto(BASE + '/map', { waitUntil: 'networkidle' });
  const m = await p.content();
  ok(!SAT.some((s) => m.includes(s)), '/map HTML contains no satire outlet');
  await p.goto(BASE + '/search?q=Babylon', { waitUntil: 'load' }); await p.waitForTimeout(800);
  const sr = await p.$$eval('[data-testid=search-results-item]', (x) => x.map((i) => !!i.querySelector('[data-testid=satire-badge]')));
  const html = await p.content();
  ok(sr.length >= 1 && (sr.some(Boolean) || html.includes('data-testid="satire-badge"')), `search "Babylon": ${sr.length} results, satire badge shown`);
  await p.goto(BASE + '/about', { waitUntil: 'load' });
  ok((await p.$eval('main', (m) => m.textContent)).includes('Disinfo Desk'), '/about mentions the Disinfo Desk');
  await ctx.close();
}
ok(errs.length === 0, `no console errors${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
