// Unit tests for pure modules (Node 24 runs .ts via type stripping).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tagFor, isSensitive, SNARK_TAGS } from '../lib/tags.ts';
import { makeLocator } from '../lib/places.ts';
import { group } from '../lib/cluster.ts';
import { buildClusters, dedupeItems, inCategory, isBreaking, topStory } from '../lib/feeds.ts';
import { canonicalLink, canonicalTitle, dedupeArchive } from '../lib/dedupe.ts';
import { INGEST_BATCH_LIMIT, archiveQueue, planIngest } from '../lib/db.ts';
import { filterPosts, hasTweetList, INTERCEPT_QUERY, linkify, mergePosts, nextCursor, parseTweets } from '../lib/intercepts.ts';

const locate = makeLocator(JSON.parse(fs.readFileSync(new URL('../lib/gazetteer.json', import.meta.url))));

const TRAGIC = [
  "Lawsuit: ChatGPT helped wife plan husband's poisoning",
  "Night-time habit could be early red flag for stroke or heart failure",
  "Florida man charged with giving kids psychedelic gummies on Halloween",
  "Weird scandal: aide accused of abusing toddlers at bizarre daycare",
  'Six dead after gunman opens fire in Kraków market square',
  'Florida man killed in alligator attack',
  'Bizarre crash leaves two dead on Florida highway',
  'Weird: mystery illness hospitalizes dozens, officials investigating',
  'Earthquake rattles Japan, tsunami warning issued',
  'Strange tornado flattens town as residents mourn',
  'Police chief fired after child abuse scandal',
  'Teen arrested after school shooting threat',
  'Suicide bomber strikes market in Pakistan',
  'Man drowns trying to rescue his dog',
  'CEO resigns after sexual harassment probe',
  'Hurricane forces evacuations along Gulf Coast',
  'Family holds vigil for missing hiker',
  'Woman stabbed on subway platform, suspect at large',
  'Hostage standoff ends at bank',
  'Airstrikes hit Gaza overnight',
  'Wildfire destroys hundreds of homes',
  'Overdose deaths rise in Ohio, study finds',
  'Funeral held for slain officer',
  'Terror suspect escapes from prison',
  // sports injuries, celebrity deaths, abuse / misconduct cases
  'Star quarterback carted off with torn ACL in stunning upset',
  'Chiefs receiver out for season after surgery on broken leg, team says',
  'Striker suffers concussion as underdogs rally for shock win',
  'NBA guard ruptures Achilles in thrilling comeback win',
  'Beloved sitcom star passed away at 74; fans flood TikTok with tributes',
  'Rock legend dies at 81, new album was due next month',
  'Remembering the Oscar winner whose box office hits defined the 90s',
  'RIP: iconic rapper remembered as Hot 100 tops again',
  'Pop star accused of sexual misconduct as tour trailer drops',
  'Coach fired amid harassment allegations from former players',
  'Actor hit with restraining order after ex alleges abuse; casting halted',
  'Reality star hospitalized after medical emergency on set of reboot',
  'Pitcher collapses on mound, suffers cardiac event; trade talks paused',
];
test('tragedy rule: tragic stories never get a snarky tag', () => {
  for (const t of TRAGIC) {
    for (const breaking of [true, false]) {
      for (const category of ['top', 'politics', 'weird', 'us', 'world', 'tech', 'sports', 'entertainment', 'pop-culture']) {
        const tag = tagFor({ title: t, category, breaking });
        assert.ok(isSensitive(t), `should be sensitive: ${t}`);
        if (tag) {
          assert.equal(tag.tone, 'neutral', `${t} [${category}] got ${tag.name}`);
          assert.ok(['FLASH', 'PRIORITY'].includes(tag.name), `${t} got ${tag.name}`);
          assert.ok(!SNARK_TAGS.includes(tag.name));
        }
      }
    }
  }
});
test('tragedy rule also reads the snippet', () => {
  const tag = tagFor({ title: 'Florida man in bizarre incident at theme park', snippet: 'He later died at a hospital.', category: 'weird', breaking: false });
  assert.ok(!tag || tag.tone === 'neutral');
});
test('breaking tragic hard news gets FLASH, non-breaking gets PRIORITY', () => {
  assert.equal(tagFor({ title: 'Deadly shooting in Poland', category: 'world', breaking: true }).name, 'FLASH');
  assert.equal(tagFor({ title: 'Deadly shooting in Poland', category: 'world', breaking: false }).name, 'PRIORITY');
});
test('snarky tags assigned on light stories', () => {
  const cases = [
    ['Florida man arrested for riding alligator into Walmart', 'weird', 'FLORIDA FILE'],
    ['Network host fired after on-air rant', 'top', 'BURN NOTICE'],
    ['Senator flip-flops on tariff bill', 'politics', 'DOUBLE AGENT'],
    ['Leaked memo shows agency plan', 'politics', 'COVER BLOWN'],
    ['Tech giant acquires chip startup for $2 billion', 'tech', 'ASSET ACQUIRED'],
    ['What to know about the new tax rules', 'top', 'NEED-TO-KNOW'],
    ['Study finds people like weekends', 'us', 'OBVIOUSLY'],
    ['Goat escapes farm, eats neighbor’s laundry', 'weird', 'EXFIL'],
    ['Raccoon steals pizza from delivery driver', 'weird', 'ROGUE AGENT'],
    ['Robot vacuum maps owner’s house wrong', 'tech', 'GADGET-INT'],
    ['Mysterious lights spotted over Arizona desert', 'top', 'SUSPICIOUS'],
    ['Man builds giant pumpkin boat', 'weird', 'WTF-INT'],
    ['Yankees trade for All-Star closer in blockbuster deal', 'sports', 'ASSET TRANSFER'],
    ['Week 10 takeaways: Lions roll again', 'sports', 'MISSION DEBRIEF'],
    ['Rumors swirl over star’s next team, sources say', 'sports', 'PLAYBOOK LEAKED'],
    ['Ole Miss stuns No. 3 Georgia in overtime', 'sports', 'AMBUSH'],
    ['Wicked sequel tops box office with $150 million opening weekend', 'entertainment', 'BOX OFFICE INTEL'],
    ['Stranger Things finale trailer teases the end', 'entertainment', 'SPOILER CLEARANCE'],
    ['Taylor Swift drops surprise new album at midnight', 'pop-culture', 'DROP ZONE'],
    ['Oscar winner cast as Bond villain in reboot', 'entertainment', 'COVER IDENTITY'],
    ['Rapper claps back at rival in new diss track', 'pop-culture', 'COUNTERINTEL'],
    ['Pop star and actor spotted on date night in Malibu', 'pop-culture', 'PAPARAZZI SIGINT'],
    ['Nintendo reveals new Zelda game for Switch 2', 'pop-culture', 'SIDE QUEST'],
    ['Grandma’s cooking video goes viral on TikTok', 'pop-culture', 'MEME-INT'],
  ];
  for (const [title, category, want] of cases) assert.equal(tagFor({ title, category, breaking: false })?.name, want, title);
});
test('locator: most specific place wins and ambiguous names need context', () => {
  const L = (t, s) => locate(t, s)?.name ?? null;
  assert.equal(L('Gunman kills six in Kraków, Poland'), 'Kraków');
  assert.equal(L('Kemp signs new law in Georgia'), 'Georgia');
  assert.equal(locate('Kemp signs new law in Georgia').level, 2);
  assert.equal(locate('Protests in Tbilisi as Georgian Dream claims win').name, 'Tbilisi');
  assert.equal(locate('Georgia ruling party faces EU pressure, Tbilisi protests grow').level, 3);
  assert.equal(L('Michael Jordan buys new yacht'), null);
  assert.equal(L('Jordan Peterson says something'), null);
  assert.equal(L('Refugees cross into Jordan'), 'Jordan');
  assert.equal(L('Chad Smith releases album'), null);
  assert.equal(L('Paris Hilton launches perfume'), null);
  assert.equal(L('Louvre heist: Paris police hunt thieves'), 'Paris');
  assert.equal(L('How to cook the perfect Thanksgiving turkey'), null);
  assert.equal(L('Erdogan hosts summit in Turkey'), 'Turkey');
  assert.equal(L('New York Times reporter wins award'), null);
  assert.equal(L('Washington Post publishes leak'), null);
  assert.equal(L('Subway delays in Manhattan'), 'New York City');
  assert.equal(L('White House responds to Iran'), 'Iran');
  assert.equal(L('Philippine Senate votes on budget in Manila'), 'Manila');
  assert.equal(L('Snow hits Denver, Colorado'), 'Denver');
  assert.equal(L('Whitney Houston tribute concert'), null);
  assert.equal(L('Fighting near Kharkiv as Russia advances'), 'Kharkiv');
  assert.equal(L('Nothing here at all', 'A story set in Kenya'), 'Kenya');
});
test('clustering merges same-event stories with different wording, keeps distinct ones apart', () => {
  const now = Date.parse('2026-11-08T12:00:00Z');
  const mk = (title, source, h) => { const pl = locate(title); return { title, link: 'https://x/' + encodeURIComponent(title), ts: now - h * 3600e3, source, place: pl?.name ?? null, placeLevel: pl?.level, placeCountry: pl?.country }; };
  const filler = [];
  for (let i = 0; i < 300; i++) filler.push(mk(`Unrelated story number ${i} about topic${i} and subject${i % 37} trump`, 'F' + (i % 9), (i % 20) / 2));
  const a = mk('Deadly mass shooting in Poland investigated as terror act, prosecutor says', 'ABC', 1);
  const b = mk('What we know so far after Krakow gun attack', 'BBC', 2);
  const c = mk('Briton among six dead after gunman opens fire in Kraków market square', 'Guardian', 3);
  const d = mk('Poland begins two days of mourning over Krakow shooting', 'DW', 2.5);
  const e = mk('Kraków hosts annual Christmas market opening', 'Euronews', 1);
  const f = mk('Ukraine says Russian drone strike hits Kharkiv power grid', 'AP', 1);
  const g = mk('Russian drones pound Kharkiv energy infrastructure, Ukraine says', 'Fox', 1.5);
  const groups = group([...filler, a, b, c, d, e, f, g]);
  const find = (x) => groups.find((gr) => gr.includes(x));
  const krak = find(a);
  for (const x of [b, c, d]) assert.ok(krak.includes(x), 'should merge: ' + x.title);
  assert.ok(!krak.includes(e), 'Christmas market must stay separate');
  assert.ok(find(f).includes(g), 'Kharkiv drone stories should merge');
  assert.ok(!find(f).includes(a));
});

test('soft desks never produce breaking news or tragedy tags', () => {
  for (const category of ['sports', 'entertainment', 'pop-culture']) {
    assert.equal(tagFor({ title: 'Legendary coach dies at 88', category, breaking: false }), null, category);
  }
});

import { clearance as clr, LEVELS as CLR_LEVELS, tipText } from '../lib/clearance.ts';

test('archive queue keeps every satire story instead of the newest 1500 overall', () => {
  const now = Date.parse('2026-11-08T18:00:00Z');
  const row = (category, source, i, ts) => ({
    id: category + i,
    lead: { title: category + ' ' + i, link: 'https://x/' + category + '/' + i, ts, source: { name: source, category } },
    image: null, outlets: category === 'satire' ? 0 : 1, breaking: false,
  });
  // The wire sorts newest first. 1,600 fresh news stories would fill the old
  // slice(0, 1500) and leave every older satire headline unarchived.
  const news = Array.from({ length: 2100 }, (_, i) => row('top', 'NPR', i, now - i * 1000));
  const satireOutlets = ['The Babylon Bee', 'Duffel Blog', 'The Daily Mash', 'The Daily Bonnet', 'The Beaverton', 'The Shovel', 'Reductress', 'The Hard Times'];
  const satire = satireOutlets.flatMap((name, o) =>
    Array.from({ length: 8 }, (_, i) => row('satire', name, o * 10 + i, now - (3 + o) * 86400000 - i * 3600000)));
  const sports = Array.from({ length: 40 }, (_, i) => row('sports', 'ESPN', i, now - 2 * 86400000 - i * 1000));
  const wire = [...news, ...satire, ...sports];
  const newestFirst = [...wire].sort((a, b) => b.lead.ts - a.lead.ts);
  const oldCutoff = newestFirst.slice(0, 1500).filter((c) => c.lead.source.category === 'satire');
  assert.equal(oldCutoff.length, 0, 'newest-1500 drops satire that is a few days old');
  const queued = archiveQueue(wire);
  assert.equal(queued.filter((c) => c.lead.source.category === 'satire').length, satire.length);
  assert.equal(queued.filter((c) => c.lead.source.category === 'sports').length, sports.length);
  assert.equal(queued.length, wire.length);
  const batches = planIngest(wire);
  assert.ok(batches.length >= 2);
  assert.ok(batches.every((b) => b.length <= INGEST_BATCH_LIMIT && b.length > 0));
  assert.equal(batches.flat().filter((c) => c.lead.source.category === 'satire').length, 64);
  const names = new Set(batches.flat().filter((c) => c.lead.source.category === 'satire').map((c) => c.lead.source.name));
  assert.equal(names.size, 8);
  // A tight cap still gives each desk a turn, newest story of that desk first.
  const fair = archiveQueue(wire, 6);
  const fairCats = fair.map((c) => c.lead.source.category);
  assert.ok(fairCats.includes('satire') && fairCats.includes('sports') && fairCats.includes('top'));
  assert.equal(fair.filter((c) => c.lead.source.category === 'satire').length, 2);
  assert.equal(fair.find((c) => c.lead.source.category === 'satire').lead.ts, satire[0].lead.ts);
});

test('satire isolation: not breaking, not the top story, not merged with news, no clearance count', () => {
  const now = Date.parse('2026-11-08T18:00:00Z');
  const newsSrc = { id: 'npr', name: 'NPR', url: 'https://www.npr.org/rss', home: 'https://www.npr.org', category: 'top', lean: 'Lean Left' };
  const bee = { id: 'bbees', name: 'The Babylon Bee', url: 'https://babylonbee.com/feed', home: 'https://babylonbee.com', category: 'satire', lean: 'Right' };
  const mash = { id: 'dailymash', name: 'The Daily Mash', url: 'https://www.thedailymash.co.uk/feed', home: 'https://www.thedailymash.co.uk', category: 'satire', lean: 'Center' };
  const title = 'President signs a broad tariff package after a late session';
  const news = { title, link: 'https://news.example/tariff', snippet: 'Lawmakers stayed in session.', ts: now - 20 * 60 * 1000, image: null, source: newsSrc, place: null, geo: null };
  const joke = { ...news, link: 'https://bee.example/tariff', source: bee };
  const jokeMate = { ...joke, link: 'https://mash.example/tariff', source: mash };
  const clusters = buildClusters([news, joke, jokeMate], now);
  const newsClusters = clusters.filter((c) => !c.satire);
  const satireClusters = clusters.filter((c) => c.satire);
  assert.equal(newsClusters.length, 1);
  assert.equal(newsClusters[0].outlets, 1, 'a matching joke must not raise the news outlet count');
  assert.ok(newsClusters[0].links.every((u) => !u.includes('bee.example') && !u.includes('mash.example')));
  assert.equal(satireClusters.length, 1, 'the two satire copies of the same joke cluster together');
  assert.ok(satireClusters.every((c) => c.outlets === 0), 'satire does not carry a clearance outlet count');
  assert.ok(satireClusters.every((c) => c.breaking === false && c.tag === null));
  const urgent = { ...joke, title: 'Breaking: president killed in explosion, officials say', ts: now - 5 * 60 * 1000 };
  assert.equal(isBreaking({ lead: urgent, also: [jokeMate], categories: ['satire'] }, now), false);
  const wire = { clusters, fetchedAt: now, feeds: [] };
  const top = topStory(wire);
  assert.equal(top.satire, false);
  assert.equal(top.lead.source.category, 'top');
  assert.equal(topStory({ clusters: buildClusters([joke], now), fetchedAt: now, feeds: [] }), undefined);
  assert.ok(inCategory(wire, 'satire').every((c) => c.satire && c.lead.source.category === 'satire'));
  assert.ok(!inCategory(wire, 'top').some((c) => c.satire));
  assert.ok(!inCategory(wire, 'breaking').length);
  assert.equal(tagFor({ title: 'Florida man rides an alligator into the capitol', category: 'satire', breaking: false }), null);
  assert.equal(tagFor({ title: 'Breaking: deadly explosion kills dozens', category: 'satire', breaking: true }), null);
  // the same guard holds in the raw clusterer, even before the wire is assembled
  const raw = group([
    { title, link: news.link, ts: news.ts, source: newsSrc },
    { title, link: joke.link, ts: joke.ts, source: bee },
  ]);
  assert.equal(raw.length, 2);
});

test('intercepts fixture parses, caps, and filters without keeping bad rows', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/intercepts.json', import.meta.url)));
  assert.equal(hasTweetList(fixture), true);
  assert.equal(hasTweetList({ error: 'nope' }), false);
  assert.equal(nextCursor(fixture), null);
  assert.equal(nextCursor({ tweets: [], has_next_page: true, next_cursor: 'page-2' }), 'page-2');
  const posts = parseTweets(fixture);
  assert.deepEqual(posts.map((post) => post.handle), ['BBCBreaking', 'NPR', 'Reuters']);
  assert.equal(posts[0].createdAt, Date.parse('Mon Nov 09 23:00:53 +0000 2026'));
  assert.equal(posts[0].name, 'BBC Breaking');
  assert.equal(posts[2].url, 'https://x.com/Reuters/status/1003');
  assert.ok(posts[2].text.includes('<script>'));
  const long = 'x'.repeat(400);
  const capped = parseTweets({ tweets: [{ id: '9', text: long, createdAt: 'Mon Nov 09 23:00:53 +0000 2026', author: { userName: 'Kalshi', name: 'Kalshi' }, url: 'https://x.com/Kalshi/status/9' }] });
  assert.equal(capped[0].text.length, 280);
  assert.ok(capped[0].text.endsWith('…'));
  const merged = mergePosts([posts, [posts[0], { ...posts[1], id: '1002b', createdAt: posts[0].createdAt + 1000 }]]);
  assert.equal(merged[0].id, '1002b');
  assert.equal(merged.filter((post) => post.id === '1001').length, 1);
  assert.deepEqual(filterPosts(posts, 'all').map((post) => post.id), ['1001', '1002', '1003']);
  assert.deepEqual(filterPosts(posts, 'NPR').map((post) => post.handle), ['NPR']);
  assert.deepEqual(filterPosts(posts, 'npr').map((post) => post.id), ['1002']);
  assert.equal(filterPosts(posts, 'Kalshi').length, 0);
  const parts = linkify(posts[0].text);
  assert.deepEqual(parts.filter((part) => part.kind === 'link').map((part) => part.value), ['https://example.com/bridge']);
  assert.equal(linkify(posts[1].text).some((part) => part.kind === 'link'), false);
  assert.ok(INTERCEPT_QUERY.includes('from:Polymarket OR from:Kalshi OR from:ExxAlerts'));
  assert.equal(INTERCEPT_QUERY.split(' OR ').length, 11);
});

test('clearance cutoffs: L1 1, L2 2–3, L3 4–6, L4 COSMIC 7+', () => {
  const m = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3, 7: 4, 8: 4, 21: 4, 100: 4 };
  for (const [n, l] of Object.entries(m)) assert.equal(clr(+n).lvl, l, `outlets ${n}`);
  assert.equal(clr(0).lvl, 1);
  assert.equal(tipText(CLR_LEVELS[2]), 'L3 · TOP SECRET: 4–6 outlets reporting');
  assert.equal(tipText(CLR_LEVELS[3]), 'L4 · COSMIC: 7+ outlets reporting');
});

test('dedupe copies before ranking, and leaves different headlines alone', () => {
  const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/dedupe-stories.json', import.meta.url)));
  const src = (name, category = 'politics') => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, ''), name, url: 'https://example.com/rss', home: 'https://example.com', category, lean: 'Center' });
  const story = (row, category) => ({ title: row.title, link: row.link, snippet: '', ts: row.ts, image: row.image ?? null, source: src(row.source, category), place: null, geo: null, guid: row.guid });
  const now = Date.parse('2026-11-09T23:00:00Z');
  assert.equal(canonicalLink(fixture.utm[0].link), 'https://thebulwark.com/p/trump-ufc');
  assert.equal(canonicalLink(fixture.utm[1].link), canonicalLink(fixture.utm[0].link));
  assert.equal(canonicalTitle(fixture.entities[0].title), canonicalTitle(fixture.entities[1].title));
  const utm = buildClusters(fixture.utm.map((row) => story(row)), now);
  assert.equal(utm.length, 1);
  assert.equal(utm[0].lead.ts, 1000);
  assert.equal(utm[0].lead.link, fixture.utm[1].link);
  assert.equal(utm[0].image, 'https://cdn.example/bulwark.jpg');
  const feeds = buildClusters(fixture.twoFeeds.map((row) => story(row)), now);
  assert.equal(feeds.length, 1);
  assert.equal(feeds[0].lead.ts, 4000);
  assert.equal(feeds[0].image, 'https://cdn.example/senate.jpg');
  const entities = buildClusters(fixture.entities.map((row) => story(row)), now);
  assert.equal(entities.length, 1);
  assert.equal(entities[0].lead.title, "Trump's Border Memo Leaks Early");
  assert.equal(entities[0].image, 'https://cdn.example/memo.jpg');
  const distinct = buildClusters(fixture.distinct.map((row) => story(row)), now);
  assert.equal(distinct.length, 2);
  assert.deepEqual(distinct.map((cluster) => cluster.lead.source.name).sort(), ['CNA', 'The Guardian']);
  const byGuid = dedupeItems(fixture.guid.map((row) => story(row)));
  assert.equal(byGuid.length, 1);
  assert.equal(byGuid[0].ts, 1500);
  const satireTitle = 'A joke headline that matches the wire exactly';
  const mixed = buildClusters([
    story({ title: satireTitle, link: 'https://example.com/news', ts: 100, source: 'NPR' }),
    story({ title: satireTitle, link: 'https://example.com/joke', ts: 90, source: 'The Babylon Bee' }, 'satire'),
  ], now);
  assert.equal(mixed.length, 2);
  assert.equal(mixed.filter((cluster) => cluster.satire).length, 1);
  const rows = dedupeArchive([
    { id: 'a', title: fixture.utm[0].title, link: fixture.utm[0].link, source: 'The Bulwark', category: 'politics', image: null, published_at: '2026-11-09T22:00:00Z', outlets: 1, breaking: false, votes: 2, score: 4 },
    { id: 'b', title: fixture.utm[0].title, link: fixture.utm[1].link, source: 'The Bulwark', category: 'politics', image: 'https://cdn.example/bulwark.jpg', published_at: '2026-11-09T22:11:00Z', outlets: 1, breaking: true, votes: 3, score: 5 },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'a');
  assert.equal(rows[0].votes, 5);
  assert.equal(rows[0].score, 9);
  assert.equal(rows[0].breaking, true);
  assert.equal(rows[0].image, 'https://cdn.example/bulwark.jpg');
});
