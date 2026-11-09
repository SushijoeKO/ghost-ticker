import { cache } from "react";
import { XMLParser } from "fast-xml-parser";
import { SOFT, SOURCES, type Category, type Source } from "./sources.ts";
import { REVALIDATE_SECONDS, SITE } from "./config.ts";
import { locate } from "./locator.ts";
import { group } from "./cluster.ts";
import { tagFor, type Tag } from "./tags.ts";
import type { Place } from "./places.ts";
import { canonicalLink, dedupeStories } from "./dedupe.ts";

export interface ItemAlt { name: string; link: string; category: Category }

export interface Item {
  title: string;
  link: string;
  snippet: string;
  ts: number; // ms epoch, 0 when the feed gave no date
  image: string | null; // publisher's own feed image URL (hotlinked, never rehosted)
  source: Source;
  place: string | null;
  placeLevel?: number;
  placeCountry?: string | null;
  geo: Place | null;
  guid?: string;
  alts?: ItemAlt[];
}

export interface Cluster {
  id: string; // stable: hash of the earliest member's link
  lead: Item;
  also: { name: string; link: string }[];
  categories: Category[];
  breaking: boolean;
  score: number;
  tag: Tag | null;
  image: string | null;
  geo: Place | null;
  outlets: number;
  links: string[]; // every member link (server-side id verification)
  images: string[]; // candidate feed images: lead's first, then cluster-mates'
  satire: boolean; // joke cluster: no clearance level, never breaking
}

export interface Wire {
  clusters: Cluster[];
  fetchedAt: number;
  feeds: { id: string; name: string; ok: boolean; reached: boolean; count: number }[];
}

const MAX_AGE_MS = 4 * 24 * 3600 * 1000;
/** Satire outlets often post weekly. Keep two weeks of jokes; news stays at four days. */
const SATIRE_MAX_AGE_MS = 14 * 24 * 3600 * 1000;
const SNIPPET_MAX = 160;
const HOUR = 3600 * 1000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
});

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘",
  rdquo: "”", ldquo: "“", mdash: "—", ndash: "–", hellip: "…", eacute: "é",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}
function safeChar(n: number) {
  try { return String.fromCodePoint(n); } catch { return ""; }
}

export function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return text(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return text(o["#text"]);
  }
  return "";
}

export function clean(s: string): string {
  let out = decodeEntities(s);
  out = out.replace(/<[^>]*>/g, " ");
  out = decodeEntities(out);
  return out.replace(/\s+/g, " ").trim();
}

function linkOf(entry: Record<string, unknown>): string {
  const l = entry.link;
  let href = "";
  if (typeof l === "string") href = l;
  else if (Array.isArray(l)) {
    const alt = l.find((x) => typeof x === "object" && x && ((x as any)["@_rel"] ?? "alternate") === "alternate") ?? l[0];
    href = typeof alt === "string" ? alt : (alt as any)?.["@_href"] ?? text(alt);
  } else if (l && typeof l === "object") href = (l as any)["@_href"] ?? text(l);
  if (!href) {
    const gs = text(entry.guid);
    if (/^https?:\/\//.test(gs)) href = gs;
  }
  href = href.trim();
  return /^https?:\/\//i.test(href) ? href : "";
}

function dateOf(entry: Record<string, unknown>): number {
  const raw = text(entry.pubDate) || text(entry["dc:date"]) || text(entry.published) || text(entry.updated);
  if (!raw) return 0;
  const fixed = raw.replace(/\bEST\b/, "-0500").replace(/\bEDT\b/, "-0400").replace(/\bPST\b/, "-0800").replace(/\bPDT\b/, "-0700");
  const t = Date.parse(fixed);
  return Number.isFinite(t) ? t : 0;
}

// ---------- feed images ----------
// Publishers whose image CDNs refuse cross-site embedding (CORP/ORB): respect that and use the placeholder instead.
export { NO_HOTLINK } from "./hotlink.ts";
import { NO_HOTLINK } from "./hotlink.ts";
const asArr = (v: unknown): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
function okImg(u: unknown): string | null {
  if (typeof u !== "string") return null;
  let s = decodeEntities(u.trim());
  if (s.startsWith("//")) s = "https:" + s;
  if (!/^https:\/\/[^\s"'<>]+$/i.test(s) || s.length > 1000 || NO_HOTLINK.test(s)) return null;
  if (/\.(mp4|mp3|m4a|webm|mov|swf)(\?|$)/i.test(s) || /(pixel|tracking|1x1|spacer|feedburner\.com\/~r|doubleclick)/i.test(s)) return null;
  return s;
}
export function imageOf(e: Record<string, any>): string | null {
  const cands: { url: string; w: number }[] = [];
  const push = (node: any, needImage: boolean) => {
    for (const m of asArr(node)) {
      if (!m || typeof m !== "object") continue;
      const url = okImg(m["@_url"] ?? m["@_href"]);
      if (!url) continue;
      const type = String(m["@_type"] ?? m["@_medium"] ?? "");
      if (needImage && type && !/image/i.test(type)) continue;
      cands.push({ url, w: Number(m["@_width"]) || 0 });
    }
  };
  push(e["media:content"], true);
  for (const g of asArr(e["media:group"])) { push(g?.["media:content"], true); push(g?.["media:thumbnail"], false); }
  push(e["media:thumbnail"], false);
  push(e.enclosure, true);
  if (e["itunes:image"]) push(e["itunes:image"], false);
  if (cands.length) return cands.sort((a, b) => b.w - a.w)[0].url;
  const html = text(e["content:encoded"]) + " " + text(e.description) + " " + text(e.summary) + " " + text(e.content);
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? okImg(m[1]) : null;
}

export function parseFeed(xml: string, source: Source, now = Date.now()): Item[] {
  const doc = parser.parse(xml);
  let entries: unknown = doc?.rss?.channel?.item ?? doc?.["rdf:RDF"]?.item ?? doc?.feed?.entry ?? doc?.channel?.item ?? [];
  if (!Array.isArray(entries)) entries = [entries];
  const items: Item[] = [];
  for (const e of entries as Record<string, unknown>[]) {
    if (!e || typeof e !== "object") continue;
    const title = clean(text(e.title));
    const link = linkOf(e);
    if (!title || !link || title.length < 12) continue;
    let ts = dateOf(e);
    if (ts > now) ts = now;
    const maxAge = source.category === "satire" ? SATIRE_MAX_AGE_MS : MAX_AGE_MS;
    if (ts && now - ts > maxAge) continue;
    let snippet = clean(text(e.description) || text(e.summary));
    if (snippet.toLowerCase().startsWith(title.toLowerCase().slice(0, 40))) snippet = "";
    if (snippet.length > SNIPPET_MAX) snippet = snippet.slice(0, SNIPPET_MAX).replace(/\s+\S*$/, "") + "…";
    const t = title.slice(0, 220);
    const geo = locate(t, snippet);
    const guid = text(e.guid).trim();
    items.push({ title: t, link, snippet, ts, image: imageOf(e as Record<string, any>), source, geo, place: geo?.name ?? null, placeLevel: geo?.level, placeCountry: geo?.country ?? null, guid: guid || undefined });
  }
  return items.slice(0, 40);
}

// One slow or broken feed must not stall the sweep: a concurrency cap, a per-feed
// timeout, and a cycle budget. Anything still queued when the budget expires is skipped.
const FEED_CONCURRENCY = 20;
const FEED_TIMEOUT_MS = 8000;
const CYCLE_BUDGET_MS = 45000;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < items.length) {
      const k = next++;
      try { out[k] = await fn(items[k]); }
      catch { out[k] = null as R; }
    }
  }));
  return out;
}

async function fetchSource(source: Source, cycle?: AbortSignal): Promise<Item[] | null> {
  if (cycle?.aborted) return null;
  try {
    const timeout = AbortSignal.timeout(FEED_TIMEOUT_MS);
    const res = await fetch(source.url, {
      headers: {
        "User-Agent": `GhostTicker/1.0 (headline aggregator; +${SITE.url}/about)`,
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5",
      },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: cycle ? AbortSignal.any([timeout, cycle]) : timeout,
    });
    if (!res.ok) return null;
    return parseFeed(await res.text(), source);
  } catch {
    return null; // a failing feed is skipped, never fatal
  }
}

// ---------- breaking detection ----------
const BREAKING_RE = /\b(breaking|just in|developing|live updates?|live:|shooting|shooter|gunman|explosion|blast|killed|dead|deaths?|dies|earthquake|tsunami|hurricane|tornado|wildfire|evacuat\w*|attack|strike[sd]?|missile|crash(es|ed)?|derail\w*|hostage|manhunt|lockdown|emergency|outage|indicted|arrested|resign\w*|impeach\w*|verdict|ceasefire|invasion|coup|assassinat\w*|projected)\b/i;

export function isBreaking(c: { lead: Item; also: unknown[]; categories: Category[] }, now: number): boolean {
  const { lead } = c;
  if (lead.source.category === "satire" || c.categories.includes("satire")) return false;
  if (!lead.ts) return false;
  const age = now - lead.ts;
  // the lead itself must come from a hard-news desk: a sports/entertainment piece that merely clusters
  // with a news-wire copy (betting promos, recaps) is never breaking
  const hard = (k: Category) => k === "top" || k === "politics" || k === "us" || k === "world";
  const hardNews = hard(lead.source.category) && c.categories.some(hard);
  if (!hardNews) return false;
  if (/^\s*(breaking|just in)\b/i.test(lead.title) && age <= 6 * HOUR) return true;
  if (age <= 3 * HOUR && BREAKING_RE.test(lead.title)) return true;
  if (age <= 1 * HOUR && c.also.length >= 2) return true;
  return false;
}

export function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  let h2 = 5381;
  for (let i = 0; i < s.length; i++) h2 = (Math.imul(h2, 33) ^ s.charCodeAt(i)) >>> 0;
  return (h >>> 0).toString(36) + (h2 % 46656).toString(36).padStart(3, "0");
}

function clustersFrom(groups: Item[][], now: number, satire: boolean): Cluster[] {
  const clusters: Cluster[] = [];
  for (const members of groups) {
    const lead = members[0]; // newest first
    const anchor = [...members].sort((a, b) => (a.ts || Infinity) - (b.ts || Infinity))[0];
    const also: { name: string; link: string }[] = [];
    const cats: Category[] = [];
    for (const m of members) {
      if (!cats.includes(m.source.category)) cats.push(m.source.category);
      if (m !== lead && m.source.name !== lead.source.name && !also.some((a) => a.name === m.source.name)) also.push({ name: m.source.name, link: m.link });
      for (const alt of m.alts ?? []) {
        if (!cats.includes(alt.category)) cats.push(alt.category);
        if (alt.name !== lead.source.name && !also.some((a) => a.name === alt.name)) also.push({ name: alt.name, link: alt.link });
      }
    }
    const images = [...new Set([lead.image, ...members.map((m) => m.image)].filter((x): x is string => !!x))];
    const image = images[0] ?? null;
    const geo = members.map((m) => m.geo).filter(Boolean).sort((a, b) => b!.level - a!.level)[0] ?? null;
    // Satire outlets are not clearance sources. The count stays on the cluster for the
    // "+ more outlets" line, but the badge is DISINFO and the number is not a level.
    const c: Cluster = { id: hash(canonicalLink(anchor.link) || anchor.link), lead, also, categories: cats, breaking: false, score: 0, tag: null, image, geo, outlets: satire ? 0 : 1 + also.length, links: members.map((m) => m.link), images, satire };
    if (!satire) {
      c.breaking = isBreaking(c, now);
      c.tag = tagFor({ title: lead.title, snippet: lead.snippet, category: lead.source.category, categories: cats, breaking: c.breaking });
    }
    const ageH = lead.ts ? (now - lead.ts) / HOUR : 48;
    c.score = also.length * 3 + (c.breaking ? 6 : 0) - ageH;
    clusters.push(c);
  }
  return clusters;
}

function mergeItems(earlier: Item, later: Item): Item {
  const alts = [...(earlier.alts ?? [])];
  const push = (name: string, link: string, category: Category) => {
    if (!name || name === earlier.source.name || alts.some((alt) => alt.name === name)) return;
    alts.push({ name, link, category });
  };
  for (const alt of later.alts ?? []) push(alt.name, alt.link, alt.category);
  push(later.source.name, later.link, later.source.category);
  return { ...earlier, image: earlier.image || later.image, guid: earlier.guid || later.guid, alts: alts.length ? alts : undefined };
}

export function dedupeItems(items: Item[]): Item[] {
  return dedupeStories(items, {
    link: (item) => item.link,
    guid: (item) => item.guid ?? "",
    title: (item) => item.title,
    outlet: (item) => item.source.name,
    published: (item) => item.ts,
    satire: (item) => item.source.category === "satire",
    merge: mergeItems,
  });
}

export function buildClusters(items: Item[], now = Date.now()): Cluster[] {
  // Collapse exact copies (canonical link, guid, or normalized title) before ranking.
  const unique = dedupeItems(items);
  const news: Item[] = [];
  const jokes: Item[] = [];
  for (const it of unique) (it.source.category === "satire" ? jokes : news).push(it);
  // Cluster the two desks separately so a joke can never raise a news story's outlet count.
  const clusters = [...clustersFrom(group(news), now, false), ...clustersFrom(group(jokes), now, true)];
  return clusters.sort((a, b) => b.lead.ts - a.lead.ts);
}

/** Same wire, plus photo discovery (cluster-mates, archive, og:image) for pages that show images. */
export const getWireWithImages = cache(async (): Promise<Wire> => {
  const w = await getWire();
  const { enrichImages } = await import("./images");
  await enrichImages(w.clusters, w.fetchedAt).catch(() => {});
  return w;
});

export const getWire = cache(async (): Promise<Wire> => {
  const cycle = AbortSignal.timeout(CYCLE_BUDGET_MS);
  const results = await mapLimit(SOURCES, FEED_CONCURRENCY, (source) => fetchSource(source, cycle));
  const items: Item[] = [];
  const feeds = SOURCES.map((s, i) => {
    const r = results[i];
    if (r) items.push(...r);
    return { id: s.id, name: s.name, ok: !!r && r.length > 0, reached: !!r, count: r?.length ?? 0 };
  });
  const now = Date.now();
  return { clusters: buildClusters(items, now), fetchedAt: now, feeds };
});

export function inCategory(w: Wire, cat: Category | "breaking"): Cluster[] {
  if (cat === "breaking") return w.clusters.filter((c) => c.breaking && !c.satire);
  // The satire column is jokes only. A real story never lands here, even if the words match.
  if (cat === "satire") return w.clusters.filter((c) => c.satire && c.lead.source.category === "satire");
  // soft desks only carry stories led by a soft-desk outlet: a hard-news story that a sports or
  // entertainment feed also ran (a shooting, a crash) stays on the news desks
  if (SOFT.includes(cat)) return w.clusters.filter((c) => !c.satire && c.categories.includes(cat) && SOFT.includes(c.lead.source.category));
  return w.clusters.filter((c) => !c.satire && c.categories.includes(cat));
}

export function topStory(w: Wire): Cluster | undefined {
  const now = w.fetchedAt;
  const news = w.clusters.filter((c) => !c.satire);
  const pool = news.filter((c) => c.lead.ts && now - c.lead.ts < 8 * HOUR && c.categories.some((k) => !SOFT.includes(k)));
  const breaking = pool.filter((c) => c.breaking);
  // among similarly ranked stories, prefer one with a working photo (+4 ≈ one extra outlet and change)
  const pick = (arr: Cluster[]) => [...arr].sort((a, b) => b.score + (b.image ? 4 : 0) - (a.score + (a.image ? 4 : 0)))[0];
  return pick(breaking) ?? pick(pool) ?? news[0];
}

export function diversify(arr: Cluster[], n: number, cap: number, skip: Set<string> = new Set()): Cluster[] {
  const out: Cluster[] = [];
  const per = new Map<string, number>();
  const rest: Cluster[] = [];
  for (const c of arr) {
    if (skip.has(c.id)) continue;
    const k = c.lead.source.name;
    if ((per.get(k) ?? 0) < cap) {
      per.set(k, (per.get(k) ?? 0) + 1);
      out.push(c);
      if (out.length >= n) break;
    } else rest.push(c);
  }
  for (const c of rest) { if (out.length >= n) break; out.push(c); }
  const ids = new Set(out.map((c) => c.id));
  return arr.filter((c) => ids.has(c.id));
}

const bucketOf = (l: string) => (/Left/.test(l) ? "L" : /Right/.test(l) ? "R" : "C");
export function balanceByLean(arr: Cluster[], n: number, cap: number, skip: Set<string> = new Set()): Cluster[] {
  const buckets: Record<string, Cluster[]> = { L: [], R: [], C: [] };
  for (const c of arr) if (!skip.has(c.id)) buckets[bucketOf(c.lead.source.lean)].push(c);
  const per = new Map<string, number>();
  const picked = new Set<string>();
  const idx: Record<string, number> = { L: 0, R: 0, C: 0 };
  let progress = true;
  while (picked.size < n && progress) {
    progress = false;
    for (const k of ["L", "R", "C"]) {
      if (picked.size >= n) break;
      const list = buckets[k];
      while (idx[k] < list.length) {
        const c = list[idx[k]++];
        const s = c.lead.source.name;
        if ((per.get(s) ?? 0) >= cap) continue;
        per.set(s, (per.get(s) ?? 0) + 1);
        picked.add(c.id);
        progress = true;
        break;
      }
    }
  }
  return arr.filter((c) => picked.has(c.id));
}

// ---------- map pins ----------
export interface Pin { id: string; name: string; x: number; y: number; level: number; newest: number; breaking: boolean; count: number; items: { id: string; title: string; link: string; source: string; ts: number; breaking: boolean }[] }
export function pinsFrom(clusters: Cluster[], limit = 80): Pin[] {
  const map = new Map<string, Pin>();
  for (const c of clusters) {
    if (!c.geo) continue;
    const key = c.geo.name;
    let p = map.get(key);
    if (!p) { p = { id: hash(key), name: c.geo.name, x: c.geo.x, y: c.geo.y, level: c.geo.level, newest: 0, breaking: false, count: 0, items: [] }; map.set(key, p); }
    p.count++;
    p.newest = Math.max(p.newest, c.lead.ts);
    p.breaking ||= c.breaking;
    if (p.items.length < 8) p.items.push({ id: c.id, title: c.lead.title, link: c.lead.link, source: c.lead.source.name, ts: c.lead.ts, breaking: c.breaking });
  }
  return [...map.values()].sort((a, b) => Number(b.breaking) - Number(a.breaking) || b.newest - a.newest).slice(0, limit);
}
