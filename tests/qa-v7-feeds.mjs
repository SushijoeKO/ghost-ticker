// v7 QA: 192-feed expansion — home + sections load, distinct sources on site, snippets <=160,
// fun desks (sports/entertainment/pop-culture) hold only soft sources and never go breaking/top story.
import { chromium, devices } from 'playwright';
import { SOURCES, SOFT } from '../lib/sources.ts';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const catOf = Object.fromEntries(SOURCES.map((s) => [s.name, s.category]));
const FUN = ['sports', 'entertainment', 'pop-culture'];
const SLUGS = ['breaking', 'top', 'politics', 'weird', 'us', 'world', 'tech', ...FUN];
ok(SOURCES.length >= 180, `feed registry has ${SOURCES.length} sources`);
ok(new Set(SOURCES.map((s) => s.id)).size === SOURCES.length, 'source ids unique');
const errs = [];
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error') errs.push(`${p.url()} ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message}`)); };
const grab = (p) => p.$$eval('[data-testid=headline]', (ls) => ls.map((l) => ({ src: l.querySelector('[data-testid=source]')?.textContent?.trim() || '', snip: l.querySelector('p')?.textContent || '', where: l.closest('[data-testid^=section-],[data-testid=top-banner],[data-testid=ticker]')?.dataset.testid || '' })));
const b = await chromium.launch();
const seen = new Set(); let maxSnip = 0;
for (const [name, opts] of [['desktop-1440', { viewport: { width: 1440, height: 900 } }], ['mobile-390', { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } }]]) {
  const ctx = await b.newContext(opts); const p = await ctx.newPage(); watch(p);
  const r = await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const rows = await grab(p);
  ok(r.status() === 200 && rows.length >= 60, `${name} home: 200, ${rows.length} headlines`);
  rows.forEach((x) => x.src && seen.add(x.src));
  const snips = await p.$$eval('[data-testid=headline] p, [data-testid=top-banner] p', (ps) => ps.map((q) => q.textContent.length));
  maxSnip = Math.max(maxSnip, ...snips, 0);
  // fun desks
  for (const f of FUN) {
    const fr = rows.filter((x) => x.where === `section-${f}`);
    const hard = fr.filter((x) => !SOFT.includes(catOf[x.src]));
    ok(fr.length >= 5 && hard.length === 0, `${name} home ${f}: ${fr.length} items, ${hard.length} from hard-news sources${hard.length ? ' — ' + hard.map((x) => x.src).join(',') : ''}`);
  }
  const topSrc = await p.$$eval('[data-testid=top-banner] #top-story a', (s) => s.map((x) => (x.getAttribute('aria-label') || '').match(/\(opens (.+) in a new tab\)$/)?.[1] || '')).catch(() => []);
  const topBanner = await p.$eval('[data-testid=top-banner]', (s) => s.textContent).catch(() => '');
  const topSoft = topSrc.filter((s) => FUN.includes(catOf[s]));
  ok(topBanner && topSrc[0] && topSoft.length === 0, `${name} top story not from a fun desk (${topSrc.join(',') || 'n/a'})`);
  const brk = rows.filter((x) => x.where === 'section-breaking' || x.where === 'ticker');
  const brkSoft = brk.filter((x) => FUN.includes(catOf[x.src]));
  ok(brkSoft.length === 0, `${name} breaking/ticker: ${brk.length} items, ${brkSoft.length} from fun desks`);
  await p.screenshot({ path: `${SHOTS}v7-feeds-${name}-home.png`, fullPage: false });
  await p.screenshot({ path: `${SHOTS}v7-feeds-${name}-home-full.png`, fullPage: true });
  for (const s of SLUGS) {
    const rr = await p.goto(BASE + '/c/' + s, { waitUntil: 'load' });
    const cr = await grab(p); cr.forEach((x) => x.src && seen.add(x.src));
    const sn = await p.$$eval('[data-testid=headline] p', (ps) => ps.map((q) => q.textContent.length)); maxSnip = Math.max(maxSnip, ...sn, 0);
    ok(rr.status() === 200 && cr.length >= 10, `${name} /c/${s}: 200, ${cr.length} headlines`);
    if (FUN.includes(s)) {
      const hard = cr.filter((x) => x.src && !SOFT.includes(catOf[x.src]));
      ok(hard.length === 0, `${name} /c/${s}: no hard-news sources (${hard.map((x) => x.src).join(',')})`);
      if (name.startsWith('desktop') || s === 'sports') await p.screenshot({ path: `${SHOTS}v7-feeds-${name}-c-${s}.png` });
    }
  }
  await ctx.close();
}
ok(seen.size >= 100, `distinct sources seen on site: ${seen.size}`);
ok(maxSnip <= 160, `longest snippet ${maxSnip} chars (<=160)`);
ok(errs.length === 0, `no console errors${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
console.log(`\n${pass} passed, ${fail} failed; distinct=${seen.size}`);
process.exit(fail ? 1 : 0);
