import type { Metadata } from "next";
import Header from "@/components/Header";
import MapView from "@/components/MapView";
import { pinsFrom } from "@/lib/feeds";
import { getWire } from "@/lib/wire-cache";

export const revalidate = 300;
export const metadata: Metadata = { title: "Live map", description: "Where today’s headlines are happening, pinned on a world map.", alternates: { canonical: "/map" } };

export default async function MapPage() {
  const w = await getWire();
  const now = w.fetchedAt;
  const pins = pinsFrom(w.clusters.filter((c) => !c.satire && c.lead.ts && now - c.lead.ts < 48 * 3600e3), 120);
  const ok = w.feeds.filter((f) => f.ok).length;
  return (
    <>
      <Header fetchedAt={now} feedsOk={ok} feedsTotal={w.feeds.length} active="map" />
      <main id="main" className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-400">Channel /GEOINT</p>
          <h1 className="mt-1 font-mono text-3xl font-black uppercase tracking-[0.1em] text-zinc-50">Live map</h1>
          <p className="mt-1 text-zinc-400">Places named in the last 48 hours of headlines. Red = breaking; a pulsing ring = reported in the last few hours. Tap a pin for its headlines.</p>
        </div>
        <div className="panel p-3 sm:p-4"><MapView pins={pins} now={now} /></div>
        <section aria-labelledby="h-places" className="panel">
          <header className="panel-head"><h2 id="h-places" className="font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">All locations ({pins.length})</h2></header>
          <ul className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="place-list">
            {pins.map((p) => (
              <li key={p.id}>
                <details>
                  <summary className="cursor-pointer font-mono text-sm text-zinc-200 hover:text-cyan-300">
                    {p.breaking && <span className="mr-1 text-red-400" aria-label="breaking">●</span>}{p.name} <span className="text-zinc-500">({p.count})</span>
                  </summary>
                  <ul className="mt-1 space-y-1 pl-3 text-sm">
                    {p.items.map((it) => <li key={it.id}><a href={it.link} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-emerald-300 hover:underline">{it.title}</a> <span className="font-mono text-[10px] uppercase text-zinc-500">{it.source}</span></li>)}
                  </ul>
                </details>
              </li>
            ))}
          </ul>
        </section>
        <p className="font-mono text-[11px] text-zinc-500">Locations are guessed automatically from headline text and can be wrong. Map outlines: Natural Earth (public domain).</p>
      </main>
    </>
  );
}
