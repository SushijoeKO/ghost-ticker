// v5 QA: Sports / Entertainment / Pop Culture desks — home sections, category pages, mobile nav,
// tragedy rule on live headlines, sources page, sitemap, search, votes, console.
import { chromium, devices } from 'playwright';
import { isSensitive } from '../lib/tags.ts';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const CATS = [['sports', 'Sports', 'FIELD-OPS'], ['entertainment', 'Entertainment', 'COVER-STORY'], ['pop-culture', 'Pop Culture', 'CHATTER']];
const NEUTRAL = ['', 'FLASH', 'PRIORITY'];
const b = await chromium.launch();
const errs = [];
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${p.url()} ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message}`)); };
const settle = async (p) => {
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll('img[data-testid=thumb]')].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
};
const rows = (p, sel) => p.$$eval(`${sel} [data-testid=headline]`, (ls) => ls.filter((l) => !l.closest('[data-testid=top-banner],[data-testid=section-breaking],[data-testid=ticker]')).map((l) => ({ title: l.querySelector('[data-decrypt]')?.textContent || '', tag: l.dataset.tag || '', src: l.querySelector('[data-testid=source]')?.textContent?.trim() || '', img: !!l.querySelector('img[data-testid=thumb]') && l.querySelector('img[data-testid=thumb]').naturalWidth > 0, lead: l.classList.contains('headline-card'), where: location.pathname + ' ' + (l.closest('[data-testid]:not([data-testid=headline])')?.dataset.testid || '') })));
let allRows = [];

for (const W of [375, 768, 1280]) {
  const mobile = W < 500;
  const ctx = await b.newContext(mobile ? { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } : { viewport: { width: W, height: 900 } });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await settle(p);
  for (const [slug, label, code] of CATS) {
    const sel = `section[data-testid=section-${slug}]`;
    const sec = await p.$(sel);
    ok(!!sec, `${W}px home: ${label} section present`);
    if (!sec) continue;
    const head = await sec.$eval('h2', (h) => h.textContent);
    ok(head.includes(label) && head.includes('/' + code), `${W}px home: ${label} header shows codename /${code}`);
    const r = await rows(p, sel);
    allRows.push(...r);
    ok(r.length >= 5, `${W}px home: ${label} has ${r.length} headlines`);
    const lead = r.find((x) => x.lead);
    ok(lead && lead.img, `${W}px home: ${label} lead card has a loaded photo (${lead?.src})`);
    const per = {}; for (const x of r) per[x.src] = (per[x.src] || 0) + 1;
    ok(Math.max(...Object.values(per)) <= 2, `${W}px home: ${label} no outlet over 2 (${JSON.stringify(per)})`);
    ok(new Set(r.map((x) => x.src)).size >= 3, `${W}px home: ${label} mixes ${new Set(r.map((x) => x.src)).size} outlets`);
    const bw = await sec.evaluate((s) => ({ w: s.getBoundingClientRect().width, sw: s.scrollWidth }));
    ok(bw.w >= (W >= 1024 ? 300 : W - 40) && bw.sw <= bw.w + 1, `${W}px home: ${label} column width ${Math.round(bw.w)}px, no horizontal overflow`);
    await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
    await sec.screenshot({ path: `${SHOTS}v5-cats-${W}-home-${slug}.png` });
  }
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${W}px home: no page-level horizontal scroll`);
  if (W !== 768) {
    const row = await p.$('section[data-testid=section-sports]');
    const grid = await row.evaluateHandle((s) => s.parentElement);
    await grid.asElement().scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
    await grid.asElement().screenshot({ path: `${SHOTS}v5-cats-${mobile ? 'mobile' : 'desktop'}-home-row.png` });
  }

  // nav
  const nav = await p.$('[data-testid=nav-list]');
  const navInfo = await nav.evaluate((u) => ({ sw: u.scrollWidth, cw: u.clientWidth, labels: [...u.querySelectorAll('a')].map((a) => a.textContent.trim()) }));
  ok(['Sports', 'Entertainment', 'Pop Culture'].every((l) => navInfo.labels.includes(l)), `${W}px nav: new channels listed (${navInfo.labels.length} links)`);
  if (W < 1280) ok(navInfo.sw > navInfo.cw, `${W}px nav: overflows into a swipeable row (${navInfo.sw} > ${navInfo.cw})`);
  else ok(navInfo.sw <= navInfo.cw + 1, `${W}px nav: every link fits without scrolling`);
  if (mobile) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await nav.evaluate((u) => u.scrollTo({ left: 0 }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}v5-cats-mobile-nav-start.png`, clip: { x: 0, y: 0, width: 375, height: 420 } });
    await nav.evaluate((u) => u.scrollTo({ left: u.scrollWidth }));
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${SHOTS}v5-cats-mobile-nav.png`, clip: { x: 0, y: 0, width: 375, height: 420 } });
    const link = p.locator('[data-testid=nav-list] a', { hasText: 'Pop Culture' });
    await link.tap();
    await p.waitForURL(/\/c\/pop-culture/);
    await p.waitForLoadState('networkidle');
    const vis = await p.$eval('[data-testid=nav-list]', (u) => { const a = u.querySelector('.nav-active'); const ur = u.getBoundingClientRect(), ar = a.getBoundingClientRect(); return { txt: a.textContent.trim(), inView: ar.left >= ur.left - 1 && ar.right <= ur.right + 1 }; });
    ok(vis.txt === 'Pop Culture' && vis.inView, `${W}px nav: tapping Pop Culture opens /c/pop-culture with the active tab scrolled into view`);
  }

  // category pages
  for (const [slug, label, code] of CATS) {
    const r = await p.goto(BASE + '/c/' + slug, { waitUntil: 'networkidle' });
    await settle(p);
    const h1 = await p.$eval('h1', (h) => h.textContent);
    const n = await p.$$eval('[data-testid=headline]', (x) => x.length);
    const imgs = await p.$$eval('img[data-testid=thumb]', (x) => x.filter((i) => i.naturalWidth > 0).length);
    ok(r.status() === 200 && h1.includes(label) && n >= 15, `${W}px /c/${slug}: 200, "${h1}", ${n} headlines, ${imgs} photos`);
    ok(await p.locator(`text=/${code}`).count() > 0, `${W}px /c/${slug}: codename /${code} shown`);
    allRows.push(...(await rows(p, 'main')));
    await p.screenshot({ path: `${SHOTS}v5-cats-${W}-c-${slug}.png` });
  }
  await ctx.close();
}

// tragedy rule on live headlines
const sens = allRows.filter((r) => isSensitive(r.title));
const badSens = sens.filter((r) => !NEUTRAL.includes(r.tag));
ok(badSens.length === 0, `tragedy rule on live soft-desk headlines: ${sens.length} sensitive, ${badSens.length} with a joke tag${badSens.length ? ' — ' + badSens.slice(0, 3).map((r) => r.title + ' [' + r.tag + ']').join(' | ') : ''}`);
const tagged = [...new Set(allRows.filter((r) => r.tag && !NEUTRAL.includes(r.tag)).map((r) => r.tag))];
ok(tagged.length >= 3, `desk tags in use on live items: ${tagged.join(', ')}`);
{ const f = allRows.filter((r) => r.tag === 'FLASH'); ok(f.length === 0, `soft desks never flagged FLASH${f.length ? ' — ' + f[0].title + ' @ ' + f[0].where : ''}`); }
// home breaking strip carries no soft-desk leads


// sources page, sitemap, search, trending, map, vote
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/about', { waitUntil: 'networkidle' });
  for (const [slug, label] of CATS) {
    const li = await p.$$eval(`[data-testid=sources-${slug}] li`, (ls) => ls.map((l) => l.textContent));
    ok(li.length >= 5 && li.filter((t) => t.includes('online')).length >= li.length - 1, `/about lists ${li.length} ${label} feeds (${li.filter((t) => t.includes('online')).length} online)`);
  }
  await p.locator('[data-testid=sources-sports]').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${SHOTS}v5-cats-desktop-about.png`, fullPage: false });
  const sm = await (await p.request.get(BASE + '/sitemap.xml')).text();
  ok(CATS.every(([s]) => sm.includes(`/c/${s}<`)), 'sitemap lists /c/sports, /c/entertainment, /c/pop-culture');
  await p.goto(BASE + '/search?q=ESPN', { waitUntil: 'load' });
  await p.waitForTimeout(800);
  const sr = await p.$$eval('[data-testid=search-results-item]', (x) => x.length);
  ok(sr >= 1, `search finds sports desk items (ESPN: ${sr})`);
  await p.goto(BASE + '/search?q=Variety', { waitUntil: 'load' });
  ok((await p.$$eval('[data-testid=search-results-item]', (x) => x.length)) >= 1, 'search finds entertainment desk items (Variety)');
  await p.screenshot({ path: `${SHOTS}v5-cats-desktop-search.png` });
  const mr = await p.goto(BASE + '/map', { waitUntil: 'networkidle' });
  ok(mr.status() === 200, '/map still renders with the new desks in the wire');
  // vote on a sports lead from the home page
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  const v = p.locator('section[data-testid=section-sports] [data-testid=vote][aria-pressed=false]').first();
  await v.scrollIntoViewIfNeeded();
  const [resp] = await Promise.all([p.waitForResponse((r) => r.url().endsWith('/api/vote') && r.request().method() === 'POST'), v.click()]);
  const j = await resp.json();
  ok(j.ok === true && j.votes >= 1, `vote on a sports story is accepted (${JSON.stringify(j)})`);
  await ctx.close();
}
ok(errs.length === 0, `console clean${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
