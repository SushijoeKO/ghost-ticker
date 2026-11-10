// Story clustering: groups the same event across outlets even when worded differently.
// Pure module (no imports) so it can be unit-tested with plain Node.

export interface CItem { title: string; link: string; ts: number; source?: unknown; place?: string | null; placeLevel?: number; placeCountry?: string | null }

const ENTITY_SKIP = new Set(
  ("says said say after amid over into about with from that this they their just will new more most " +
   "breaking update live video watch report reports official officials police government president minister " +
   "monday tuesday wednesday thursday friday saturday sunday january february march april june july august " +
   "september october november december today tonight yesterday sources source exclusive analysis opinion " +
   "white house black young american national federal supreme court street party chief daily post times news press office oval " +
   "too late save what why how who when where inside under before could would should will can may just more most many some new old big top best worst here there this that these those").split(" ")
);

const STOP = new Set(
  ("a an the of to in on for and or but at by with from as is are was were be been after over into about amid says say said new its it this that his her " +
   "their they he she you we not no up out more than how why what who will can could would has have had just now year years day days week first last " +
   "man woman people report reports video watch live update updates know get gets one two three amid against back off top latest here").split(" ")
);

// Event vocabulary: different words for the same kind of event map to one canonical token.
const SYN: Record<string, string> = {
  shooting: "shoot", shootings: "shoot", shooter: "shoot", gunman: "shoot", gunmen: "shoot", gunfire: "shoot", gun: "shoot", shot: "shoot", shots: "shoot",
  attack: "attack", attacks: "attack", attacked: "attack", assault: "attack", rampage: "attack",
  killed: "kill", kills: "kill", killing: "kill", dead: "kill", deaths: "kill", death: "kill", dies: "kill", died: "kill", slain: "kill",
  explosion: "blast", explosions: "blast", blasts: "blast", bomb: "blast", bombing: "blast", exploded: "blast",
  earthquake: "quake", quakes: "quake", tremor: "quake", temblor: "quake",
  election: "vote", elections: "vote", votes: "vote", voting: "vote", polls: "vote", ballot: "vote", ballots: "vote", midterms: "vote", midterm: "vote",
  ceasefire: "truce", "cease-fire": "truce", truce: "truce",
  strike: "strike", strikes: "strike", airstrike: "strike", airstrikes: "strike", missile: "strike", missiles: "strike", drone: "strike", drones: "strike",
  arrest: "arrest", arrested: "arrest", detained: "arrest", charged: "arrest", custody: "arrest",
  resign: "quit", resigns: "quit", resigned: "quit", resignation: "quit", quits: "quit", ousted: "quit", fired: "quit",
  tariff: "tariff", tariffs: "tariff", fire: "fire", wildfire: "fire", wildfires: "fire", blaze: "fire",
  hurricane: "storm", storm: "storm", typhoon: "storm", cyclone: "storm", tornado: "storm",
  crash: "crash", crashes: "crash", crashed: "crash", collision: "crash",
  krakow: "krakow", cracow: "krakow",
};

function stem(w: string): string {
  return SYN[w] ?? (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
}

const GENERIC = new Set(
  ("trump biden harris obama putin zelensky netanyahu musk usa america american china chinese russia russian " +
   "iran israeli israel gaza ukraine president donald joe white house live breaking watch news wrap update video " +
   "supreme court scotus nfl trade deadline football monday grade grades odds prediction predictions pick picks " +
   "betting bet bets rumor rumors tracker fantasy draft game games " +
   "january february march april may june july august september october november december " +
   "bulletin roundup digest headlines evening midday morning").split(" ")
);

// Places are not a second cast. A headline that adds two new people is a different event.
const PLACEISH = new Set(
  ("washington beijing china tampa texas utah paris london kyiv kharkiv poland krakow cracow florida california " +
   "ohio mexico canada europe africa asia tokyo seoul berlin rome madrid gaza ukraine iran israel russia america " +
   "paris bend puerto rico minnesota buffalo jacksonville philadelphia hong kong macau york angeles francisco " +
   "chicago boston miami seattle dallas houston atlanta detroit phoenix denver vegas brooklyn manhattan queens " +
   "sydney mumbai delhi cairo dubai toronto montreal vancouver taipei singapore bangkok jakarta manila lisbon " +
   "vienna prague warsaw budapest amsterdam brussels dublin edinburgh glasgow manchester liverpool austin nashville").split(" ")
);

/** Drop desk prefixes and live suffixes so "BREAKING:" and "News Wrap:" don't look like shared facts. */
export function normalizeHeadline(title: string): string {
  let s = title.replace(/\s+/g, " ").trim();
  for (let i = 0; i < 2; i++) {
    const next = s.replace(/^(?:breaking|watch|live|news\s*wrap|just\s+in|update|exclusive)\s*[:|\-–—]?\s+/i, "");
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\s*[|\-–—:]\s*(?:live|breaking|watch|updates?)\s*$/i, "");
  s = s.replace(/\s+\blive\b\s*$/i, "");
  return s.trim();
}

export function tokens(title: string): string[] {
  const out = new Set<string>();
  for (const raw of normalizeHeadline(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9 -]+/g, " ").split(/\s+/)) {
    const w = raw.replace(/^-+|-+$/g, "");
    if (w.length < 2 || STOP.has(w) || GENERIC.has(w) || /^\d+$/.test(w)) continue;
    out.add(stem(w));
  }
  return [...out];
}

/** Capitalized name-like tokens. One shared name (Trump) is not an event; two usually are (Nvidia + Huang). */
export function entityTokens(title: string): string[] {
  const out = new Set<string>();
  for (const raw of title.split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 3) continue;
    const nameLike = /^[A-Z][a-z]/.test(raw) || /^[A-Z]{3,}$/.test(raw);
    if (!nameLike) continue;
    const w = stem(raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]s\b/g, ""));
    if (w.length < 3 || STOP.has(w) || ENTITY_SKIP.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

const EVENT = new Set(["shoot", "attack", "kill", "blast", "quake", "vote", "truce", "strike", "arrest", "quit", "fire", "storm", "crash"]);
const WINDOW_MS = 36 * 3600 * 1000;
// Generic words that can be rare in a big corpus and still not identify a story
// ("leaves thousands without" matched a Gaza flood to a Ukraine blackout).
const WEAK = new Set(
  ("leave left thousand hundred without people official officials police government president minister million billion " +
   "state city county north south east west home world time week today local authority heavy power shelter dark eastern " +
   "southern northern western report reports according source near after over under amid during while before across around " +
   "another still could would should other some many most such only even back down next last first second third year years " +
   "month months hour hours night morning evening update live video watch photo image breaking latest news tell told claim " +
   "claims warn warns call calls plan plans set sets ten tens made make take hit hits help helps " +
   "war conflict end ending talks talk peace deal world country nation national security").split(" ")
);

export interface Prepared<T extends CItem> { item: T; tok: string[]; set: Set<string>; entities: string[] }

export function prepare<T extends CItem>(items: T[]) {
  const df = new Map<string, number>();
  const prepped: Prepared<T>[] = items.map((item) => {
    const tok = tokens(item.title);
    for (const t of tok) df.set(t, (df.get(t) ?? 0) + 1);
    return { item, tok, set: new Set(tok), entities: entityTokens(item.title) };
  });
  const N = Math.max(items.length, 1);
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 0.5));
  const rareCut = Math.log((N + 1) / (Math.max(3, N * 0.012) + 0.5)); // ~top 1% frequency counts as common
  return { prepped, idf, isRare: (t: string) => idf(t) >= rareCut };
}

export function sameStory<T extends CItem>(a: Prepared<T>, b: Prepared<T>, idf: (t: string) => number, isRare: (t: string) => boolean, strict = false): boolean {
  if (a.item.link === b.item.link) return true;
  if (a.item.ts && b.item.ts && Math.abs(a.item.ts - b.item.ts) > WINDOW_MS) return false;
  let inter = 0, wShared = 0, rare = 0, evt = false, nonEvent = 0;
  for (const t of a.tok) if (b.set.has(t)) {
    inter++; wShared += idf(t);
    if (isRare(t) && !WEAK.has(t)) rare++;
    if (EVENT.has(t) && t !== "vote") evt = true;
    else nonEvent++;
  }
  if (!inter) return false;
  const sharedNames = a.entities.filter((token) => b.entities.includes(token) && !GENERIC.has(token) && !PLACEISH.has(token));
  const distinctive = a.tok.filter((token) => b.set.has(token) && !GENERIC.has(token) && !WEAK.has(token) && !EVENT.has(token) && !PLACEISH.has(token));
  const nameSet = new Set([...a.entities, ...b.entities]);
  // A shared person (Charlie Kirk, Russell Brand) is not the event. One shared fact word is required.
  const content = distinctive.filter((token) => !nameSet.has(token));
  if (content.length >= 2 || (content.length >= 1 && (distinctive.length >= 2 || sharedNames.length >= 2))) return true;
  const union = a.set.size + b.set.size - inter;
  if (content.length >= 1 && distinctive.length >= 2 && inter / union >= 0.34) return true;
  const wa = a.tok.reduce((s, t) => s + idf(t), 0), wb = b.tok.reduce((s, t) => s + idf(t), 0);
  const wContain = wShared / Math.max(1e-6, Math.min(wa, wb));
  if (content.length >= 1 && wContain >= 0.55 && rare >= 2) return true;
  if (content.length >= 1 && rare >= 3 && wContain >= 0.35) return true;
  if (strict) return false;
  if (!evt || !a.item.place || !b.item.place) return false;
  if (a.item.place === b.item.place) {
    const lvl = a.item.placeLevel ?? 0;
    // Same city and same kind of event still needs one shared word besides the event
    // ("arrest" alone was merging every detention in Los Angeles).
    if (lvl >= 3 && nonEvent >= 1) return true;
    if (lvl >= 2 && rare >= 2) return true; // a whole state needs more evidence
  }
  const sameCountry = !!a.item.placeCountry && a.item.placeCountry === b.item.placeCountry &&
    ((a.item.placeLevel ?? 0) === 1 || (b.item.placeLevel ?? 0) === 1 || a.item.place === b.item.place);
  return sameCountry && rare >= 1 && a.item.placeCountry !== "USA"; // US is too big for country-level matching
}

const MAX_GROUP = 30;

/** Satire outlets carry a category of "satire". Everything else, including items with no source, is news. */
function desk(item: CItem): "satire" | "news" {
  const src = item.source;
  if (src && typeof src === "object" && "category" in src && (src as { category?: unknown }).category === "satire") return "satire";
  return "news";
}

function novelPeople<T extends CItem>(a: Prepared<T>, b: Prepared<T>): number {
  let n = 0;
  for (const token of a.entities) {
    // Short tokens are roles and acronyms (CEO, Spy, NFL), not a second person.
    if (token.length < 4 || GENERIC.has(token) || PLACEISH.has(token) || b.entities.includes(token)) continue;
    n++;
  }
  return n;
}

function distinctiveCount<T extends CItem>(a: Prepared<T>, b: Prepared<T>, isRare: (t: string) => boolean): number {
  let n = 0;
  for (const token of a.tok) {
    if (!b.set.has(token) || GENERIC.has(token) || WEAK.has(token) || EVENT.has(token)) continue;
    if (isRare(token) || a.entities.includes(token) || b.entities.includes(token)) n++;
  }
  return n;
}

/**
 * Each story joins the one existing cluster whose centroid it matches.
 * It does not join through a peripheral member, and a cluster stops at 30.
 */
export function group<T extends CItem>(items: T[]): T[][] {
  const { prepped, idf, isRare } = prepare(items);
  const order = prepped.map((_, i) => i).sort((x, y) => prepped[y].item.ts - prepped[x].item.ts);
  const buckets: { centroid: number; members: number[] }[] = [];
  for (const index of order) {
    const item = prepped[index].item;
    let best: { bucket: { centroid: number; members: number[] }; score: number } | null = null;
    for (const bucket of buckets) {
      const centroid = prepped[bucket.centroid];
      if (desk(item) !== desk(centroid.item)) continue;
      if (item.ts && centroid.item.ts && Math.abs(item.ts - centroid.item.ts) > WINDOW_MS) continue;
      if (bucket.members.length >= MAX_GROUP) continue;
      const score = distinctiveCount(prepped[index], centroid, isRare);
      const strong = bucket.members.length >= 15 ? score >= 4 : bucket.members.length >= 8 ? score >= 3 : true;
      if (!strong) continue;
      // A second pair of names on either side (Chappelle + Erika, Lakers + Hawks) is a different event.
      if (novelPeople(prepped[index], centroid) >= 2 || novelPeople(centroid, prepped[index]) >= 2) continue;
      if (!sameStory(prepped[index], centroid, idf, isRare, bucket.members.length >= 4)) continue;
      // Past the first pair, also match another member. A two-topic headline cannot
      // be the only bridge between unrelated stories.
      if (bucket.members.length >= 2 && !bucket.members.some((member) => member !== bucket.centroid && sameStory(prepped[index], prepped[member], idf, isRare, true))) continue;
      if (!best || score > best.score) best = { bucket, score };
    }
    if (best) {
      best.bucket.members.push(index);
      const centroid = prepped[best.bucket.centroid];
      const shared = prepped[index].tok.filter((token) => centroid.set.has(token)).length;
      const novel = prepped[index].tok.filter((token) => !centroid.set.has(token)).length;
      // A longer restatement can become the centroid. A headline that bolts on a second event cannot.
      if (shared >= 2 && novel <= shared && prepped[index].tok.length > centroid.tok.length) best.bucket.centroid = index;
    } else {
      buckets.push({ centroid: index, members: [index] });
    }
  }
  return buckets.map((bucket) => bucket.members.map((index) => prepped[index].item));
}
