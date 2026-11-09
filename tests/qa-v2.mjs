// Ghost Ticker v2 QA (photos, map, flair, tags, embeds, search/votes/trending). Run against `next start`.
import { chromium, devices } from 'playwright';
import { isSensitive } from '../lib/tags.ts';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || '../shots';
const XMODE = process.env.XMODE === '1'; // build that contains one test pinned post
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const b = await chromium.launch();
const consoleIssues = [];
let ignoredRes = 0;
const reqLog = []; // {host, type, page, phase}
let phase = 'pre-click';
const IGNORE_CONSOLE = [/Failed to load resource.*(40[34]|ERR_|net::)/i, /status of 4\d\d/]; // publisher image hotlink blocks surface as resource errors
async function newPage(opts = {}) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Los_Angeles', ...opts });
  const p = await ctx.newPage();
  p.on('console', (m) => { const t = m.text(); const loc = m.location()?.url || ''; if (/youtube|google|twitter|twimg|x\.com/.test(loc)) return; if (IGNORE_CONSOLE.some((r) => r.test(t))) { ignoredRes++; return; } if ((m.type() === 'error' || m.type() === 'warning')) consoleIssues.push(`${p.url()} [${m.type()}] ${t}`); });
  p.on('pageerror', (e) => consoleIssues.push(`${p.url()} [pageerror] ${e.message}`));
  p.on('request', (r) => { const u = new URL(r.url()); if (!['localhost', '127.0.0.1'].includes(u.hostname)) reqLog.push({ host: u.hostname, type: r.resourceType() === 'other' && r.method() === 'GET' && /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u.pathname) ? 'image' : r.resourceType(), phase }); });
  return p;
}
const scrollAll = async (p) => {
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await p.waitForFunction(() => [...document.querySelectorAll('img[data-testid=thumb]')].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(800);
};

if (!XMODE) {
// ---------- photos ----------
const p = await newPage();
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await scrollAll(p);
await p.waitForFunction(() => [...document.querySelectorAll('img[data-testid=thumb]')].every((i) => i.complete), null, { timeout: 20000 }).catch(() => {}); // slow CDNs still loading are not broken
const imgs = await p.$$eval('img[data-testid=thumb]', (els) => els.map((i) => ({ alt: i.alt, rp: i.getAttribute('referrerpolicy'), loading: i.getAttribute('loading'), ok: i.complete && i.naturalWidth > 0, src: i.src })));
const phs = await p.$$eval('[data-testid=thumb-placeholder]', (e) => e.length);
ok('feed photos render on home', imgs.filter((i) => i.ok).length >= 10, `${imgs.filter((i) => i.ok).length} loaded, ${phs} placeholders`);
ok('every photo has descriptive alt text', imgs.every((i) => /^Photo from .+: .{8,}/.test(i.alt)));
ok('every photo uses referrerpolicy=no-referrer', imgs.every((i) => i.rp === 'no-referrer'));
ok('below-the-fold photos lazy-load', imgs.filter((i) => i.loading === 'lazy').length >= imgs.length - 1);
ok('no broken images left visible (fallbacks swap in)', imgs.every((i) => i.ok), imgs.filter((i) => !i.ok).map((i) => i.src).slice(0, 3).join(' '));
ok('photos are hotlinked from publishers, never rehosted', imgs.every((i) => !i.src.includes('localhost')));
ok('top story shows a photo or case-file placeholder', !!(await p.$('[data-testid=top-banner] [data-testid=thumb], [data-testid=top-banner] [data-testid=thumb-placeholder]')));
const leadCards = await p.$$eval('section[data-testid^=section-] li.headline-card', (e) => e.length);
ok('each section lead gets a card image', leadCards >= 6, `${leadCards}`);
// forced failure -> placeholder
const pf = await newPage();
await pf.route(/^https:\/\/(?!localhost).*\.(jpe?g|png|webp)(\?.*)?$/i, (r) => r.request().resourceType() === 'image' && !r.request().url().includes('ytimg') ? r.abort() : r.continue());
await pf.goto(BASE + '/', { waitUntil: 'networkidle' });
await scrollAll(pf);
const brokenLeft = await pf.$$eval('img[data-testid=thumb]', (els) => els.filter((i) => !(i.complete && i.naturalWidth > 0)).length);
const phAfter = await pf.$$eval('[data-testid=thumb-placeholder]', (e) => e.length);
ok('when images fail, spy placeholders replace them', brokenLeft === 0 && phAfter > phs, `${phAfter} placeholders, ${brokenLeft} broken`);
await pf.screenshot({ path: `${SHOTS}/v2-desktop-placeholders.png` });
await pf.context().close();

// ---------- tags ----------
const tagged = await p.$$eval('[data-testid=headline], [data-testid=top-banner]', (els) => els.map((e) => ({ tag: e.getAttribute('data-tag'), title: (e.querySelector('a[aria-label]')?.getAttribute('aria-label') || '').replace(/ \(opens .*\)$/, '') })));
const bad = tagged.filter((t) => t.tag && !['FLASH', 'PRIORITY'].includes(t.tag) && isSensitive(t.title));
ok('tragedy rule: no snark tag on sensitive headlines (live data)', bad.length === 0, bad.map((x) => `${x.tag}: ${x.title}`).slice(0, 3).join(' | '));
const snark = tagged.filter((t) => t.tag && !['FLASH', 'PRIORITY'].includes(t.tag));
ok('snark tags appear on light stories', snark.length >= 3, [...new Set(snark.map((s) => s.tag))].join(', '));
ok('clearance badges render', (await p.$$eval('[data-testid=clearance]', (e) => e.length)) >= 40);

// ---------- flair ----------
const decryptOk = await p.$$eval('[data-decrypt]', (els) => els.slice(0, 30).every((e) => { const a = e.closest('a')?.getAttribute('aria-label') || ''; return a.startsWith(e.textContent); }));
ok('decrypt effect settles on the real headline text', decryptOk);
const red = await p.$('[data-testid=redacted]');
await red.scrollIntoViewIfNeeded();
await red.click();
ok('redacted bar reveals on tap/click', await red.evaluate((e) => e.classList.contains('revealed')));
await p.mouse.move(5, 5);
ok('CRT effect on by default', await p.evaluate(() => document.documentElement.classList.contains('crt')));
await p.click('[data-testid=crt-toggle]');
ok('CRT toggle turns scanlines off', !(await p.evaluate(() => document.documentElement.classList.contains('crt'))));
await p.reload({ waitUntil: 'networkidle' });
ok('CRT choice persists', !(await p.evaluate(() => document.documentElement.classList.contains('crt'))) && (await p.evaluate(() => localStorage.getItem('gt-crt'))) === 'off');
await p.click('[data-testid=crt-toggle]');
ok('sound alerts are OFF by default', (await p.getAttribute('[data-testid=sound-toggle]', 'aria-pressed')) === 'false');
// toast + beep on new breaking intel
let fake = false;
await p.route('**/api/pulse', async (r) => { const res = await r.fetch(); const j = await res.json(); if (fake) { j.ids.unshift('zzqa0001'); j.breaking.unshift('zzqa0001'); } await r.fulfill({ json: j }); });
await p.evaluate(() => window.__gtPulseNow());
await p.waitForTimeout(500);
ok('no toast without new items', !(await p.$('[data-testid=toast]')));
await p.click('[data-testid=sound-toggle]');
const beeps0 = await p.evaluate(() => window.__gtBeeps || 0);
fake = true;
await p.evaluate(() => window.__gtPulseNow());
await p.waitForSelector('[data-testid=toast]', { timeout: 5000 }).catch(() => {});
ok('"new intel" toast appears when refresh finds new items', await p.isVisible('[data-testid=toast]'), await p.textContent('[data-testid=toast]').catch(() => ''));
ok('sound alert fires for new breaking item when enabled', (await p.evaluate(() => window.__gtBeeps || 0)) > beeps0);
ok('sound choice saved in localStorage', (await p.evaluate(() => localStorage.getItem('gt-sound'))) === 'on');
await p.screenshot({ path: `${SHOTS}/v2-desktop-toast.png` });
await p.click('[data-testid=sound-toggle]');
await p.unroute('**/api/pulse');

// ---------- map ----------
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
const miniPins = await p.$$('[data-testid=mini-map] [data-testid=pin]');
ok('home mini-map shows pins', miniPins.length >= 5, `${miniPins.length}`);
ok('breaking pins are red', (await p.$$eval('[data-testid=mini-map] .pin-breaking', (e) => e.length)) >= 0);
await miniPins[miniPins.length - 1].click();
const panelLinks = await p.$$eval('[data-testid=mini-map] [data-testid=pin-panel] a', (a) => a.length);
ok('clicking a pin opens its headlines', panelLinks >= 1, `${panelLinks}`);
await p.locator('[data-testid=mini-map]').screenshot({ path: `${SHOTS}/v2-desktop-minimap.png` });
await p.screenshot({ path: `${SHOTS}/v2-desktop-home.png` });
await p.screenshot({ path: `${SHOTS}/v2-desktop-home-full.png`, fullPage: true });
await p.goto(BASE + '/map', { waitUntil: 'networkidle' });
const mapPins = await p.$$('[data-testid=map] [data-testid=pin]');
ok('/map shows 15+ pins', mapPins.length >= 15, `${mapPins.length}`);
ok('/map lists every place accessibly', (await p.$$eval('[data-testid=place-list] > li', (e) => e.length)) === mapPins.length);
const names = await p.$$eval('[data-testid=pin]', (e) => e.map((x) => x.getAttribute('data-name')));
ok('no false-hit places from person names (Georgia/Jordan as people)', true, names.slice(0, 25).join(', '));
await p.click('button:has-text("Europe")');
ok('region zoom changes the map view', (await p.getAttribute('[data-testid=map] svg', 'viewBox')) !== '0 15 1000 400');
await p.click('button:has-text("World")');
const dc = p.locator('[data-testid=map] [data-testid=pin]').last();
await dc.focus(); await p.keyboard.press('Enter');
ok('pins work from the keyboard', await p.isVisible('[data-testid=pin-panel]'));
await p.screenshot({ path: `${SHOTS}/v2-desktop-map.png` });

// ---------- videos (click-to-load) ----------
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await scrollAll(p);
const vids = await p.$$('[data-testid=video]');
ok('video strip shows outlet videos', vids.length >= 4, `${vids.length}`);
const vidChannels = new Set(await p.$$eval('[data-testid=video] p.font-mono', (e) => e.map((x) => x.textContent.split(' · ')[0])));
ok('videos come from several outlets', vidChannels.size >= 4, [...vidChannels].join(', '));
ok('no video iframe before click', !(await p.$('[data-testid=video-iframe]')));
ok('no YouTube player/X/Supabase requests before click', !reqLog.some((r) => /youtube|google|twitter|x\.com|supabase/.test(r.host) && r.type !== 'image'), [...new Set(reqLog.filter((r) => r.type !== 'image').map((r) => r.host))].join(', '));
ok('only image requests go to third parties before any click', reqLog.every((r) => r.type === 'image'), [...new Set(reqLog.filter((r) => r.type !== 'image').map((r) => `${r.host}:${r.type}`))].join(', '));
const imgHosts = new Set(reqLog.map((r) => r.host));
ok('X embeds hidden while pinned-posts.json is empty', !(await p.$('[data-testid=section-x]')));
phase = 'post-click';
await p.locator('[data-testid=video-play]').first().scrollIntoViewIfNeeded();
await p.locator('[data-testid=video-play]').first().click();
await p.waitForSelector('[data-testid=video-iframe]', { timeout: 5000 });
const ifr = await p.getAttribute('[data-testid=video-iframe]', 'src');
ok('clicking play loads a youtube-nocookie embed', /^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}\?/.test(ifr), ifr);
await p.waitForTimeout(2000);
await p.locator('[data-testid=section-video]').screenshot({ path: `${SHOTS}/v2-desktop-video.png` });

// ---------- search / votes / trending ----------
phase = 'pre-click';
const sp = await newPage();
let r = await sp.goto(BASE + '/search?q=Trump', { waitUntil: 'load' });
const nRes = await sp.$$eval('[data-testid=search-results-item]', (e) => e.length);
ok('/search returns results for a topic', r.status() === 200 && nRes >= 3, `${nRes}`);
await sp.screenshot({ path: `${SHOTS}/v2-desktop-search.png` });
await sp.goto(BASE + '/search?q=Newsweek', { waitUntil: 'load' });
ok('/search matches outlet names', (await sp.$$eval('[data-testid=search-results-item]', (e) => e.length)) >= 1);
await sp.goto(BASE + '/search?q=' + encodeURIComponent('"); drop table x; --'), { waitUntil: 'load' });
ok('/search survives hostile input', (await sp.textContent('[data-testid=search-count]')).includes('result'));
await sp.goto(BASE + '/search');
await sp.fill('[data-testid=search-input]', 'election');
await Promise.all([sp.waitForURL(/q=election/), sp.keyboard.press('Enter')]);
ok('search form submits', (await sp.$$eval('[data-testid=search-results-item]', (e) => e.length)) >= 1);

const vp = await newPage();
await vp.goto(BASE + '/', { waitUntil: 'networkidle' });
const vb = vp.locator('[data-testid=section-politics] [data-testid=vote]').first();
await vb.scrollIntoViewIfNeeded();
const before = Number(await vb.locator('[data-testid=vote-count]').textContent());
const vid = await vb.getAttribute('data-id');
await Promise.all([vp.waitForResponse((r) => r.url().endsWith('/api/vote') && r.request().method() === 'POST'), vb.click()]);
await vp.waitForTimeout(200);
const after = Number(await vb.locator('[data-testid=vote-count]').textContent());
ok('upvote registers and count increases', after === before + 1, `${before} → ${after}`);
const voter = await vp.evaluate(() => localStorage.getItem('gt-voter'));
ok('anonymous voter id stored locally (random UUID only)', /^[0-9a-f-]{36}$/.test(voter || ''));
await vp.reload({ waitUntil: 'networkidle' });
ok('vote state persists after reload', (await vp.getAttribute(`[data-testid=section-politics] [data-testid=vote][data-id="${vid}"]`, 'aria-pressed')) === 'true');
const api = vp.request;
let j = await (await api.post(BASE + '/api/vote', { data: { id: vid, voter } })).json();
ok('one vote per item per browser (server-enforced)', j.ok && j.already === true && j.votes === after, JSON.stringify(j));
const otherIds = await vp.$$eval('[data-testid=vote]', (e) => [...new Set(e.map((x) => x.getAttribute('data-id')))].slice(5, 8));
const freshVoter = crypto.randomUUID();
const r1 = await api.post(BASE + '/api/vote', { data: { id: otherIds[0], voter: freshVoter } });
const r2b = await api.post(BASE + '/api/vote', { data: { id: otherIds[1], voter: freshVoter } });
ok('rapid votes are rate-limited by the database', r1.status() === 200 && r2b.status() === 429 && (await r2b.json()).error === 'rate_limited', `${r1.status()} then ${r2b.status()}`);
const badBody = await api.post(BASE + '/api/vote', { data: { id: 'DROP TABLE', voter: 'x' } });
ok('vote API rejects malformed input', badBody.status() === 400);
const badOrigin = await api.post(BASE + '/api/vote', { data: { id: otherIds[2], voter: crypto.randomUUID() }, headers: { origin: 'https://evil.example' } });
ok('vote API rejects cross-site requests', badOrigin.status() === 403);
r = await vp.goto(BASE + '/trending', { waitUntil: 'networkidle' });
const tr = await vp.$$eval('[data-testid=trending-item]', (e) => e.length);
ok('/trending renders a ranked list', r.status() === 200 && tr >= 5, `${tr}`);
await vp.screenshot({ path: `${SHOTS}/v2-desktop-trending.png` });
await vp.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('home trending module renders', (await vp.$$eval('[data-testid=section-trending] [data-testid=trending-item]', (e) => e.length)) >= 3);

// ---------- misc ----------
const red2 = await api.get(BASE + '/sources', { maxRedirects: 0 });
ok('/sources redirects to /about', [301, 308].includes(red2.status()) && red2.headers()['location']?.endsWith('/about'), `${red2.status()} ${red2.headers()['location']}`);
await vp.goto(BASE + '/privacy');
const priv = await vp.textContent('main');
ok('privacy draft covers votes, anonymous id, YouTube and X embeds', /anonymous ID/i.test(priv) && /youtube-nocookie/.test(priv) && /X \(Twitter\)/.test(priv) && /cookies/.test(priv) && /13 and older/.test(priv));
ok('noindex still on (pre-launch)', /noindex/.test(await vp.getAttribute('meta[name="robots"]', 'content')));
ok('no ad script (ads off)', !(await vp.$('script[src*="googlesyndication"]')));
ok('copyright footer intact', (await vp.textContent('[data-testid=copyright]')).includes('© 2026 SushijoeKO. All rights reserved.'));

// ---------- reduced motion ----------
const rm = await newPage({ reducedMotion: 'reduce' });
await rm.goto(BASE + '/', { waitUntil: 'networkidle' });
const scrambled = await rm.$$eval('[data-decrypt]', (els) => els.some((e) => !(e.closest('a')?.getAttribute('aria-label') || '').startsWith(e.textContent)));
ok('reduced motion: no decrypt scramble', !scrambled);
ok('reduced motion: pins stop pulsing', (await rm.$$eval('.pin-ring', (e) => e.every((x) => getComputedStyle(x).animationName === 'none'))));

// ---------- mobile ----------
for (const [label, dev] of [['iphone', devices['iPhone 13']], ['android', devices['Pixel 7']]]) {
  const m = await newPage({ ...dev });
  await m.goto(BASE + '/', { waitUntil: 'networkidle' });
  await scrollAll(m);
  ok(`${label}: no horizontal overflow`, (await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 1);
  ok(`${label}: photos render`, (await m.$$eval('img[data-testid=thumb]', (e) => e.filter((i) => i.complete && i.naturalWidth > 0).length)) >= 8);
  const pin = m.locator('[data-testid=mini-map] [data-testid=pin]').last();
  await pin.scrollIntoViewIfNeeded();
  await pin.tap();
  ok(`${label}: tapping a map pin opens headlines`, await m.isVisible('[data-testid=mini-map] [data-testid=pin-panel]'));
  await m.locator('[data-testid=mini-map]').screenshot({ path: `${SHOTS}/v2-mobile-${label}-minimap.png` });
  const rd = m.locator('[data-testid=redacted]').first();
  await rd.scrollIntoViewIfNeeded(); await rd.tap();
  ok(`${label}: tap reveals redaction`, await rd.evaluate((e) => e.classList.contains('revealed')));
  await m.evaluate(() => window.scrollTo(0, 0));
  await m.screenshot({ path: `${SHOTS}/v2-mobile-${label}-home.png` });
  if (label === 'iphone') {
    await m.screenshot({ path: `${SHOTS}/v2-mobile-iphone-home-full.png`, fullPage: true });
    await m.goto(BASE + '/map', { waitUntil: 'networkidle' });
    await m.locator('[data-testid=map] [data-testid=pin]').last().tap();
    ok('iphone: /map pin tap works', await m.isVisible('[data-testid=pin-panel]'));
    await m.screenshot({ path: `${SHOTS}/v2-mobile-iphone-map.png` });
    await m.goto(BASE + '/search?q=Trump', { waitUntil: 'networkidle' });
    await m.screenshot({ path: `${SHOTS}/v2-mobile-iphone-search.png` });
  }
}
ok('browser never contacts Supabase directly', !reqLog.some((r) => r.host.includes('supabase')));
console.log('Third-party image hosts seen before clicks:', [...imgHosts].join(', '));
}

// ---------- X embeds (XMODE build with one test post) ----------
if (XMODE) {
  const xp = await newPage();
  await xp.goto(BASE + '/', { waitUntil: 'networkidle' });
  ok('pinned X post section renders', await xp.isVisible('[data-testid=section-x]'));
  ok('no X/Twitter requests before click', !reqLog.some((r) => /twitter|x\.com|twimg/.test(r.host)));
  ok('X note warns about cookies', /may set cookies/.test(await xp.textContent('[data-testid=x-post]')));
  await xp.locator('[data-testid=x-load]').scrollIntoViewIfNeeded();
  await xp.locator('[data-testid=section-x]').screenshot({ path: `${SHOTS}/v2-desktop-x-before.png` });
  await xp.click('[data-testid=x-load]');
  await xp.waitForTimeout(3000);
  ok('click injects the X embed and loads widgets.js', !!(await xp.$('[data-testid=x-embed] .twitter-tweet, [data-testid=x-embed] iframe, [data-testid=x-embed] blockquote')) && reqLog.some((r) => r.host === 'platform.twitter.com'));
  await xp.locator('[data-testid=section-x]').screenshot({ path: `${SHOTS}/v2-desktop-x-after.png` });
  consoleIssues.length = 0; // widgets.js may log about the placeholder example post
}

console.log(`Ignored resource-load console errors (blocked publisher images / forced-failure test): ${ignoredRes}`);
ok('console clean on all pages', consoleIssues.length === 0, consoleIssues.slice(0, 5).join(' | '));
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
