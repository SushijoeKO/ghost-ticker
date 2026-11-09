// v6 QA: L4 clearance level, badge tooltips (hover / focus / tap), home key, About #clearance legend.
import { chromium, devices } from 'playwright';
import { clearance, LEVELS } from '../lib/clearance.ts';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const errs = [];
const watch = (p) => { p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${p.url()} ${m.text()}`); }); p.on('pageerror', (e) => errs.push(`${p.url()} ${e.message}`)); };
const b = await chromium.launch();

// unit: cutoffs
ok([1, 2, 3, 4, 6, 7, 21].map((n) => clearance(n).lvl).join() === '1,2,2,3,3,4,4', 'cutoffs: 1→L1, 2–3→L2, 4–6→L3, 7+→L4');
ok(LEVELS[3].label === 'COSMIC', 'L4 is named COSMIC');

const tipBox = (p) => p.$eval('[data-testid=clearance-tip]', (t) => { const r = t.getBoundingClientRect(); return { text: t.textContent, l: r.left, r: r.right, t: r.top, b: r.bottom, vis: getComputedStyle(t).visibility, vw: innerWidth, vh: innerHeight }; }).catch(() => null);

for (const W of [375, 768, 1280]) {
  const mobile = W < 500;
  const ctx = await b.newContext(mobile ? { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } : { viewport: { width: W, height: 900 } });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });

  // badges
  const badges = await p.$$eval('a[data-testid=clearance]', (as) => as.map((a) => ({ href: a.getAttribute('href'), lvl: +a.dataset.level, tip: a.dataset.tip, n: parseInt(a.dataset.count), sr: a.querySelector('.sr-only')?.textContent || '', vis: a.querySelector('[aria-hidden]')?.textContent || '' })));
  ok(badges.length >= 40, `${W}px home: ${badges.length} clearance badges`);
  ok(badges.every((x) => x.href === '/about#clearance'), `${W}px: every badge links to /about#clearance`);
  ok(badges.every((x) => clearance(x.n).lvl === x.lvl && x.vis === `L${x.lvl} · ${LEVELS[x.lvl - 1].label}`), `${W}px: every badge level matches its outlet count`);
  ok(badges.every((x) => /^L[1-4] · [A-Z ]+: (1 outlet|[\d–+]+ outlets) reporting$/.test(x.tip) && x.sr.includes(x.tip)), `${W}px: every badge has a one-line meaning, also in screen-reader text (e.g. "${badges.find((x) => x.lvl === 3)?.tip}")`);
  const dist = [1, 2, 3, 4].map((l) => badges.filter((x) => x.lvl === l).length);
  ok(dist[3] >= 1 && dist[3] <= Math.max(3, badges.length * 0.1), `${W}px home: L4 is rare but present (L1..L4 = ${dist.join('/')})`);

  // key
  if (mobile) {
    const d = p.locator('[data-testid=clearance-key-mobile]');
    ok(await d.isVisible() && !(await p.locator('[data-testid=clearance-key]').isVisible()), `${W}px: mobile key shown as a collapsed panel; desktop strip hidden`);
    ok((await d.evaluate((e) => e.open)) === false && (await d.evaluate((e) => e.getBoundingClientRect().height)) < 60, `${W}px: mobile key collapsed by default (one line)`);
    await d.locator('summary').tap();
    ok(await d.evaluate((e) => e.open) && (await d.locator('[data-testid=level-chip]').count()) === 4, `${W}px: tapping the key opens all 4 levels`);
    await d.scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${SHOTS}v6-levels-375-home-legend.png`, clip: await d.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top + scrollY - 60), width: 375, height: r.height + 140 }; }) });
    await d.locator('summary').tap();
  } else {
    const k = p.locator('[data-testid=clearance-key]');
    ok(await k.isVisible() && (await k.locator('[data-testid=level-chip]').count()) === 4, `${W}px: home key strip shows all 4 levels`);
    const box = await k.boundingBox();
    ok(box.height <= (W >= 1280 ? 40 : 70), `${W}px: key strip is compact (${Math.round(box.height)}px tall)`);
    await k.scrollIntoViewIfNeeded();
    await k.screenshot({ path: `${SHOTS}v6-levels-${W}-home-legend.png` });
  }
  const overlap = await p.evaluate(() => { const k = [...document.querySelectorAll('.clr-key')].find((e) => e.offsetParent); const t = document.querySelector('[data-testid=top-banner]'); if (!k || !t) return 'missing'; const a = k.getBoundingClientRect(), c = t.getBoundingClientRect(); return a.bottom <= c.top + 1 ? 'ok' : 'overlap'; });
  ok(overlap === 'ok', `${W}px: key sits in the flow above the top story, covering nothing`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${W}px: no horizontal page scroll`);

  // L4 style
  const l4 = p.locator('main a.clr-l4').first();
  if (await l4.count()) {
    const st = await l4.evaluate((e) => { const s = getComputedStyle(e); return { anim: s.animationName, shadow: s.boxShadow, color: s.color, weight: s.fontWeight }; });
    ok(st.anim === 'clr-pulse' && st.shadow !== 'none' && st.color === 'rgb(254, 243, 199)', `${W}px: L4 has a glowing pulse (${st.anim}) and light-gold text`);
    await l4.scrollIntoViewIfNeeded();
    const row = await l4.evaluateHandle((e) => e.closest('[data-testid=headline]') || e.closest('[data-testid=top-banner]') || e.parentElement);
    await p.waitForTimeout(400);
    await row.asElement().screenshot({ path: `${SHOTS}v6-levels-${W}-badges-l4.png` });
  } else ok(false, `${W}px: an L4 badge on the home page`);

  // tooltip
  const target = p.locator('main a.clr-l3, main a.clr-l4').first();
  await target.scrollIntoViewIfNeeded();
  if (mobile) {
    const url0 = p.url();
    await target.tap();
    await p.waitForTimeout(150);
    let t = await tipBox(p);
    ok(t && /^L[34] · (TOP SECRET|COSMIC): /.test(t.text) && p.url() === url0, `${W}px tap: first tap shows the meaning without navigating ("${t?.text.slice(0, 40)}…")`);
    ok(t && t.l >= 0 && t.r <= t.vw && t.t >= 0, `${W}px tap: tooltip fits on screen`);
    await p.screenshot({ path: `${SHOTS}v6-levels-375-tooltip.png` });
    await p.locator('main h1').evaluate(() => 0);
    await p.mouse.click(5, 300).catch(() => {});
    await p.locator('body').tap({ position: { x: 5, y: 400 } });
    await p.waitForTimeout(250);
    ok(!(await tipBox(p)), `${W}px tap: tapping elsewhere closes it`);
    await target.tap(); await p.waitForTimeout(150);
    await Promise.all([p.waitForURL(/\/about#clearance$/), p.locator('[data-testid=clearance-tip-link]').tap()]);
    await p.waitForLoadState('networkidle');
    const inView = await p.$eval('#clearance', (s) => { const r = s.getBoundingClientRect(); return r.top >= -2 && r.top < innerHeight / 2; });
    ok(inView, `${W}px tap: the tooltip's legend link opens /about#clearance at the section`);
    await p.screenshot({ path: `${SHOTS}v6-levels-375-about.png`, fullPage: false });
  } else {
    await target.hover();
    await p.waitForTimeout(150);
    let t = await tipBox(p);
    ok(t && /^L[34] · (TOP SECRET|COSMIC): (4–6|7\+) outlets reporting/.test(t.text) && t.vis === 'visible', `${W}px hover: tooltip "${t?.text.split('reporting')[0]}reporting"`);
    const bb = await target.boundingBox();
    ok(t && t.l >= 0 && t.r <= t.vw && (t.b <= bb.y + 1 || t.t >= bb.y + bb.height - 1), `${W}px hover: tooltip on screen and not covering the badge`);
    await p.screenshot({ path: `${SHOTS}v6-levels-${W}-tooltip.png`, clip: { x: 0, y: Math.max(0, Math.min(t.t, bb.y) - 80), width: W, height: 260 } });
    await p.mouse.move(2, 2); await p.waitForTimeout(350);
    ok(!(await tipBox(p)), `${W}px hover: moving away hides it`);
    // keyboard
    await target.focus();
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    await p.waitForTimeout(100);
    t = await tipBox(p);
    ok(t && (await target.evaluate((e) => document.activeElement === e)), `${W}px keyboard: Tab onto a badge shows its tooltip`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(80);
    ok(!(await tipBox(p)), `${W}px keyboard: Escape closes it`);
    await Promise.all([p.waitForURL(/\/about#clearance$/), p.keyboard.press('Enter')]);
    ok(true, `${W}px keyboard: Enter on a badge opens /about#clearance`);
  }

  // About section
  await p.goto(BASE + '/about#clearance', { waitUntil: 'networkidle' });
  const sec = p.locator('[data-testid=about-clearance]');
  const txt = await sec.innerText();
  ok((await sec.locator('[data-testid^=clearance-def-]').count()) === 4 && /COSMIC/.test(txt) && /7\+ outlets/i.test(txt), `${W}px /about#clearance: all 4 levels explained`);
  ok(/update automatically/i.test(txt) && /reach, not truth/i.test(txt) && /does not mean/i.test(txt), `${W}px /about: says levels update automatically and reflect reach, not truth`);
  ok(/\bTags\b/i.test(txt) && /Redaction bars/i.test(txt) && /never get a joke tag/.test(txt), `${W}px /about: explains snark tags and redaction bars`);
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${W}px /about: no horizontal scroll`);
  if (!mobile) { await sec.screenshot({ path: `${SHOTS}v6-levels-${W}-about.png` }); }
  else { await sec.screenshot({ path: `${SHOTS}v6-levels-375-about-full.png` }); }

  // trending / category page badges still work
  await p.goto(BASE + '/trending', { waitUntil: 'networkidle' });
  ok((await p.$$eval('a[data-testid=clearance]', (x) => x.length)) >= 5, `${W}px /trending: badges present`);
  await ctx.close();
}

// reduced motion & CRT off: no pulse
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); watch(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok((await p.locator('main a.clr-l4').first().evaluate((e) => getComputedStyle(e).animationName)) === 'none', 'reduced motion: L4 pulse off (glow stays)');
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p2 = await c2.newPage(); watch(p2);
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p2.click('[data-testid=crt-toggle]');
  ok((await p2.locator('main a.clr-l4').first().evaluate((e) => getComputedStyle(e).animationName)) === 'none', 'CRT off: L4 pulse off');
  await p2.click('[data-testid=crt-toggle]');
  await c2.close();
}
ok(errs.length === 0, `console clean${errs.length ? ' — ' + errs.slice(0, 3).join(' | ') : ''}`);
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
