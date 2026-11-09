// Image coverage on the home page: share of cards (top story + every headline) showing a real, loaded photo.
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const LABEL = process.env.LABEL || 'run';
const b = await chromium.launch();
const out = {};
for (const [name, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['mobile', devices['iPhone 13']]]) {
  const p = await (await b.newContext(opts)).newPage();
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll('img[data-testid=thumb]')].every((i) => i.complete), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(1000);
  const cards = await p.$$eval('[data-testid=top-banner], [data-testid=headline]', (els) => els.map((e) => {
    const img = e.querySelector('img[data-testid=thumb]');
    const real = !!img && img.complete && img.naturalWidth > 0;
    const ph = !!e.querySelector('[data-testid=thumb-placeholder]');
    const lead = e.matches('[data-testid=top-banner], li.headline-card');
    const src = (e.querySelector('[data-testid=source]') || e.querySelector('.text-red-300'))?.textContent?.trim() || '?';
    const sec = e.closest('section[data-testid]')?.getAttribute('data-testid') || 'top';
    return { real, ph, lead, src, sec };
  }));
  const n = cards.length, real = cards.filter((c) => c.real).length;
  const leads = cards.filter((c) => c.lead), leadReal = leads.filter((c) => c.real).length;
  const miss = {};
  for (const c of cards.filter((c) => !c.real)) miss[c.src] = (miss[c.src] || 0) + 1;
  out[name] = { cards: n, realImage: real, pct: +(100 * real / n).toFixed(1), placeholders: cards.filter((c) => c.ph).length, leads: leads.length, leadsWithImage: leadReal, leadPh: leads.filter((c) => c.ph).map((c) => `${c.sec}:${c.src}`), fallbackOutlets: Object.entries(miss).sort((a, b) => b[1] - a[1]) };
  console.log(LABEL, name, JSON.stringify(out[name]));
}
await b.close();
