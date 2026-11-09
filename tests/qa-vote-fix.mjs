// Focused QA for the vote fix + nav link. Run against `next start -p 3100` (same Supabase + env as Vercel).
import { chromium, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3100';
const SHOTS = process.env.SHOTS || '../shots';
const results = [];
const ok = (name, cond, info = '') => { results.push({ name, pass: !!cond, info }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); let h2 = 5381; for (let i = 0; i < s.length; i++) h2 = (Math.imul(h2, 33) ^ s.charCodeAt(i)) >>> 0; return (h >>> 0).toString(36) + (h2 % 46656).toString(36).padStart(3, '0'); }
const b = await chromium.launch();
const bad = [], consoleIssues = [];
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on('response', (r) => { const u = new URL(r.url()); if (u.hostname === 'localhost' && r.status() >= 400) bad.push(`${r.status()} ${u.pathname}${u.search}`); });
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleIssues.push(m.text()); });

// nav
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
ok('no link anywhere points to /sources', (await p.$$('a[href="/sources"]')).length === 0);
ok('nav "Sources" links straight to /about', (await p.getAttribute('nav[aria-label=Channels] a:has-text("Sources")', 'href')) === '/about');
for (const a of await p.$$('nav[aria-label=Channels] a')) await a.hover();
await p.waitForTimeout(2500);
await p.click('nav[aria-label=Channels] a:has-text("Sources")');
await p.waitForURL('**/about');
ok('Sources nav opens /about', p.url().endsWith('/about'));
ok('no same-origin 4xx/5xx during nav prefetch + click', bad.length === 0, bad.join(', '));
const red = await p.request.get(BASE + '/sources', { maxRedirects: 0 });
ok('/sources redirect kept (308 → /about)', red.status() === 308 && red.headers().location.endsWith('/about'));

// optimistic vote on home
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
await p.waitForTimeout(800); // live counts load
const btn = p.locator('[data-testid=section-weird] [data-testid=vote]').first();
await btn.scrollIntoViewIfNeeded();
const id = await btn.getAttribute('data-id');
const before = Number(await btn.locator('[data-testid=vote-count]').textContent());
let release; const gate = new Promise((r) => (release = r));
await p.route('**/api/vote', async (r) => { if (r.request().method() === 'POST') await gate; await r.continue(); });
await btn.click();
await p.waitForTimeout(300);
const optimistic = Number(await btn.locator('[data-testid=vote-count]').textContent());
ok('count updates immediately (optimistic, before server replies)', optimistic === before + 1 && (await btn.getAttribute('aria-pressed')) === 'true', `${before} → ${optimistic}`);
const respP = p.waitForResponse((r) => r.url().endsWith('/api/vote') && r.request().method() === 'POST');
release();
const resp = await (await respP).json();
await p.waitForTimeout(300);
await p.unroute('**/api/vote');
const confirmed = Number(await btn.locator('[data-testid=vote-count]').textContent());
ok('server confirms the vote and count matches', resp.ok && !resp.already && confirmed === resp.votes && confirmed === before + 1, JSON.stringify(resp));
await p.reload({ waitUntil: 'networkidle' });
await p.waitForTimeout(1200);
const afterReload = Number(await p.locator(`[data-testid=vote][data-id="${id}"]`).first().locator('[data-testid=vote-count]').textContent());
ok('after reload the cached page shows the live count', afterReload === confirmed, `${afterReload}`);
const live = await (await p.request.get(`${BASE}/api/vote?ids=${id}`)).json();
ok('GET /api/vote?ids returns live totals', live.counts[id] === confirmed, JSON.stringify(live));
await p.screenshot({ path: `${SHOTS}/v2fix-desktop-vote.png` });

// votes from other pages (category, map-less pages, trending, search)
const voter = await p.evaluate(() => localStorage.getItem('gt-voter'));
for (const path of ['/c/world', '/c/tech', '/trending', '/search?q=Trump']) {
  await p.waitForTimeout(2200); // per-voter 2 s spacing
  await p.goto(BASE + path, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  const v = p.locator('[data-testid=vote][aria-pressed=false]').first();
  await v.scrollIntoViewIfNeeded();
  const n0 = Number(await v.locator('[data-testid=vote-count]').textContent());
  const vid = await v.getAttribute('data-id');
  const [r] = await Promise.all([p.waitForResponse((r) => r.url().endsWith('/api/vote') && r.request().method() === 'POST'), v.click()]);
  const j = await r.json();
  await p.waitForTimeout(200);
  const n1 = Number(await p.locator(`[data-testid=vote][data-id="${vid}"]`).first().locator('[data-testid=vote-count]').textContent());
  ok(`vote registers on ${path}`, j.ok && n1 === j.votes && n1 === n0 + 1, `${n0} → ${n1} ${JSON.stringify(j)}`);
}

// headline visible on a page but not yet archived: id = hash of a member link that is not the archived anchor
const api = p.request;
await p.goto(BASE + '/', { waitUntil: 'networkidle' });
const alsoLink = await p.$eval('[data-testid=headline] details a', (a) => a.href);
const aliasId = hash(alsoLink);
await p.waitForTimeout(2200);
let j = await (await api.post(BASE + '/api/vote', { data: { id: aliasId, voter, link: alsoLink }, headers: { origin: BASE } })).json();
ok('vote on a not-yet-archived story archives it from server feed data and counts', j.ok && j.votes === 1, `${aliasId} ${JSON.stringify(j)}`);
await p.waitForTimeout(2200);
const forged = await api.post(BASE + '/api/vote', { data: { id: hash('https://evil.example/fake'), voter, link: 'https://evil.example/fake' } });
ok('forged ids/links are not archived (404 unknown_item)', forged.status() === 404);
const fresh = crypto.randomUUID();
const ids2 = await p.$$eval('[data-testid=vote][aria-pressed=false]', (e) => e.slice(10, 12).map((x) => x.getAttribute('data-id')));
const r1 = await api.post(BASE + '/api/vote', { data: { id: ids2[0], voter: fresh } });
const r2 = await api.post(BASE + '/api/vote', { data: { id: ids2[1], voter: fresh } });
ok('rate limit still enforced', r1.status() === 200 && r2.status() === 429, `${r1.status()} ${r2.status()}`);

// mobile tap
const m = await (await b.newContext({ ...devices['iPhone 13'] })).newPage();
await m.goto(BASE + '/', { waitUntil: 'networkidle' });
await m.waitForTimeout(800);
const mb = m.locator('[data-testid=section-politics] [data-testid=vote]').nth(2);
await mb.scrollIntoViewIfNeeded();
const m0 = Number(await mb.locator('[data-testid=vote-count]').textContent());
const [mr] = await Promise.all([m.waitForResponse((r) => r.url().endsWith('/api/vote') && r.request().method() === 'POST'), mb.tap()]);
const mj = await mr.json();
ok('iphone: tap vote registers and updates', mj.ok && Number(await mb.locator('[data-testid=vote-count]').textContent()) === m0 + 1, JSON.stringify(mj));
await m.screenshot({ path: `${SHOTS}/v2fix-mobile-vote.png` });

ok('console clean', consoleIssues.length === 0, consoleIssues.slice(0, 3).join(' | '));
console.log('TEST_ALIAS_ID', aliasId);
await b.close();
const passed = results.filter((r) => r.pass).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
