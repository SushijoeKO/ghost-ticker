import type { Metadata } from "next";
import Header from "@/components/Header";
import TrendingList from "@/components/TrendingList";
import { trending } from "@/lib/db";

export const revalidate = 60;
export const metadata: Metadata = { title: "Trending", description: "What readers are upvoting, weighted by how many outlets carry it and how fresh it is.", alternates: { canonical: "/trending" } };

export default async function TrendingPage() {
  const rows = ((await trending(30, 60)) ?? []).filter((r) => r.category !== "satire");
  const now = Date.now();
  return (
    <>
      <Header active="trending" />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">Channel /HEAT</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Trending</h1>
          <p className="mt-1 text-zinc-400">Ranked by anonymous upvotes, how many outlets carry the story, and how recent it is (last 48 hours). Counts refresh about every minute.</p>
        </div>
        <section className="panel" aria-label="Trending headlines" data-testid="section-trending"><TrendingList rows={rows} now={now} /></section>
      </main>
    </>
  );
}
