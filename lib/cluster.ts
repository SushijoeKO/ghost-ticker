// Story clustering: groups the same event across outlets even when worded differently.
// Pure module (no imports) so it can be unit-tested with plain Node.

export interface CItem { title: string; link: string; ts: number; snippet?: string; source?: unknown; place?: string | null; placeLevel?: number; placeCountry?: string | null }

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
   "bulletin roundup digest headlines evening midday morning " +
   "formula prix qualifying brazilian").split(" ")
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
  return secondPass(buckets.map((bucket) => bucket.members.map((index) => prepped[index].item)));
}

// Names that show up in many unrelated stories. They never count as the two rare tokens that justify a merge.
const FAMOUS = new Set(
  ("trump biden harris obama putin zelensky netanyahu musk president donald joe america american " +
   "china chinese russia russian iran israel ukraine gaza white house").split(" ")
);

const MERGE_COSINE = 0.66;
const MERGE_COSINE_WITH_RARE = 0.48;
const MERGE_RARE = 2;
const MEMBER_FLOOR = 0.34;
const MAX_MERGED = 160;

function passTokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of normalizeHeadline(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9 -]+/g, " ").split(/\s+/)) {
    const w = raw.replace(/^-+|-+$/g, "");
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
    if (w === "scotus") { out.push("supreme", "court"); continue; }
    out.push(stem(w));
  }
  return out;
}

function vecNorm(weights: Map<string, number>): number {
  let sum = 0;
  for (const value of weights.values()) sum += value * value;
  return Math.sqrt(sum);
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [token, weight] of small) {
    const other = large.get(token);
    if (other) dot += weight * other;
  }
  const denom = vecNorm(a) * vecNorm(b);
  return denom ? dot / denom : 0;
}

function averageVec(vecs: Map<string, number>[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const vec of vecs) for (const [token, weight] of vec) out.set(token, (out.get(token) ?? 0) + weight);
  const n = vecs.length || 1;
  for (const [token, weight] of out) out.set(token, weight / n);
  return out;
}

/** Display backstop: two leads are the same event even if clustering left them apart. */
export function leadsEcho(a: { title: string; snippet?: string }, b: { title: string; snippet?: string }): boolean {
  const ta = [...new Set(passTokens(`${a.title} ${a.snippet ?? ""}`).filter((token) => !WEAK.has(token) && !FAMOUS.has(token)))];
  const tb = [...new Set(passTokens(`${b.title} ${b.snippet ?? ""}`).filter((token) => !WEAK.has(token) && !FAMOUS.has(token)))];
  if (ta.length < 2 || tb.length < 2) return false;
  const sb = new Set(tb);
  const shared = ta.filter((token) => sb.has(token));
  if (shared.length >= 4) return true;
  const va = new Map(ta.map((token) => [token, 1]));
  const vb = new Map(tb.map((token) => [token, 1]));
  return shared.length >= 3 && cosine(va, vb) >= 0.55;
}

/**
 * Second pass: merge clusters whose centroids describe the same event.
 * Centroid vectors are the mean TF-IDF of every member title and snippet.
 * A merge is kept only when every member still sits close to the combined centroid.
 */
export function secondPass<T extends CItem>(groups: T[][]): T[][] {
  if (groups.length < 2) return groups;
  const docs = groups.map((members) => members.map((member) => passTokens(`${member.title} ${member.snippet ?? ""}`)));
  const df = new Map<string, number>();
  let pool = 0;
  for (const doc of docs.flat()) {
    pool++;
    for (const token of new Set(doc)) df.set(token, (df.get(token) ?? 0) + 1);
  }
  const n = Math.max(pool, 1);
  const idf = (token: string) => Math.log((n + 1) / ((df.get(token) ?? 0) + 0.5));
  const rareCut = Math.log((n + 1) / (Math.max(6, n * 0.06) + 0.5));
  const rareToken = (token: string) => token.length >= 3 && !WEAK.has(token) && !FAMOUS.has(token) && !(GENERIC.has(token) && token !== "supreme" && token !== "court") && idf(token) >= rareCut;

  const weight = (tokens: string[]) => {
    const tf = new Map<string, number>();
    for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
    const out = new Map<string, number>();
    for (const [token, count] of tf) out.set(token, (1 + Math.log(count)) * idf(token));
    return out;
  };

  const signatureOf = (memberDocs: string[][]) => {
    const counts = new Map<string, number>();
    for (const doc of memberDocs) for (const token of new Set(doc)) if (rareToken(token)) counts.set(token, (counts.get(token) ?? 0) + 1);
    // A word has to show up across the file, not in a single aside, before it can pull another file in.
    const need = memberDocs.length <= 2 ? 1 : Math.max(2, Math.ceil(memberDocs.length * 0.34));
    const signature = new Set<string>();
    for (const [token, count] of counts) if (count >= need) signature.add(token);
    return signature;
  };

  interface Node<U extends CItem> { members: U[]; docs: string[][]; vecs: Map<string, number>[]; centroid: Map<string, number>; rare: Set<string>; ts: number }
  const nodes: Node<T>[] = groups.map((members, index) => {
    const vecs = docs[index].map(weight);
    const times = members.map((member) => member.ts).filter((ts) => ts > 0).sort((a, b) => a - b);
    return { members, docs: docs[index], vecs, centroid: averageVec(vecs), rare: signatureOf(docs[index]), ts: times.length ? times[Math.floor(times.length / 2)] : 0 };
  });

  const anchorKeys = (signature: Set<string>) => {
    const tokens = [...signature].filter((token) => token.length >= 4).sort();
    const keys: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length && j < i + 5; j++) keys.push(`${tokens[i]}+${tokens[j]}`);
    }
    return keys.slice(0, 20);
  };

  const postings = new Map<string, number[]>();
  nodes.forEach((node, index) => {
    for (const token of node.rare) {
      const list = postings.get(token);
      if (list) list.push(index);
      else postings.set(token, [index]);
    }
    for (const key of anchorKeys(node.rare)) {
      const list = postings.get(key);
      if (list) list.push(index);
      else postings.set(key, [index]);
    }
  });

  const seen = new Set<string>();
  const pairs: [number, number][] = [];
  const addPair = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push([a, b]);
  };
  for (const list of postings.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort((a, b) => nodes[b].members.length - nodes[a].members.length);
    if (ranked.length <= 28) {
      for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) addPair(ranked[i], ranked[j]);
    } else {
      const hosts = ranked.slice(0, 4);
      for (const host of hosts) for (const other of ranked) addPair(host, other);
    }
  }

  const parent = nodes.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== root) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };

  const scored = pairs.map(([a, b]) => ({ a, b, cosine: cosine(nodes[a].centroid, nodes[b].centroid) }));
  scored.sort((a, b) => b.cosine - a.cosine);

  for (const pair of scored) {
    const ia = find(pair.a);
    const ib = find(pair.b);
    if (ia === ib) continue;
    const left = nodes[ia];
    const right = nodes[ib];
    if (desk(left.members[0]) !== desk(right.members[0])) continue;
    if (left.ts && right.ts && Math.abs(left.ts - right.ts) > WINDOW_MS) continue;
    if (left.members.length + right.members.length > MAX_MERGED) continue;
    let shared = 0;
    const [smaller, larger] = left.rare.size <= right.rare.size ? [left, right] : [right, left];
    for (const token of smaller.rare) if (larger.rare.has(token)) shared++;
    const similarity = cosine(left.centroid, right.centroid);
    const close = similarity >= MERGE_COSINE || (shared >= MERGE_RARE && similarity >= MERGE_COSINE_WITH_RARE) || (shared >= 3 && similarity >= 0.2) || (shared >= 4 && similarity >= 0.3);
    if (!close) continue;
    const [host, extra] = left.members.length >= right.members.length ? [left, right] : [right, left];
    if (host.members.length + extra.members.length > MAX_MERGED) continue;
    const fit = extra.vecs.map((vec) => cosine(vec, host.centroid)).sort((a, b) => a - b);
    const median = fit[Math.floor(fit.length / 2)] ?? 0;
    const kept = fit.filter((score) => score >= MEMBER_FLOOR).length / fit.length;
    // A short file needs several shared event words (border+wall, Huang+affair), not one famous name.
    const anchored = (extra.members.length <= 12 && shared >= 4 && similarity >= 0.28 && median >= 0.28)
      || (extra.members.length === 1 && shared >= 3 && similarity >= 0.2 && median >= 0.2);
    const strong = similarity >= 0.58 && shared >= 4;
    if (!anchored) {
      if (median < (strong ? 0.34 : 0.42)) continue;
      if (kept < (strong ? 0.5 : 0.75)) continue;
    }
    const vecs = host.vecs.concat(extra.vecs);
    const centroid = averageVec(vecs);
    const docs = left.docs.concat(right.docs);
    const times = [...left.members, ...right.members].map((member) => member.ts).filter((ts) => ts > 0).sort((a, b) => a - b);
    nodes[ia] = {
      members: left.members.concat(right.members),
      docs,
      vecs,
      centroid,
      rare: signatureOf(docs),
      ts: times.length ? times[Math.floor(times.length / 2)] : 0,
    };
    parent[ib] = ia;
  }

  return nodes.filter((_, index) => find(index) === index).map((node) => node.members);
}
