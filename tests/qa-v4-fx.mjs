// v4 FX QA: decrypt (once, leads only, aligned, always settles, no CLS) and redaction bars (black ink,
// real data, hover/focus/tap/keyboard reveal, inline wrapping) at 375/768/1280, plus frame captures.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const b = await chromium.launch();
const CLS = () => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); };
const realText = (sel) => `[...document.querySelectorAll('${sel}')].every((e) => { const a = e.closest('a')?.getAttribute('aria-label') || ''; return !a || a.startsWith(e.textContent); })`;

for (const W of [375, 768, 1280]) {
  const mobile = W < 500;
  const ctx = await b.newContext(mobile ? { ...devices['iPhone 13'], viewport: { width: 375, height: 812 } } : { viewport: { width: W, height: 900 } });
  await ctx.addInitScript(CLS);
  const p = await ctx.newPage();
  const errs = []; p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // sample the animation
  const samples = await p.evaluate(async () => {
    const h2 = document.querySelector('[data-testid=top-banner] h2');
    const out = []; const t0 = performance.now();
    while (performance.now() - t0 < 1600) {
      const playing = [...document.querySelectorAll('[data-decrypting]')];
      out.push({ t: Math.round(performance.now() - t0), n: playing.length, h: h2.getBoundingClientRect().height, w: h2.getBoundingClientRect().width,
        where: playing.map((e) => e.closest('[data-testid=top-banner]') ? 'top' : e.closest('li.headline-card') ? 'lead' : 'row'),
        real: [...document.querySelectorAll('[data-decrypt]')].every((e) => { const a = e.closest('a')?.getAttribute('aria-label') || ''; return !a || a.startsWith(e.textContent); }) });
      await new Promise((r) => setTimeout(r, 40));
    }
    return out;
  });
  const sawTop = samples.some((s) => s.where.includes('top'));
  ok(sawTop, `${W}px: top story decrypts on first view`);
  ok(Math.max(...samples.map((s) => s.n)) <= 2, `${W}px: at most 2 headlines decrypt at once (max ${Math.max(...samples.map((s) => s.n))})`);
  ok(samples.every((s) => s.where.every((w) => w !== 'row')), `${W}px: only the top story and section leads decrypt, never list rows`);
  ok(samples.every((s) => s.real), `${W}px: real headline text stays in the DOM in every frame`);
  ok(new Set(samples.map((s) => s.h)).size === 1, `${W}px: top headline box never changes size while decrypting (no rewrap; heights ${[...new Set(samples.map((s) => s.h))].join(',')})`);
  const topRun = samples.filter((s) => s.where.includes('top'));
  const dur = topRun.length ? topRun[topRun.length - 1].t - topRun[0].t : 0;
  ok(dur >= 450 && dur <= 1000, `${W}px: top story settles in ~600-900 ms (observed ${dur} ms)`);
  // mid frame capture: replay by clearing seen list in a fresh page of the same context
  await p.evaluate(() => localStorage.removeItem('gt-decrypted'));
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForSelector('[data-testid=top-banner] [data-decrypting]', { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(200);
  const h2 = await p.$('[data-testid=top-banner] h2');
  await h2.screenshot({ path: `${SHOTS}v4-fx-${W}-decrypt-mid.png` });
  const glyphsAligned = await p.$$eval('[data-testid=top-banner] .gt-ch', (cs) => cs.slice(0, 40).every((c) => { const r = c.getBoundingClientRect(); const a = getComputedStyle(c, '::after'); return (r.width > 0 || /\s/.test(c.textContent)) && a.position === 'absolute'; }));
  if (!glyphsAligned) console.log(await p.$$eval('[data-testid=top-banner] .gt-ch', (cs) => cs.slice(0, 40).filter((c) => !(c.getBoundingClientRect().width > 0 && getComputedStyle(c, '::after').position === 'absolute')).map((c) => JSON.stringify(c.textContent) + ' w' + c.getBoundingClientRect().width + ' ' + getComputedStyle(c, '::after').position)));
  ok(glyphsAligned, `${W}px: scramble glyphs are painted over each real character (same box, same wrapping)`);
  await p.waitForTimeout(1300);
  ok(await p.$$eval('[data-decrypting], .gt-ch', (x) => x.length) === 0, `${W}px: nothing left mid-scramble after settle`);
  await h2.screenshot({ path: `${SHOTS}v4-fx-${W}-decrypt-settled.png` });
  // no replay on refresh
  await p.reload({ waitUntil: 'domcontentloaded' });
  const replay = await p.evaluate(async () => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 1500) { if (document.querySelector('[data-testid=top-banner] [data-decrypting]')) n++; await new Promise((r) => setTimeout(r, 50)); } return n; });
  ok(replay === 0, `${W}px: a refresh does not replay the same story`);
  const cls = await p.evaluate(() => window.__cls);
  ok(cls < 0.02, `${W}px: no layout shift from the effects (CLS ${cls.toFixed(4)})`);

  // redaction bars
  const red = p.locator('[data-testid=top-banner] [data-testid=redacted]').first();
  await red.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  const st = await red.evaluate((e) => { const t = e.querySelector('.redacted-text'); const cs = getComputedStyle(t); return { disp: getComputedStyle(e).display, role: e.getAttribute('role'), exp: e.getAttribute('aria-expanded'), label: e.getAttribute('aria-label'), text: t.textContent, color: cs.color, bg: cs.backgroundImage, bgc: cs.backgroundColor }; });
  ok(st.role === 'button' && st.exp === 'false' && /Redacted .+: .+/.test(st.label || ''), `${W}px: bar is a keyboard button with aria-expanded and a readable label ("${st.label}")`);
  ok(st.text.trim().length > 1 && st.color === 'rgba(0, 0, 0, 0)' && st.bg.includes("fill='%23000'") && st.bgc === 'rgba(0, 0, 0, 0)', `${W}px: bar is black marker ink hiding real data ("${st.text}")`);
  ok(st.disp === 'inline', `${W}px: bars wrap inline with the sentence`);
  const note = p.locator('[data-testid=top-banner] [data-testid=agent-note]');
  const noteText = await note.textContent();
  ok(!/\d+ outlets?\b/.test(noteText) || /single-source/.test(noteText) || /corroborated by \S/.test(noteText), `${W}px: note hides outlet names / location from the story data`);
  await note.screenshot({ path: `${SHOTS}v4-fx-${W}-redacted.png` });
  if (mobile) {
    await red.tap(); await p.waitForTimeout(450);
    ok(await red.getAttribute('aria-expanded') === 'true' && await red.evaluate((e) => getComputedStyle(e.firstChild).color) !== 'rgba(0, 0, 0, 0)', `${W}px: tap declassifies`);
    await note.screenshot({ path: `${SHOTS}v4-fx-${W}-revealed.png` });
    await red.tap(); await p.waitForTimeout(450);
    ok(await red.getAttribute('aria-expanded') === 'false', `${W}px: second tap re-redacts`);
    await red.tap(); await p.waitForTimeout(100); await p.tap('[data-testid=top-banner] h2 + p', { force: true }).catch(() => p.mouse.click(5, 5)); await p.waitForTimeout(450);
    ok(await red.getAttribute('aria-expanded') === 'false', `${W}px: tapping elsewhere (blur) re-redacts`);
  } else {
    await red.hover(); await p.waitForTimeout(500);
    const hc = await red.evaluate((e) => [getComputedStyle(e.firstChild).color, getComputedStyle(e.firstChild).backgroundSize]);
    ok(hc[0] !== 'rgba(0, 0, 0, 0)' && hc[1].startsWith('0%'), `${W}px: hover wipes the ink away (${hc.join(' / ')})`);
    await note.screenshot({ path: `${SHOTS}v4-fx-${W}-revealed.png` });
    await p.mouse.move(2, 2); await p.waitForTimeout(500);
    ok(await red.evaluate((e) => getComputedStyle(e.firstChild).color) === 'rgba(0, 0, 0, 0)', `${W}px: moving away re-redacts`);
  }
  // keyboard
  await red.focus(); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); await p.waitForTimeout(450);
  const kb = await red.evaluate((e) => [document.activeElement === e, getComputedStyle(e.firstChild).color]);
  ok(kb[0] && kb[1] !== 'rgba(0, 0, 0, 0)', `${W}px: keyboard focus declassifies`);
  if (W === 1280) await note.screenshot({ path: `${SHOTS}v4-fx-${W}-keyboard.png` });
  await p.keyboard.press('Enter');
  ok(await red.getAttribute('aria-expanded') === 'true', `${W}px: Enter toggles aria-expanded`);
  await p.keyboard.press('Escape');
  ok(await red.getAttribute('aria-expanded') === 'false', `${W}px: Escape re-redacts`);
  await p.keyboard.press('Space');
  ok(await red.getAttribute('aria-expanded') === 'true', `${W}px: Space toggles`);
  await p.keyboard.press('Tab'); await p.waitForTimeout(100);
  ok(await red.getAttribute('aria-expanded') === 'false', `${W}px: blur re-redacts`);
  // CRT layer must not wash the ink: bar sits above the scanline layer
  ok(await red.evaluate((e) => getComputedStyle(e.firstChild).zIndex === '41' && document.documentElement.classList.contains('crt')), `${W}px: bars sit above the CRT scanline layer`);
  const sec = p.locator('section[data-testid=section-world]');
  if (await sec.count()) { await sec.scrollIntoViewIfNeeded(); await p.waitForTimeout(1200); await sec.screenshot({ path: `${SHOTS}v4-fx-${W}-section.png` }); }
  ok(errs.length === 0, `${W}px: console clean${errs.length ? ' — ' + errs.slice(0, 2).join(' | ') : ''}`);
  await ctx.close();
}

// reduced motion, CRT off, frozen animation frames, hidden tab
for (const [label, setup] of [
  ['reduced motion', { reducedMotion: 'reduce' }],
  ['CRT/FX off', { init: () => localStorage.setItem('gt-crt', 'off') }],
]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: setup.reducedMotion });
  if (setup.init) await ctx.addInitScript(setup.init);
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  const n = await p.evaluate(async () => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 1500) { n += document.querySelectorAll('[data-decrypting]').length; await new Promise((r) => setTimeout(r, 50)); } return n; });
  ok(n === 0, `${label}: no decrypt animation`);
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  ok(await p.$$eval('[data-decrypting], .gt-ch', (x) => x.length) === 0, 'animation frames frozen: headlines still settle on the real text');
  await ctx.close();
  const c2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const q = await c2.newPage();
  await q.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await q.waitForSelector('[data-decrypting]', { timeout: 4000 }).catch(() => {});
  await q.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await q.waitForTimeout(80);
  ok(await q.$$eval('[data-decrypting], .gt-ch', (x) => x.length) === 0, 'backgrounding the tab settles immediately');
  await c2.close();
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
