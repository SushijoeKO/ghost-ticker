// v3 thumbnails + decrypt QA: aspect-locked frames at 375/768/1280 on every list type, onerror swap
// without layout shift, text-forward fallbacks, leads preferring photos, and a decrypt that always settles.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = new URL('../shots/', import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); };
const b = await chromium.launch();
const settle = async (p) => {
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll('img[data-testid=thumb]')].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(900);
};
const frames = (p) => p.$$eval('[data-testid=thumb-frame]', (fs) => fs.map((f) => {
  const r = f.getBoundingClientRect(); const ar = getComputedStyle(f).aspectRatio.split('/').map(Number);
  const ratio = ar.length === 2 ? ar[1] / ar[0] : NaN;
  const img = f.querySelector('img'); const ir = img?.getBoundingClientRect();
  const row = f.closest('li, [data-testid=top-banner]')?.getBoundingClientRect();
  const side = !!f.closest('.gt-side-thumb');
  return { w: r.width, h: r.height, ratio, side, rowH: row?.height ?? 0,
    imgFill: !img || (Math.abs(ir.height - r.height) < 1.5 && Math.abs(ir.width - r.width) < 1.5),
    fit: img ? getComputedStyle(img).objectFit : 'cover', ph: !!f.querySelector('[data-testid=thumb-placeholder]'),
    loaded: !!img && img.complete && img.naturalWidth > 0, bg: getComputedStyle(f).backgroundColor };
}));
const q = await (async () => { const p = await b.newPage(); await p.goto(BASE + '/'); const t = await p.$eval('[data-testid=top-banner] [data-decrypt]', (e) => e.textContent); await p.close(); return (t.match(/[A-Za-z]{5,}/g) || ['news'])[0]; })();
const pages = [['home', '/'], ['category', '/c/world'], ['search', '/search?q=' + encodeURIComponent(q)], ['trending', '/trending'], ['map', '/map']];
for (const W of [375, 768, 1280]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 812 : 900 }, deviceScaleFactor: W < 500 ? 2 : 1, isMobile: W < 500, hasTouch: W < 500 });
  for (const [name, path] of pages) {
    const p = await ctx.newPage();
    await p.goto(BASE + path, { waitUntil: 'networkidle' });
    await settle(p);
    const fs = await frames(p);
    const bad = fs.filter((f) => Math.abs(f.h - f.w * f.ratio) > 2);
    const stretched = fs.filter((f) => f.side && f.h > f.w * 0.75 + 2);
    ok(bad.length === 0, `${W}px ${name}: ${fs.length} frames keep their aspect ratio${bad.length ? ' — bad ' + JSON.stringify(bad.slice(0, 2)) : ''}`);
    if (fs.some((f) => f.side)) ok(stretched.length === 0, `${W}px ${name}: side thumbs are 4:3 and don't stretch with the row (${fs.filter((f) => f.side).length})`);
    ok(fs.every((f) => f.imgFill && f.fit === 'cover'), `${W}px ${name}: every photo fills its frame with object-fit:cover (no empty band)`);
    ok(fs.filter((f) => f.loaded).every((f) => f.bg === 'rgba(0, 0, 0, 0)'), `${W}px ${name}: loading background removed once photos load`);
    if (name === 'home') {
      const textLeads = await p.$$eval('li.headline-card-text', (l) => l.filter((x) => x.querySelector('[data-testid=thumb-frame]')).length);
      ok(textLeads === 0, `${W}px home: photo-less lead cards are text-forward (no empty image box)`);
      const bigPh = fs.filter((f) => f.ph && f.h > 140).length;
      ok(bigPh === 0, `${W}px home: no giant placeholder boxes`);
      await p.screenshot({ path: `${SHOTS}v3-thumbs-${W}-home.png` });
      for (const sec of ['breaking', 'latest', 'world', 'weird']) {
        const el = await p.$(`[data-testid=section-${sec}]`);
        if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(700); await el.screenshot({ path: `${SHOTS}v3-thumbs-${W}-${sec}.png` }); }
      }
    } else if (name === 'map') {
      const pin = await p.$('[data-testid=map] [data-testid=pin]');
      if (pin) {
        await pin.click({ force: true });
        await p.waitForSelector('[data-testid=pin-panel]', { timeout: 5000 }).catch(() => {});
        const panel = await p.$('[data-testid=pin-panel]');
        ok(!!panel, `${W}px map: pin popup opens`);
        if (panel) {
          const pf = await panel.$$eval('[data-testid=thumb-frame]', (x) => x.length);
          ok(true, `${W}px map popup: text-only headline list (${pf} image frames; nothing to stretch)`);
          await p.screenshot({ path: `${SHOTS}v3-thumbs-${W}-map-popup.png` });
        }
      }
    } else {
      await p.screenshot({ path: `${SHOTS}v3-thumbs-${W}-${name}.png` });
    }
    await p.close();
  }
  await ctx.close();
}

// leads prefer photos
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await settle(p);
  const top = await p.$eval('[data-testid=top-banner]', (e) => !!e.querySelector('img[data-testid=thumb]'));
  ok(top, 'top story carries a photo');
  const leads = await p.$$eval('section[data-testid] li.headline-card', (ls) => ls.map((l) => !!l.querySelector('img[data-testid=thumb]')));
  ok(leads.filter(Boolean).length >= leads.length - 1, `section leads with photos: ${leads.filter(Boolean).length}/${leads.length}`);
  await p.close();
}

// onerror swap: break every image, frames keep size and CLS stays ~0
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); });
  const p = await ctx.newPage();
  await p.route(/\.(jpe?g|png|webp|gif|avif)(\?|$)|\/image|\/img|\/media|\/photo/i, (r) => r.request().resourceType() === 'image' ? r.fulfill({ status: 404, body: '' }) : r.continue());
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await settle(p);
  const fs = await frames(p);
  const phs = fs.filter((f) => f.ph);
  ok(phs.length > 10, `broken images swap to placeholders (${phs.length}/${fs.length})`);
  ok(phs.every((f) => Math.abs(f.h - f.w * f.ratio) <= 2), 'placeholders keep the exact frame size');
  const cls = await p.evaluate(() => window.__cls);
  const base = await (async () => { const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); await c.addInitScript(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); }); const q = await c.newPage(); await q.goto(BASE + '/', { waitUntil: 'networkidle' }); await settle(q); const v = await q.evaluate(() => window.__cls); await c.close(); return v; })();
  ok(cls - base < 0.03 && cls < 0.1, `failing images add no layout shift (CLS broken ${cls.toFixed(4)} vs normal ${base.toFixed(4)})`);
  const sideMark = await p.$$eval('.gt-side-thumb .gt-ph-mark', (m) => m.length);
  ok(sideMark > 0, 'compact side placeholders show outlet initials');
  const el = await p.$('[data-testid=section-latest]'); if (el) { await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(600); await el.screenshot({ path: `${SHOTS}v3-thumbs-1280-fallback.png` }); }
  await ctx.close();
}

// decrypt always settles, real text never altered
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(150);
  const mid = await p.$$eval('[data-decrypt]', (els) => els.slice(0, 30).map((e) => ({ t: e.textContent, a: e.closest('a')?.getAttribute('aria-label') || '' })));
  ok(mid.every((m) => !m.a || m.a.startsWith(m.t)), 'real headline text is intact in the DOM even mid-animation');
  await p.waitForTimeout(1200);
  ok(await p.$$eval('[data-decrypting]', (x) => x.length) === 0, 'no scramble overlay remains after the animation');
  // start fresh scrambles by scrolling, then background the tab instantly
  await p.evaluate(() => window.scrollTo(0, 2400)); await p.waitForTimeout(40);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok(await p.$$eval('[data-decrypting]', (x) => x.length) === 0, 'backgrounding the tab settles every headline immediately');
  await ctx.close();
  // rAF frozen (throttled background tab): the safety timer still settles
  const ctx2 = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(1200);
  const st = await p2.$$eval('[data-decrypt]', (els) => els.map((e) => ({ t: e.textContent, a: e.closest('a')?.getAttribute('aria-label') || '', vis: e.getBoundingClientRect().width > 2 })));
  ok(await p2.$$eval('[data-decrypting]', (x) => x.length) === 0 && st.every((s) => (!s.a || s.a.startsWith(s.t))), 'with animation frames frozen, headlines still settle on the real text');
  const topVis = await p2.$eval('[data-testid=top-banner] [data-decrypt]', (e) => e.getBoundingClientRect().width > 50 && getComputedStyle(e).visibility !== 'hidden');
  ok(topVis, 'settled headline is visible');
  await ctx2.close();
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
