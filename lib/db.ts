// Server-only Supabase access. Never import this from a "use client" file.
// SUPABASE_URL / SUPABASE_ANON_KEY are used only on the server (the browser talks to our own /api routes),
// and GT_INGEST_KEY is a server-only secret that authorizes the gt_ingest RPC.
import type { Cluster } from "./feeds";
import { dedupeArchive } from "./dedupe.ts";

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

export const search = (q: string) => rpc<(ArchiveRow & { rank: number })[]>("gt_search", { p_q: q, p_limit: 50 });
export async function trending(n = 20, revalidate = 60) {
  const rows = await rpc<(ArchiveRow & { score: number })[]>("gt_trending", { p_limit: Math.min(Math.max(n * 2, n), 80) }, { revalidate });
  if (!rows) return null;
  return dedupeArchive(rows).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, n);
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
