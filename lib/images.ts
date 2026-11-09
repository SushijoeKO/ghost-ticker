// Picks a real, embeddable photo for as many stories as possible, in this order:
// 1) the story's own feed image, 2) a cluster-mate outlet's feed image, 3) an image found earlier (archive),
// 4) the article's og:image / twitter:image. CDNs that refuse cross-site embedding are skipped.
import type { Cluster } from "./feeds";
import { NO_HOTLINK } from "./feeds";
import { embeddable, hostEmbeddable, ogImage, pool } from "./ogimage";
import { ingest, knownImages } from "./db";

const BUDGET_MS = 9000;
const MAX_OG = 120;
const hostOf = (u: string) => { try { return new URL(u).host; } catch { return ""; } };

// Parallel page renders (home + category pages regenerating together) take turns, so the later ones
// reuse the in-memory caches the first one filled instead of repeating the same lookups.
let queue: Promise<unknown> = Promise.resolve();
export function enrichImages(clusters: Cluster[], now: number) {
  const run = queue.then(() => enrich(clusters, now));
  queue = run.catch(() => null);
  return run;
}

async function enrich(clusters: Cluster[], now: number): Promise<{ feed: number; mate: number; archive: number; og: number; none: number }> {
  const deadline = Date.now() + BUDGET_MS;
  const stats = { feed: 0, mate: 0, archive: 0, og: 0, none: 0 };
  const recent = clusters.filter((c) => !c.lead.ts || now - c.lead.ts < 48 * 3600e3);

  // 1+2: host-level embed check on feed images (one sample per CDN host), then first usable candidate
  const samples = new Map<string, string>();
  for (const c of recent) for (const u of c.images) { const h = hostOf(u); if (h && !samples.has(h)) samples.set(h, u); }
  const blocked = new Set<string>();
  await pool([...samples], 8, async ([h, u]) => { if (!(await hostEmbeddable(h, u))) blocked.add(h); });
  const usable = (u: string | null | undefined): u is string => !!u && !NO_HOTLINK.test(u) && !blocked.has(hostOf(u));
  for (const c of recent) {
    const pick = c.images.find(usable) ?? null;
    c.image = pick;
    if (pick && pick === c.lead.image) stats.feed++;
    else if (pick) stats.mate++;
  }

  // 3: archive (og images found by earlier sweeps)
  const need = recent.filter((c) => !c.image).sort((a, b) => b.score - a.score).slice(0, MAX_OG + 40);
  const known = await knownImages(need.map((c) => c.id));
  for (const c of need) if (usable(known[c.id])) { c.image = known[c.id]; stats.archive++; }

  // 4: og:image of the lead article, then up to two cluster-mates' articles
  const rest = need.filter((c) => !c.image).slice(0, MAX_OG);
  const found: Cluster[] = [];
  let open = true;
  const work = pool(rest, 6, async (c) => {
    for (const link of c.links.slice(0, 3)) {
      if (!open || Date.now() > deadline) return;
      const og = await ogImage(link);
      if (og && usable(og) && (await embeddable(og))) {
        if (open) { c.image = og; found.push(c); stats.og++; }
        return;
      }
    }
  });
  await Promise.race([work, new Promise((r) => setTimeout(r, Math.max(0, deadline - Date.now())))]);
  open = false;
  stats.none = recent.filter((c) => !c.image).length;
  // remember discoveries so later sweeps / other pages skip the article fetch
  if (found.length) await ingest(found).catch(() => null);
  if (process.env.GT_IMG_DEBUG) console.log("[images]", JSON.stringify({ ...stats, blocked: [...blocked] }));
  return stats;
}
