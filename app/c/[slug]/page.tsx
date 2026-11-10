import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Ticker from "@/components/Ticker";
import Section from "@/components/Section";
import AdSlot from "@/components/AdSlot";
import { CATEGORIES } from "@/lib/sources";
import { balanceByLean, diversify, inCategory } from "@/lib/feeds";
import { getWireWithImages as getWire } from "@/lib/wire-cache";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  return cat ? { title: `${cat.label} headlines`, description: cat.blurb, alternates: { canonical: `/c/${slug}` } } : {};
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) notFound();
  const w = await getWire();
  const items = cat.slug === "politics" ? balanceByLean(inCategory(w, "politics"), 60, 4) : diversify(inCategory(w, cat.slug), 60, 6);
  const ticker = inCategory(w, "breaking").slice(0, 18);
  const tickerFallback = w.clusters.filter((c) => !c.satire).slice(0, 12);
  const ok = w.feeds.filter((f) => f.ok).length;
  return (
    <>
      <Header fetchedAt={w.fetchedAt} feedsOk={ok} feedsTotal={w.feeds.length} active={cat.slug} />
      <Ticker items={ticker.length ? ticker : tickerFallback} />
      <main id="main" className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">Channel /{cat.code}</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">{cat.label}</h1>
          <p className="mt-1 text-zinc-400">{cat.blurb}</p>
          {cat.slug === "satire" && (
            <p className="mt-3 rounded border border-yellow-400/50 bg-yellow-300/15 px-3 py-2 font-mono text-sm font-bold uppercase tracking-wide text-yellow-50" data-testid="satire-disclaimer">
              These stories are jokes from satire outlets. They are not news.
            </p>
          )}
        </div>
        <AdSlot kind="header" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section id={cat.slug} title={cat.label} code={cat.code} items={items} now={w.fetchedAt} showLean={cat.slug === "politics"} showSnippet adAfter={10} accent={cat.slug === "breaking" ? "red" : cat.slug === "satire" ? "orange" : "emerald"} note={cat.slug === "satire" ? "These stories are jokes from satire outlets. They are not news." : undefined} />
          </div>
          <aside className="space-y-6"><AdSlot kind="sidebar" /></aside>
        </div>
      </main>
    </>
  );
}
