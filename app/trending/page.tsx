import type { Metadata } from "next";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import TrendingList from "@/components/TrendingList";
import type { Cluster } from "@/lib/feeds";
import { getWire } from "@/lib/wire-cache";
import { voteCounts, type ArchiveRow } from "@/lib/db";
import { clusterToDoc, hasFilters, matchesFilters, parseFilters, rankDocs } from "@/lib/query";

export const revalidate = 300;
export const metadata: Metadata = { title: "Trending", description: "What readers are upvoting, weighted by how many outlets carry it and how fresh it is.", alternates: { canonical: "/trending" } };

function toRow(cluster: Cluster, votes: number): ArchiveRow {
  return {
    id: cluster.id,
    title: cluster.lead.title,
    link: cluster.lead.link,
    source: cluster.lead.source.name,
    category: cluster.satire ? "satire" : cluster.lead.source.category,
    image: cluster.image,
    published_at: cluster.lead.ts ? new Date(cluster.lead.ts).toISOString() : null,
    outlets: cluster.outlets,
    breaking: cluster.breaking,
    votes,
  };
}

export default async function TrendingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const w = await getWire();
  const base = hasFilters(filters)
    ? w.clusters.filter((cluster) => matchesFilters(clusterToDoc(cluster), filters, w.fetchedAt))
    : w.clusters.filter((cluster) => !cluster.satire && cluster.lead.ts && w.fetchedAt - cluster.lead.ts < 48 * 3600e3);
  const pool = [...base].sort((a, b) => b.score - a.score).slice(0, 80);
  const votes = await voteCounts(pool.map((cluster) => cluster.id), 60);
  const ordered = filters.q
    ? rankDocs(pool.map(clusterToDoc), filters).map((doc) => pool.find((cluster) => cluster.id === doc.id)).filter((cluster): cluster is Cluster => !!cluster)
    : [...pool].sort((a, b) => (b.score * 2 + (votes[b.id] ?? 0) * 5) - (a.score * 2 + (votes[a.id] ?? 0) * 5));
  const rows = ordered.slice(0, 30).map((cluster) => toRow(cluster, votes[cluster.id] ?? 0));
  return (
    <>
      <Header active="trending" />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">Channel /HEAT</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Trending</h1>
          <p className="mt-1 text-zinc-400">One card per event. Ranked by anonymous upvotes, how many outlets carry it, and how recent it is (last 48 hours).</p>
        </div>
        <form action="/trending" method="get" className="panel p-3">
          <FilterBar filters={filters} />
        </form>
        <section className="panel" aria-label="Trending headlines" data-testid="section-trending">
          {rows.length === 0 ? (
            <p className="px-4 py-6 font-mono text-sm uppercase tracking-[0.14em] text-zinc-500" data-testid="search-empty">Signal lost. Nothing on this desk matches those filters.</p>
          ) : (
            <TrendingList rows={rows} now={w.fetchedAt} q={filters.q} />
          )}
        </section>
      </main>
    </>
  );
}
