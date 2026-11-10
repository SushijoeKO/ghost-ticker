import type { Metadata } from "next";
import Header from "@/components/Header";
import TrendingList from "@/components/TrendingList";
import { trendCards } from "@/lib/feeds";
import { getWire } from "@/lib/wire-cache";
import { voteCounts } from "@/lib/db";

export const revalidate = 300;
export const metadata: Metadata = { title: "Trending", description: "What readers are upvoting, weighted by how many outlets carry it and how fresh it is.", alternates: { canonical: "/trending" } };

export default async function TrendingPage() {
  const w = await getWire();
  const pool = w.clusters.filter((c) => !c.satire && c.lead.ts && w.fetchedAt - c.lead.ts < 48 * 3600e3).sort((a, b) => b.score - a.score).slice(0, 60);
  const votes = await voteCounts(pool.map((c) => c.id), 60);
  const rows = trendCards(pool, votes, w.fetchedAt, 30);
  return (
    <>
      <Header active="trending" />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">Channel /HEAT</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Trending</h1>
          <p className="mt-1 text-zinc-400">One card per event. Ranked by anonymous upvotes, how many outlets carry it, and how recent it is (last 48 hours).</p>
        </div>
        <section className="panel" aria-label="Trending headlines" data-testid="section-trending"><TrendingList rows={rows} now={w.fetchedAt} /></section>
      </main>
    </>
  );
}
