import type { Metadata } from "next";
import Header from "@/components/Header";
import FilterBar from "@/components/FilterBar";
import SearchField from "@/components/SearchField";
import TrendingList from "@/components/TrendingList";
import { search as searchArchive, type ArchiveRow } from "@/lib/db";
import { getWire } from "@/lib/wire-cache";
import { canonicalLink } from "@/lib/dedupe";
import {
  archiveToDoc, clusterToDoc, combineWithMembers, hasFilters, matchesFilters, parseFilters, rankDocs, termsOf, type SearchDoc,
} from "@/lib/query";

export const revalidate = 120;
export const metadata: Metadata = {
  title: "Search the archive",
  robots: { index: false, follow: false },
};

function toRow(doc: SearchDoc): ArchiveRow & { snippet?: string } {
  return {
    id: doc.id,
    title: doc.title,
    link: doc.link,
    source: doc.source,
    category: doc.satire ? "satire" : doc.category,
    image: doc.image,
    published_at: doc.ts ? new Date(doc.ts).toISOString() : null,
    outlets: doc.outlets,
    breaking: doc.breaking,
    votes: doc.votes,
    snippet: doc.snippet,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseFilters(await searchParams);
  const active = hasFilters(filters);
  const wire = active ? await getWire() : null;
  const archive = filters.q ? await searchArchive(filters.q) : null;
  const now = wire?.fetchedAt ?? Date.now();
  let rows: (ArchiveRow & { snippet?: string })[] = [];
  if (wire) {
    const memberLinks = new Map<string, string>();
    const wireDocs = wire.clusters.map((cluster) => {
      for (const member of cluster.members) {
        const link = canonicalLink(member.link);
        if (link) memberLinks.set(link, cluster.id);
      }
      const lead = canonicalLink(cluster.lead.link);
      if (lead) memberLinks.set(lead, cluster.id);
      return clusterToDoc(cluster);
    });
    const archiveDocs = (archive ?? []).map((row, index) => archiveToDoc({ ...row, rank: row.rank ?? index }));
    const docs = combineWithMembers(wireDocs, memberLinks, archiveDocs).filter((doc) => matchesFilters(doc, filters, now));
    rows = rankDocs(docs, filters).slice(0, 40).map(toRow);
  }
  return (
    <>
      <Header active="search" />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">Channel /ARCHIVE</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Search the wire</h1>
          <p className="mt-1 text-zinc-400">One card per event, from this sweep and the 7-day archive. Satire stays out unless you ask for it.</p>
        </div>
        <form action="/search" method="get" role="search" className="space-y-3">
          <div className="flex gap-2">
            <label htmlFor="q" className="sr-only">Search headlines, snippets, and outlets</label>
            <SearchField id="q" defaultValue={filters.q} placeholder="e.g. senate budget, Reuters, alligator" />
            <button type="submit" className="btn-solid">Search</button>
          </div>
          <FilterBar filters={filters} />
        </form>
        {!active ? (
          <p className="panel px-4 py-8 text-center font-mono text-sm uppercase tracking-[0.18em] text-zinc-500" data-testid="search-empty">
            No intercept yet. Enter a call sign, outlet, or headline fragment.
          </p>
        ) : (
          <section aria-label="Search results" className="panel">
            <header className="panel-head font-mono text-xs uppercase tracking-[0.2em] text-zinc-400" data-testid="search-count">
              {rows.length} result{rows.length === 1 ? "" : "s"}{filters.q ? ` for “${filters.q}”` : ""}
            </header>
            {rows.length === 0 ? (
              <p className="px-4 py-6 font-mono text-sm uppercase tracking-[0.14em] text-zinc-500" data-testid="search-empty">
                Signal lost. Nothing in the sweep or the 7-day archive matches that query.
              </p>
            ) : (
              <TrendingList rows={rows} now={now} testid="search-results" q={termsOf(filters.q).join(" ")} />
            )}
          </section>
        )}
      </main>
    </>
  );
}
