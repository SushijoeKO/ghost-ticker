// Story clustering: groups the same event across outlets even when worded differently.
// Pure module (no imports) so it can be unit-tested with plain Node.

export interface CItem { title: string; link: string; ts: number; source?: unknown; place?: string | null; placeLevel?: number; placeCountry?: string | null }

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

export function tokens(title: string): string[] {
  const out = new Set<string>();
  for (const raw of title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]s\b/g, "").replace(/[^a-z0-9 -]+/g, " ").split(/\s+/)) {
    const w = raw.replace(/^-+|-+$/g, "");
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(SYN[w] ?? (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  }
  return [...out];
}

const EVENT = new Set(["shoot", "attack", "kill", "blast", "quake", "vote", "truce", "strike", "arrest", "quit", "fire", "storm", "crash"]);
const WINDOW_MS = 18 * 3600 * 1000;
// Generic words that can be rare in a big corpus and still not identify a story
// ("leaves thousands without" matched a Gaza flood to a Ukraine blackout).
const WEAK = new Set(
  ("leave left thousand hundred without people official officials police government president minister million billion " +
   "state city county north south east west home world time week today local authority heavy power shelter dark eastern " +
   "southern northern western report reports according source near after over under amid during while before across around " +
   "another still could would should other some many most such only even back down next last first second third year years " +
   "month months hour hours night morning evening update live video watch photo image breaking latest news tell told claim " +
   "claims warn warns call calls plan plans set sets ten tens made make take hit hits help helps").split(" ")
);

export interface Prepared<T extends CItem> { item: T; tok: string[]; set: Set<string> }

export function prepare<T extends CItem>(items: T[]) {
  const df = new Map<string, number>();
  const prepped: Prepared<T>[] = items.map((item) => {
    const tok = tokens(item.title);
    for (const t of tok) df.set(t, (df.get(t) ?? 0) + 1);
    return { item, tok, set: new Set(tok) };
  });
  const N = Math.max(items.length, 1);
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) ?? 0) + 0.5));
  const rareCut = Math.log((N + 1) / (Math.max(3, N * 0.012) + 0.5)); // ~top 1% frequency counts as common
  return { prepped, idf, isRare: (t: string) => idf(t) >= rareCut };
}

export function sameStory<T extends CItem>(a: Prepared<T>, b: Prepared<T>, idf: (t: string) => number, isRare: (t: string) => boolean): boolean {
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
  const union = a.set.size + b.set.size - inter;
  if (inter / union >= 0.5) return true;
  if (inter >= 4 && inter / Math.min(a.set.size, b.set.size) >= 0.75) return true;
  const wa = a.tok.reduce((s, t) => s + idf(t), 0), wb = b.tok.reduce((s, t) => s + idf(t), 0);
  const wContain = wShared / Math.max(1e-6, Math.min(wa, wb));
  if (wContain >= 0.55 && rare >= 2) return true;
  if (rare >= 3 && wContain >= 0.35) return true;
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

const MAX_GROUP = 25;

/** Satire outlets carry a category of "satire". Everything else, including items with no source, is news. */
function desk(item: CItem): "satire" | "news" {
  const src = item.source;
  if (src && typeof src === "object" && "category" in src && (src as { category?: unknown }).category === "satire") return "satire";
  return "news";
}

/** Union-find over all pairs inside the time window. Groups are capped to stop runaway chaining. Newest member first. */
export function group<T extends CItem>(items: T[]): T[][] {
  const { prepped, idf, isRare } = prepare(items);
  const n = prepped.length;
  const parent = prepped.map((_, i) => i);
  const size = prepped.map(() => 1);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const order = prepped.map((_, i) => i).sort((x, y) => prepped[y].item.ts - prepped[x].item.ts);
  for (let oi = 0; oi < n; oi++) {
    const i = order[oi];
    for (let oj = oi + 1; oj < n; oj++) {
      const j = order[oj];
      const a = prepped[i].item, b = prepped[j].item;
      if (a.ts && b.ts && a.ts - b.ts > WINDOW_MS) break; // sorted by time: everything further is older
      const ri = find(i), rj = find(j);
      if (ri === rj || size[ri] + size[rj] > MAX_GROUP) continue;
      // Satire never joins a real-news cluster, and a news story never joins a joke.
      if (desk(a) !== desk(b)) continue;
      // A digest headline can match two different stories. Once each story is already a
      // group, don't glue the groups together through that bridge.
      if (size[ri] >= 2 && size[rj] >= 2) continue;
      if (sameStory(prepped[i], prepped[j], idf, isRare)) { parent[rj] = ri; size[ri] += size[rj]; }
    }
  }
  const byRoot = new Map<number, T[]>();
  for (const i of order) { const r = find(i); if (!byRoot.has(r)) byRoot.set(r, []); byRoot.get(r)!.push(prepped[i].item); }
  return [...byRoot.values()];
}
