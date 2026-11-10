// Server-only Supabase access. Never import this from a "use client" file.
// SUPABASE_URL / SUPABASE_ANON_KEY are used only on the server (the browser talks to our own /api routes),
// and GT_INGEST_KEY is a server-only secret that authorizes the gt_ingest RPC.
import { stableClusterId, type Cluster } from "./feeds.ts";
import { group } from "./cluster.ts";
import { dedupeArchive } from "./dedupe.ts";
import type { StoryFile } from "./stories.ts";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;

export const dbEnabled = () => !!(URL_ && KEY);

async function rpc<T>(fn: string, body: unknown, opts: { revalidate?: number; timeout?: number } = {}): Promise<T | null> {
  if (!URL_ || !KEY) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(opts.revalidate ? { next: { revalidate: opts.revalidate } } : {}),
      signal: AbortSignal.timeout(opts.timeout ?? 6000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ArchiveRow { id: string; title: string; link: string; source: string; category: string; image: string | null; published_at: string | null; outlets: number; breaking: boolean; votes: number }

/** gt_ingest accepts at most this many rows per call. */
export const INGEST_BATCH_LIMIT = 2000;
/** Two batches in flight. A sweep is a few thousand stories, so this stays near one round trip. */
const INGEST_CONCURRENCY = 2;

export interface Ingestible {
  id: string;
  lead: { title: string; link: string; ts: number; source: { name: string; category: string } };
  image: string | null;
  outlets: number;
  breaking: boolean;
}

/**
 * Order stories so a slower desk (satire posts less often than the wires) is not
 * pushed past the end of a newest-first list. Each category gives its newest
 * remaining story in turn. `cap` stops early; the default keeps every story.
 */
export function archiveQueue<T extends Ingestible>(clusters: T[], cap = Infinity): T[] {
  const buckets = new Map<string, T[]>();
  for (const c of clusters) {
    const key = c.lead.source.category || "top";
    const list = buckets.get(key);
    if (list) list.push(c);
    else buckets.set(key, [c]);
  }
  for (const list of buckets.values()) list.sort((a, b) => (b.lead.ts || 0) - (a.lead.ts || 0));
  const keys = [...buckets.keys()].sort();
  const out: T[] = [];
  let progress = true;
  while (out.length < cap && progress) {
    progress = false;
    for (const key of keys) {
      const next = buckets.get(key)!.shift();
      if (!next) continue;
      out.push(next);
      progress = true;
      if (out.length >= cap) break;
    }
  }
  return out;
}

/** Split a fair queue into RPC-sized batches. Every batch is within INGEST_BATCH_LIMIT. */
export function planIngest<T extends Ingestible>(clusters: T[], cap = Infinity): T[][] {
  const queued = archiveQueue(clusters, cap);
  const batches: T[][] = [];
  for (let i = 0; i < queued.length; i += INGEST_BATCH_LIMIT) batches.push(queued.slice(i, i + INGEST_BATCH_LIMIT));
  return batches;
}

function toIngestRow(c: Ingestible, idOverride?: string) {
  return {
    id: idOverride ?? c.id, title: c.lead.title, link: c.lead.link, source: c.lead.source.name, category: c.lead.source.category,
    image: c.image ?? "", ts: c.lead.ts ? new Date(c.lead.ts).toISOString() : "", outlets: c.outlets, breaking: c.breaking,
  };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const k = next++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

export async function ingest(clusters: Cluster[], idOverride?: string): Promise<number | null> {
  const key = process.env.GT_INGEST_KEY;
  if (!key) return null;
  // A vote re-archives one story under a caller-supplied id. Don't fan that out.
  const batches = planIngest(idOverride ? clusters.slice(0, 1) : clusters);
  if (!batches.length) return 0;
  const counts = await mapLimit(batches, INGEST_CONCURRENCY, (items) =>
    rpc<number>("gt_ingest", { p_key: key, p_items: items.map((c) => toIngestRow(c, idOverride)) }, { timeout: 10000 }));
  if (counts.every((n) => n == null)) return null;
  return counts.reduce<number>((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
}

export const search = (q: string) => rpc<(ArchiveRow & { rank: number })[]>("gt_search", { p_q: q, p_limit: 80 }, { revalidate: 120 });
function clusterTrending<T extends ArchiveRow & { score?: number }>(rows: T[]): T[] {
  const tagged = rows.map((row) => ({
    title: row.title,
    link: row.link,
    ts: row.published_at ? Date.parse(row.published_at) || 0 : 0,
    source: { name: row.source, category: row.category },
    row,
  }));
  return group(tagged).map((members) => {
    const ranked = members.slice().sort((a, b) => (b.row.votes || 0) - (a.row.votes || 0) || (b.row.score || 0) - (a.row.score || 0) || b.ts - a.ts);
    const lead = ranked[0].row;
    const earliest = members.slice().sort((a, b) => (a.ts || Infinity) - (b.ts || Infinity))[0];
    const names = new Set(members.map((member) => member.row.source));
    return {
      ...lead,
      id: members.length === 1 ? lead.id : stableClusterId(earliest.link),
      image: lead.image || members.map((member) => member.row.image).find((image) => !!image) || null,
      votes: members.reduce((sum, member) => sum + (member.row.votes || 0), 0),
      score: members.reduce((sum, member) => sum + (member.row.score || 0), 0),
      breaking: members.some((member) => member.row.breaking),
      outlets: Math.max(lead.outlets || 0, ...members.map((member) => member.row.outlets || 0), names.size),
    };
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}

export async function trending(n = 20, revalidate = 60) {
  const rows = await rpc<(ArchiveRow & { score: number })[]>("gt_trending", { p_limit: Math.min(Math.max(n * 2, n), 80) }, { revalidate });
  if (!rows) return null;
  return clusterTrending(dedupeArchive(rows)).slice(0, n);
}
export const vote = (item: string, voter: string) => rpc<{ ok: boolean; already?: boolean; votes?: number; error?: string }>("gt_vote", { p_item: item, p_voter: voter });

/** Vote totals for the given ids (public read of gt_headlines). */
// live mode (revalidate null) also returns zero counts, so a cached page showing a stale higher total corrects itself
export async function voteCounts(ids: string[], revalidate: number | null = 60): Promise<Record<string, number>> {
  if (!URL_ || !KEY || !ids.length) return {};
  try {
    const list = ids.filter((i) => /^[a-z0-9]{4,16}$/.test(i)).slice(0, 300).join(",");
    const res = await fetch(`${URL_}/rest/v1/gt_headlines?select=id,votes${revalidate === null ? "" : "&votes=gt.0"}&id=in.(${list})`, {
      headers: { apikey: KEY }, ...(revalidate === null ? { cache: "no-store" as const } : { next: { revalidate } }), signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as { id: string; votes: number }[];
    return Object.fromEntries(rows.map((r) => [r.id, r.votes]));
  } catch {
    return {};
  }
}

export async function saveStories(clusters: Cluster[]): Promise<void> {
  const key = process.env.GT_INGEST_KEY;
  if (!key || !clusters.length) return;
  const rows = clusters.slice(0, 800).map((cluster) => ({
    id: cluster.id,
    title: cluster.lead.title,
    link: cluster.lead.link,
    source: cluster.lead.source.name,
    category: cluster.lead.source.category,
    image: cluster.image ?? "",
    ts: cluster.lead.ts ? new Date(cluster.lead.ts).toISOString() : "",
    outlets: cluster.outlets,
    breaking: cluster.breaking,
    snippet: (cluster.lead.snippet || "").slice(0, 160),
    members: cluster.members.slice(0, 30).map((member) => ({
      title: member.title, link: member.link, snippet: (member.snippet || "").slice(0, 160), ts: member.ts, source: member.source,
    })),
    aliases: [...new Set([cluster.id, ...cluster.members.map((member) => stableClusterId(member.link))].filter((alias) => /^[a-z0-9]{4,16}$/.test(alias)))],
  }));
  for (let i = 0; i < rows.length; i += 100) {
    await rpc<number>("gt_save_stories", { p_key: key, p_rows: rows.slice(i, i + 100) }, { timeout: 10000 });
  }
}

function storyFromArchive(row: ArchiveRow & { snippet?: string | null; members?: StoryFile["members"] }): StoryFile {
  const ts = row.published_at ? Date.parse(row.published_at) || 0 : 0;
  const members = row.members?.length ? row.members : [{ title: row.title, link: row.link, snippet: row.snippet || "", ts, source: row.source }];
  return {
    id: row.id, title: row.title, link: row.link, source: row.source, category: row.category, image: row.image,
    ts, snippet: (row.snippet || "").slice(0, 160), outlets: row.outlets, breaking: row.breaking,
    satire: row.category === "satire", tag: null, members,
  };
}

/** Resolve a stored cluster, a member link-hash, or a headline id. Null when the archive has never seen it. */
export async function lookupArchivedStory(id: string): Promise<{ story: StoryFile; redirectTo?: string } | null> {
  if (!URL_ || !KEY || !/^[a-z0-9]{4,16}$/.test(id)) return null;
  try {
    const headers = { apikey: KEY };
    const aliasRes = await fetch(`${URL_}/rest/v1/gt_story_alias?select=cluster_id&alias=eq.${id}`, {
      headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(4000),
    });
    if (aliasRes.ok) {
      const alias = (await aliasRes.json()) as { cluster_id: string }[];
      const clusterId = alias[0]?.cluster_id;
      if (clusterId && clusterId !== id) {
        const story = await readStoredStory(clusterId);
        if (story) return { story, redirectTo: clusterId };
      }
      if (clusterId) {
        const story = await readStoredStory(clusterId);
        if (story) return { story };
      }
    }
    const own = await readStoredStory(id);
    if (own) return { story: own };
    const headRes = await fetch(`${URL_}/rest/v1/gt_headlines?select=id,title,link,source,category,image,published_at,outlets,breaking,votes&id=eq.${id}`, {
      headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(4000),
    });
    if (!headRes.ok) return null;
    const heads = (await headRes.json()) as ArchiveRow[];
    if (!heads[0]) return null;
    return { story: storyFromArchive(heads[0]) };
  } catch {
    return null;
  }
}

async function readStoredStory(id: string): Promise<StoryFile | null> {
  if (!URL_ || !KEY) return null;
  const res = await fetch(`${URL_}/rest/v1/gt_stories?select=id,title,link,source,category,image,published_at,outlets,breaking,snippet,members&id=eq.${id}`, {
    headers: { apikey: KEY }, next: { revalidate: 300 }, signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as (ArchiveRow & { snippet?: string | null; members?: StoryFile["members"] })[];
  return rows[0] ? storyFromArchive(rows[0]) : null;
}

/** Previously discovered images for these ids (archive acts as the og:image cache). */
export async function knownImages(ids: string[]): Promise<Record<string, string>> {
  if (!URL_ || !KEY || !ids.length) return {};
  try {
    const list = ids.filter((i) => /^[a-z0-9]{4,16}$/.test(i)).slice(0, 200).join(",");
    const res = await fetch(`${URL_}/rest/v1/gt_headlines?select=id,image&image=not.is.null&id=in.(${list})`, {
      headers: { apikey: KEY }, next: { revalidate: 300 }, signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as { id: string; image: string }[];
    return Object.fromEntries(rows.map((r) => [r.id, r.image]));
  } catch {
    return {};
  }
}
