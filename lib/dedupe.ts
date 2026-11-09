// Identity dedupe for the wire and the archive. Exact copies only:
// a canonical link, a guid, or a normalized title. Different headlines stay apart.
// Satire never folds into news.

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: "-", ndash: "-", hellip: "...",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => NAMED[n.toLowerCase()] ?? m);
}

function safeChar(n: number): string {
  try { return String.fromCodePoint(n); } catch { return ""; }
}

const TRACKING = /^(utm_[a-z0-9_]*|fbclid|gclid|gclsrc|dclid|gbraid|wbraid|mc_cid|mc_eid|igshid|igsh|_ga|_gl|yclid|twclid|msclkid|vero_id|vero_conv|_hsenc|_hsmi|mkt_tok|oly_anon_id|oly_enc_id|s_cid|ncid|mbid|cmpid|rss|via|share|soc_src|soc_trk|fb_action_ids|fb_action_types|fb_source|fb_ref|ref|ref_src|ref_url|spm|ocid|ito|sr_share|taid|feature)$/i;

export function canonicalLink(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    const params = [...url.searchParams.entries()]
      .filter(([key]) => !TRACKING.test(key))
      .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const search = new URLSearchParams();
    for (const [key, value] of params) search.append(key, value);
    const query = search.toString();
    return `https://${host}${path}${query ? `?${query}` : ""}`;
  } catch {
    return "";
  }
}

export function canonicalTitle(raw: string): string {
  return decodeEntities(raw).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function canonicalGuid(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return canonicalLink(trimmed);
  return trimmed.toLowerCase();
}

function earlier(a: number, b: number): boolean {
  if (a > 0 && b > 0) return a <= b;
  if (a > 0) return true;
  if (b > 0) return false;
  return true;
}

export interface DedupeAccess<T> {
  link: (item: T) => string;
  guid: (item: T) => string;
  title: (item: T) => string;
  outlet: (item: T) => string;
  published: (item: T) => number;
  satire: (item: T) => boolean;
  merge: (kept: T, other: T) => T;
}

export interface ArchiveIdentity {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  image: string | null;
  published_at: string | null;
  outlets: number;
  breaking: boolean;
  votes: number;
  score?: number;
}

export function dedupeArchive<T extends ArchiveIdentity>(rows: T[]): T[] {
  return dedupeStories(rows, {
    link: (row) => row.link,
    guid: () => "",
    title: (row) => row.title,
    outlet: (row) => row.source,
    published: (row) => (row.published_at ? Date.parse(row.published_at) || 0 : 0),
    satire: (row) => row.category === "satire",
    merge: (earlier, later) => ({
      ...earlier,
      image: earlier.image || later.image,
      votes: (earlier.votes || 0) + (later.votes || 0),
      score: (earlier.score || 0) + (later.score || 0),
      breaking: earlier.breaking || later.breaking,
      outlets: earlier.source === later.source ? Math.max(earlier.outlets || 0, later.outlets || 0) : (earlier.outlets || 0) + (later.outlets || 0),
    }),
  });
}

export function dedupeStories<T>(items: T[], access: DedupeAccess<T>): T[] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const unite = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const linkOf = new Map<string, number>();
  const guidOf = new Map<string, number>();
  const titleOutletOf = new Map<string, number>();
  const titleOf = new Map<string, number>();
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const desk = access.satire(item) ? "s" : "n";
    const hits: number[] = [];
    const link = canonicalLink(access.link(item));
    const guid = canonicalGuid(access.guid(item));
    const title = canonicalTitle(access.title(item));
    const outlet = access.outlet(item).trim().toLowerCase();
    if (link) {
      const key = `${desk}|l|${link}`;
      const prev = linkOf.get(key);
      if (prev !== undefined) hits.push(prev);
      linkOf.set(key, index);
    }
    if (guid) {
      const key = `${desk}|g|${guid}`;
      const prev = guidOf.get(key);
      if (prev !== undefined) hits.push(prev);
      guidOf.set(key, index);
    }
    if (title) {
      const outletKey = `${desk}|o|${outlet}|${title}`;
      const prevOutlet = titleOutletOf.get(outletKey);
      if (prevOutlet !== undefined) hits.push(prevOutlet);
      titleOutletOf.set(outletKey, index);
      const titleKey = `${desk}|t|${title}`;
      const prevTitle = titleOf.get(titleKey);
      if (prevTitle !== undefined) hits.push(prevTitle);
      titleOf.set(titleKey, index);
    }
    for (const hit of hits) unite(index, hit);
  }
  const groups = new Map<number, number[]>();
  for (let index = 0; index < items.length; index++) {
    const root = find(index);
    const list = groups.get(root);
    if (list) list.push(index);
    else groups.set(root, [index]);
  }
  const out: T[] = [];
  for (const indexes of groups.values()) {
    let kept = items[indexes[0]];
    for (let cursor = 1; cursor < indexes.length; cursor++) {
      const other = items[indexes[cursor]];
      if (earlier(access.published(kept), access.published(other))) kept = access.merge(kept, other);
      else kept = access.merge(other, kept);
    }
    out.push(kept);
  }
  return out;
}
