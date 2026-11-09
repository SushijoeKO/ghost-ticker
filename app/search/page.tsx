import type { Metadata } from "next";
import Header from "@/components/Header";
import TrendingList from "@/components/TrendingList";
import { search } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search the archive", robots: { index: false, follow: false } };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim().slice(0, 120);
  const rows = q ? await search(q) : null;
  const now = Date.now();
  return (
    <>
      <Header active="search" />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">Channel /ARCHIVE</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Search the archive</h1>
          <p className="mt-1 text-zinc-400">Headlines and outlet names from the last 7 days.</p>
        </div>
        <form action="/search" method="get" role="search" className="flex gap-2">
          <label htmlFor="q" className="sr-only">Search headlines</label>
          <input id="q" name="q" type="search" defaultValue={q} maxLength={120} placeholder="e.g. senate budget, Reuters, alligator" autoComplete="off"
            className="min-w-0 flex-1 rounded border border-zinc-700 bg-black/60 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none" data-testid="search-input" />
          <button type="submit" className="btn-solid">Search</button>
        </form>
        {rows !== null && (
          <section aria-label="Search results" className="panel">
            <header className="panel-head font-mono text-xs uppercase tracking-[0.2em] text-zinc-400" data-testid="search-count">{rows?.length ?? 0} result{rows?.length === 1 ? "" : "s"} for “{q}”</header>
            {rows === null || !rows.length ? <p className="px-4 py-6 font-mono text-sm text-zinc-500">Nothing in the archive matches that.</p> : <TrendingList rows={rows} now={now} testid="search-results" />}
          </section>
        )}
      </main>
    </>
  );
}
