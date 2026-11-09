// Ghost Ticker QA: run against a local production build (next start).
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || '../shots';
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

const b = await chromium.launch();
const consoleIssues = [];
const thirdParty = new Set();
async function newPage(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles', ...opts });
  const p = await ctx.newPage();
  p.on('console', (m) => { if (m.text().includes('status of 404') && p.url().includes('/no-such-dossier')) return; if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(`${p.url()} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', (e) => consoleIssues.push(`${p.url()} [pageerror] ${e.message}`));
  p.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname)) thirdParty.add(`${u.hostname}:${r.resourceType() === 'other' && r.method() === 'GET' && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u.pathname) ? 'image' : r.resourceType()}`); });
  return p;
}

// ---------- desktop home ----------
const p = await newPage();
const res = await p.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('home returns 200', res.status() === 200);
const heads = await p.$$eval('[data-testid=headline] a.headline-link', (as) => as.map((a) => ({ href: a.href, text: a.getAttribute('aria-label') || '', target: a.target, rel: a.rel })));
ok('home shows 40+ live headlines', heads.length >= 40, `${heads.length}`);
ok('every headline links to an external http(s) URL', heads.every((h) => /^https?:\/\//.test(h.href) && !h.href.includes('localhost')));
ok('every headline opens in new tab with noopener', heads.every((h) => h.target === '_blank' && h.rel.includes('noopener')));
const titles = heads.map((h) => h.text.replace(/^FLASH/, '').replace(/\(opens .*\)$/, '').trim().toLowerCase());
ok('no duplicate headlines on home', new Set(titles).size === titles.length, `${titles.length - new Set(titles).size} dupes`);
const feedsOnline = await p.textContent('[data-testid=feeds-online]');
const [on, tot] = feedsOnline.split('/').map(Number);
ok('most feeds answered', on >= tot * 0.75, feedsOnline);
ok('top story banner present', await p.isVisible('[data-testid=top-banner]'));
const sources = new Set(await p.$$eval('[data-testid=source]', (s) => s.map((x) => x.textContent)));
ok('headlines credit 15+ distinct outlets', sources.size >= 15, `${sources.size}`);
const pol = await p.$$eval('[data-testid=section-politics] [data-testid=headline]', (els) => els.map((e) => e.querySelector('[data-testid=lean]')?.textContent));
const leftish = pol.filter((l) => /Left/.test(l || '')).length, rightish = pol.filter((l) => /Right/.test(l || '')).length;
ok('politics column shows lean labels', pol.length >= 8 && pol.every(Boolean), `${pol.length} items`);
ok('politics column mixes left- and right-leaning outlets', leftish >= 2 && rightish >= 2, `left ${leftish} / right ${rightish} / other ${pol.length - leftish - rightish}`);
const polSrc = await p.$$eval('[data-testid=section-politics] [data-testid=source]', (s) => s.map((x) => x.textContent));
const maxPer = Math.max(...Object.values(polSrc.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {})));
ok('no outlet floods politics (<=3 each)', maxPer <= 3, `max ${maxPer}`);
for (const s of ['weird', 'latest', 'us', 'world', 'tech']) {
  const n = await p.$$eval(`[data-testid=section-${s}] [data-testid=headline]`, (e) => e.length);
  ok(`section ${s} has headlines`, n >= 3, `${n}`);
}
// ticker
const tr1 = await p.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
await p.waitForTimeout(1500);
const tr2 = await p.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
ok('ticker scrolls', tr2 < tr1 - 5, `${tr1.toFixed(1)} → ${tr2.toFixed(1)}`);
await p.hover('.ticker-viewport');
await p.waitForTimeout(200);
const h1 = await p.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
await p.waitForTimeout(800);
const h2 = await p.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
ok('ticker pauses on hover', Math.abs(h2 - h1) < 1);
await p.mouse.move(0, 0);
// ad placeholders never cover content
const overlap = await p.evaluate(() => {
  const ads = [...document.querySelectorAll('.ad-slot')].map((e) => e.getBoundingClientRect());
  const items = [...document.querySelectorAll('[data-testid=headline], [data-testid=top-banner]')].map((e) => e.getBoundingClientRect());
  let n = 0;
  for (const a of ads) for (const r of items) if (a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top) n++;
  return { n, ads: ads.length, fixed: [...document.querySelectorAll('.ad-slot')].some((e) => ['fixed', 'absolute', 'sticky'].includes(getComputedStyle(e).position)) };
});
ok('ad placeholders are in-flow and overlap nothing', overlap.ads >= 3 && overlap.n === 0 && !overlap.fixed, `${overlap.ads} slots`);
ok('no ad script loaded (ads off)', !(await p.$('script[src*="googlesyndication"]')));
ok('AdSense pub id meta present', (await p.getAttribute('meta[name="google-adsense-account"]', 'content')) === 'ca-pub-4772936401730421');
ok('noindex robots meta (pre-launch)', /noindex/.test(await p.getAttribute('meta[name="robots"]', 'content')));
ok('OG image meta', (await p.getAttribute('meta[property="og:image"]', 'content'))?.endsWith('/og.png'));
ok('footer copyright', (await p.textContent('[data-testid=copyright]')).includes('© 2026 SushijoeKO. All rights reserved.'));
ok('consent banner hidden for US visitor', !(await p.$('[data-testid=consent]')));
await p.keyboard.press('Tab');
ok('skip link is first focus', (await p.evaluate(() => document.activeElement?.textContent)) === 'Skip to headlines');
await p.screenshot({ path: `${SHOTS}/desktop-home.png` });
await p.screenshot({ path: `${SHOTS}/desktop-home-full.png`, fullPage: true });

// real outbound click: opens the original publisher
const ctx = p.context();
const firstLinks = await p.$$('[data-testid=section-politics] a.headline-link, [data-testid=section-world] a.headline-link, [data-testid=section-weird] a.headline-link');
let opened = 0, tried = 0; const hosts = [];
for (const idx of [0, Math.floor(firstLinks.length / 2), firstLinks.length - 1]) {
  tried++;
  const href = await firstLinks[idx].getAttribute('href');
  const [pop] = await Promise.all([ctx.waitForEvent('page'), firstLinks[idx].click()]);
  try { await pop.waitForLoadState('domcontentloaded', { timeout: 20000 }); } catch {}
  const u = pop.url();
  if (u !== 'about:blank' && new URL(u).hostname.replace(/^www\./, '').split('.').slice(-2).join('.') === new URL(href).hostname.replace(/^www\./, '').split('.').slice(-2).join('.')) opened++;
  hosts.push(new URL(u === 'about:blank' ? href : u).hostname);
  await pop.close();
}
ok('clicking headlines opens the original publisher in a new tab', opened === tried, hosts.join(', '));
thirdParty.clear(); // publisher pages are third-party by design; reset before the site-only check

// ---------- category + static pages ----------
const cats = ['breaking', 'top', 'politics', 'weird', 'us', 'world', 'tech'];
for (const c of cats) {
  const r = await p.goto(`${BASE}/c/${c}`, { waitUntil: 'networkidle' });
  const n = await p.$$eval('[data-testid=headline]', (e) => e.length);
  ok(`/c/${c} loads with headlines`, r.status() === 200 && n >= (c === 'breaking' ? 1 : 10), `${n}`);
  if (c === 'politics') await p.screenshot({ path: `${SHOTS}/desktop-politics.png` });
}
let r2 = await p.goto(`${BASE}/about`, { waitUntil: 'networkidle' });
const srcCount = await p.$$eval('[data-testid^=sources-] li', (e) => e.length);
ok('About/Sources lists every source', r2.status() === 200 && srcCount >= 45, `${srcCount}`);
await p.screenshot({ path: `${SHOTS}/desktop-about.png`, fullPage: true });
r2 = await p.goto(`${BASE}/privacy`); const priv = await p.textContent('main');
ok('privacy page: operator, contact, 13+', r2.status() === 200 && priv.includes('SushijoeKO') && priv.includes('sushijoe6@gmail.com') && /13/.test(priv));
r2 = await p.goto(`${BASE}/terms`); const terms = await p.textContent('main');
ok('terms page: California law, 13+, copyright', r2.status() === 200 && terms.includes('State of California') && /13/.test(terms) && terms.includes('© 2026 SushijoeKO'));
r2 = await p.goto(`${BASE}/no-such-dossier`, { waitUntil: 'networkidle' });
ok('404 page', r2.status() === 404 && (await p.textContent('h1')).includes('Signal lost'));
await p.screenshot({ path: `${SHOTS}/desktop-404.png` });
for (const path of ['/', '/c/weird', '/about', '/privacy', '/terms', '/no-such-dossier']) {
  await p.goto(BASE + path);
  if (!(await p.textContent('[data-testid=copyright]'))?.includes('© 2026 SushijoeKO. All rights reserved.')) ok(`copyright on ${path}`, false);
}
ok('copyright footer on every page', true);
const nonImage = [...thirdParty].filter((h) => !h.endsWith(':image'));
ok('no third-party requests except feed/thumbnail images (no tracking, ads, embeds, Supabase)', nonImage.length === 0, nonImage.join(', ') || `${thirdParty.size} image hosts`);

// ---------- static assets ----------
const req = p.request;
const robots = await (await req.get(BASE + '/robots.txt')).text();
ok('robots.txt disallows all pre-launch', /Disallow: \//.test(robots));
ok('sitemap.xml lists pages', (await (await req.get(BASE + '/sitemap.xml')).text()).includes('/c/politics'));
ok('ads.txt correct', (await (await req.get(BASE + '/ads.txt')).text()).trim() === 'google.com, pub-4772936401730421, DIRECT, f08c47fec0942fa0');
for (const a of ['/og.png', '/favicon.ico', '/icon.svg', '/apple-touch-icon.png']) ok(`${a} served`, (await req.get(BASE + a)).status() === 200);

// ---------- consent ----------
const eu = await newPage({ timezoneId: 'Europe/London' });
await eu.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('consent banner shows for UK/EU time zone', await eu.isVisible('[data-testid=consent]'));
await eu.screenshot({ path: `${SHOTS}/desktop-consent-eu.png` });
await eu.click('[data-testid=consent] button:has-text("Reject")');
ok('consent choice stored and banner closes', !(await eu.$('[data-testid=consent]')) && /denied/.test(await eu.evaluate(() => localStorage.getItem('gt-consent-v1'))));
await eu.reload({ waitUntil: 'networkidle' });
ok('consent not re-asked after choice', !(await eu.$('[data-testid=consent]')));
await eu.click('footer button:has-text("Privacy choices")');
ok('footer Privacy choices reopens banner', await eu.isVisible('[data-testid=consent]'));

// ---------- reduced motion ----------
const rm = await newPage({ reducedMotion: 'reduce' });
await rm.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('ticker respects reduced motion', (await rm.$eval('[data-testid=ticker-track]', (e) => getComputedStyle(e).animationName)) === 'none');

// ---------- mobile ----------
for (const [label, dev] of [['iphone', devices['iPhone 13']], ['android', devices['Pixel 7']]]) {
  const m = await newPage({ ...dev });
  await m.goto(BASE + '/', { waitUntil: 'networkidle' });
  const ov = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(`${label}: no horizontal overflow`, ov <= 1, `${ov}px`);
  const n = await m.$$eval('[data-testid=headline]', (e) => e.length);
  ok(`${label}: headlines render`, n >= 40, `${n}`);
  const t1 = await m.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
  await m.waitForTimeout(1200);
  const t2 = await m.$eval('[data-testid=ticker-track]', (e) => new DOMMatrix(getComputedStyle(e).transform).m41);
  ok(`${label}: ticker scrolls`, t2 < t1 - 3);
  const col = await m.evaluate(() => { const a = document.querySelector('[data-testid=section-politics]').getBoundingClientRect(); const b = document.querySelector('[data-testid=section-latest]').getBoundingClientRect(); return b.top >= a.bottom - 1; });
  ok(`${label}: columns stack on mobile`, col);
  const tapSize = await m.$eval('nav[aria-label=Channels] a', (a) => a.getBoundingClientRect().height);
  ok(`${label}: nav tap targets >= 40px`, tapSize >= 40, `${tapSize.toFixed(0)}px`);
  await m.screenshot({ path: `${SHOTS}/mobile-${label}-home.png` });
  if (label === 'iphone') {
    await m.screenshot({ path: `${SHOTS}/mobile-iphone-home-full.png`, fullPage: true });
    await m.goto(BASE + '/c/weird', { waitUntil: 'networkidle' });
    await m.screenshot({ path: `${SHOTS}/mobile-iphone-weird.png` });
  }
}

ok('console clean (no errors/warnings) on all pages', consoleIssues.length === 0, consoleIssues.slice(0, 5).join(' | '));
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
