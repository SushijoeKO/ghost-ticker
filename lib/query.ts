import { clearance } from "./clearance.ts";
import { canonicalLink } from "./dedupe.ts";

export const SECTIONS = ["breaking", "politics", "weird", "sports", "entertainment", "pop-culture", "satire"] as const;
export type SectionId = (typeof SECTIONS)[number];

export const RANGES = ["1h", "6h", "24h", "7d"] as const;
export type RangeId = (typeof RANGES)[number];

const RANGE_MS: Record<RangeId, number> = {
  "1h": 3600e3,
  "6h": 6 * 3600e3,
  "24h": 24 * 3600e3,
  "7d": 7 * 24 * 3600e3,
};

export const SECTION_LABEL: Record<SectionId, string> = {
  breaking: "Breaking",
  politics: "Politics",
  weird: "Offbeat",
  sports: "Sports",
  entertainment: "Entertainment",
  "pop-culture": "Pop culture",
  satire: "Disinfo Desk",
};

export interface Filters {
  q: string;
  section: SectionId | "";
  outlet: string;
  range: RangeId | "";
  level: 1 | 2 | 3 | 4 | 0;
  satire: boolean;
}

export interface SearchDoc {
  id: string;
  title: string;
  snippet: string;
  titles: string[];
  snippets: string[];
  source: string;
  link: string;
  image: string | null;
  ts: number;
  category: string;
  categories: string[];
  breaking: boolean;
  satire: boolean;
  outlets: number;
  outletNames: string[];
  votes: number;
  archiveRank?: number;
}

const EMPTY: Filters = { q: "", section: "", outlet: "", range: "", level: 0, satire: false };

function one(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

export function parseFilters(sp: Record<string, string | string[] | undefined>): Filters {
  const section = one(sp.section).toLowerCase();
  const range = one(sp.range);
  const level = Number(one(sp.level));
  const satireFlag = one(sp.satire);
  return {
    q: one(sp.q).slice(0, 120),
    section: (SECTIONS as readonly string[]).includes(section) ? section as SectionId : "",
    outlet: one(sp.outlet).slice(0, 80),
    range: (RANGES as readonly string[]).includes(range) ? range as RangeId : "",
    level: level === 1 || level === 2 || level === 3 || level === 4 ? level : 0,
    satire: satireFlag === "1" || satireFlag === "true" || section === "satire",
  };
}

export function hasFilters(f: Filters): boolean {
  return !!(f.q || f.section || f.outlet || f.range || f.level || f.satire);
}

export function filterQuery(f: Filters, extra?: Record<string, string>): string {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.section) params.set("section", f.section);
  if (f.outlet) params.set("outlet", f.outlet);
  if (f.range) params.set("range", f.range);
  if (f.level) params.set("level", String(f.level));
  if (f.satire && f.section !== "satire") params.set("satire", "1");
  if (extra) for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function termsOf(q: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of q.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < 2 || seen.has(raw)) continue;
    seen.add(raw);
    out.push(raw);
    if (out.length >= 8) break;
  }
  return out;
}

function hay(value: string): string {
  return value.toLowerCase();
}

export function relevance(doc: SearchDoc, terms: string[]): number {
  if (!terms.length && doc.archiveRank == null) return 0;
  const titles = doc.titles.map(hay);
  const snippets = doc.snippets.map(hay);
  const outlets = doc.outletNames.join(" ").toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (titles[0]?.includes(term)) score += 6;
    else if (titles.some((title) => title.includes(term))) score += 4;
    if (snippets.some((snippet) => snippet.includes(term))) score += 2;
    if (outlets.includes(term)) score += 3;
  }
  const phrase = terms.join(" ");
  if (phrase.length > 3 && titles[0]?.includes(phrase)) score += 10;
  if (doc.archiveRank != null) score += Math.max(1, 8 - doc.archiveRank);
  return score;
}

export function matchesFilters(doc: SearchDoc, filters: Filters, now: number): boolean {
  if (doc.satire && !filters.satire && filters.section !== "satire") return false;
  if (filters.section === "satire" && !doc.satire) return false;
  if (filters.section === "breaking" && (!doc.breaking || doc.satire)) return false;
  if (filters.section && filters.section !== "breaking" && filters.section !== "satire") {
    const wanted = filters.section;
    if (doc.category !== wanted && !doc.categories.includes(wanted)) return false;
  }
  if (filters.outlet) {
    const needle = filters.outlet.toLowerCase();
    if (!doc.outletNames.some((name) => name.toLowerCase().includes(needle))) return false;
  }
  if (filters.range) {
    if (!doc.ts || now - doc.ts > RANGE_MS[filters.range]) return false;
  }
  if (filters.level) {
    if (doc.satire) return false;
    if (clearance(doc.outlets).lvl !== filters.level) return false;
  }
  if (filters.q) {
    const terms = termsOf(filters.q);
    if (!terms.length) return true;
    const blob = `${doc.titles.join(" ")} ${doc.snippets.join(" ")} ${doc.outletNames.join(" ")}`.toLowerCase();
    if (!terms.every((term) => blob.includes(term)) && doc.archiveRank == null) return false;
  }
  return true;
}

export function rankDocs(docs: SearchDoc[], filters: Filters): SearchDoc[] {
  const terms = termsOf(filters.q);
  return docs
    .map((doc) => ({ doc, rel: relevance(doc, terms) }))
    .filter((row) => !terms.length || row.rel > 0 || row.doc.archiveRank != null)
    .sort((a, b) => b.rel - a.rel || b.doc.ts - a.doc.ts || b.doc.outlets - a.doc.outlets)
    .map((row) => row.doc);
}

export function clusterToDoc(cluster: {
  id: string;
  satire: boolean;
  breaking: boolean;
  outlets: number;
  categories: string[];
  image: string | null;
  lead: { title: string; snippet?: string; link: string; ts: number; source: { name: string; category: string } };
  members: { title: string; snippet?: string; source: string; link: string }[];
}): SearchDoc {
  const names = [...new Set([cluster.lead.source.name, ...cluster.members.map((member) => member.source)].filter(Boolean))];
  return {
    id: cluster.id,
    title: cluster.lead.title,
    snippet: cluster.lead.snippet ?? "",
    titles: [cluster.lead.title, ...cluster.members.map((member) => member.title)],
    snippets: [cluster.lead.snippet ?? "", ...cluster.members.map((member) => member.snippet ?? "")],
    source: cluster.lead.source.name,
    link: cluster.lead.link,
    image: cluster.image,
    ts: cluster.lead.ts,
    category: cluster.lead.source.category,
    categories: cluster.categories,
    breaking: cluster.breaking,
    satire: cluster.satire,
    outlets: cluster.outlets,
    outletNames: names,
    votes: 0,
  };
}

export interface ArchiveHit {
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
  rank?: number;
}

export function archiveToDoc(row: ArchiveHit): SearchDoc {
  const ts = row.published_at ? Date.parse(row.published_at) || 0 : 0;
  return {
    id: row.id,
    title: row.title,
    snippet: "",
    titles: [row.title],
    snippets: [],
    source: row.source,
    link: row.link,
    image: row.image,
    ts,
    category: row.category,
    categories: [row.category],
    breaking: row.breaking,
    satire: row.category === "satire",
    outlets: row.outlets || 1,
    outletNames: [row.source],
    votes: row.votes || 0,
    archiveRank: row.rank,
  };
}

/** Fold archive hits into the current clusters when the link is already on the wire. */
export function combineWithMembers(wire: SearchDoc[], memberLinks: Map<string, string>, archive: SearchDoc[]): SearchDoc[] {
  const byId = new Map(wire.map((doc) => [doc.id, doc]));
  for (const row of archive) {
    const link = canonicalLink(row.link);
    const clusterId = (link && memberLinks.get(link)) || (byId.has(row.id) ? row.id : "");
    if (clusterId && byId.has(clusterId)) {
      const existing = byId.get(clusterId)!;
      if (existing.archiveRank == null) existing.archiveRank = row.archiveRank;
      continue;
    }
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function highlightParts(text: string, terms: string[]): { text: string; hit: boolean }[] {
  if (!text) return [];
  if (!terms.length) return [{ text, hit: false }];
  const escaped = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean);
  if (!escaped.length) return [{ text, hit: false }];
  const re = new RegExp(`(${escaped.join("|")})`, "ig");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: text.slice(last, index), hit: false });
    parts.push({ text: match[0], hit: true });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}

export { EMPTY as EMPTY_FILTERS };
