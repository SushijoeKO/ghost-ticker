import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Ticker from "@/components/Ticker";
import ClearanceKey from "@/components/ClearanceKey";
import TopBanner from "@/components/TopBanner";
import Section from "@/components/Section";
import AdSlot from "@/components/AdSlot";
import MapView from "@/components/MapView";
import VideoStrip from "@/components/VideoStrip";
import XEmbeds from "@/components/XEmbeds";
import XFeed from "@/components/XFeed";
import TrendingList from "@/components/TrendingList";
import { balanceByLean, diversify, inCategory, pinsFrom, topStory, trendCards, type Cluster } from "@/lib/feeds";
import { getWireWithImages as getWire } from "@/lib/wire-cache";
import { ingest, saveStories, voteCounts } from "@/lib/db";
import { getVideos } from "@/lib/videos";
import { pinnedPosts } from "@/lib/pinned";
import { SOFT } from "@/lib/sources";
import { getIntercepts } from "@/lib/intercepts-server";

export const revalidate = 300;
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const interceptsPromise = getIntercepts();
  const w = await getWire();
  const now = w.fetchedAt;
  // archive this sweep (server-side, secret key never leaves the server); failures are ignored
  await ingest(w.clusters).catch(() => null);
  await saveStories(w.clusters).catch(() => null);
  const hot = w.clusters.filter((c) => !c.satire).sort((a, b) => b.score - a.score).slice(0, 40);
  const [videos, trendVotes] = await Promise.all([getVideos(12), voteCounts(hot.map((c) => c.id), 60)]);
  const trend = trendCards(w.clusters, trendVotes, now, 8);
  const used = new Set<string>();
  const take = (arr: Cluster[], n: number, cap = 2) => {
    const out = diversify(arr, n, cap, used);
    out.forEach((c) => used.add(c.id));
    return out;
  };

  const top = topStory(w);
  if (top) used.add(top.id);
  const breakingAll = inCategory(w, "breaking");
  const tickerItems = (breakingAll.length >= 6 ? breakingAll : [...breakingAll, ...w.clusters.filter((c) => !c.breaking && !c.categories.every((k) => SOFT.includes(k)))]).slice(0, 18);
  const breaking = take(breakingAll, 8, 3);
  const politics = balanceByLean(inCategory(w, "politics"), 16, 2, used);
  politics.forEach((c) => used.add(c.id));
  const weird = take(inCategory(w, "weird"), 12);
  const latest = take(w.clusters.filter((c) => c.categories.includes("top")), 12);
  const us = take(inCategory(w, "us"), 8);
  const world = take(inCategory(w, "world"), 8);
  const tech = take(inCategory(w, "tech"), 8);
  const sports = take(inCategory(w, "sports"), 8);
  const ent = take(inCategory(w, "entertainment"), 8);
  const pop = take(inCategory(w, "pop-culture"), 8);
  const satire = take(inCategory(w, "satire"), 8);
  const ok = w.feeds.filter((f) => f.ok).length;
  const pins = pinsFrom(w.clusters.filter((c) => !c.satire && c.lead.ts && now - c.lead.ts < 36 * 3600e3), 60);
  const votes = await voteCounts([...used], 60);

  return (
    <>
      <Header fetchedAt={w.fetchedAt} feedsOk={ok} feedsTotal={w.feeds.length} active="home" />
      <Ticker items={tickerItems} />
      <main id="main" className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <h1 className="sr-only">Ghost Ticker: today’s headlines</h1>
        <ClearanceKey />
        <AdSlot kind="header" />
        {top ? (
          <TopBanner c={top} now={now} votes={votes[top.id] ?? 0} />
        ) : (
          <p className="panel p-6 font-mono text-sm text-zinc-400">All channels are quiet: no feeds answered this sweep. Check back in a few minutes.</p>
        )}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {breaking.length > 0 && <Section id="breaking" title="Breaking" code="FLASH" items={breaking} now={now} more="/c/breaking" accent="red" showSnippet votes={votes} />}
            <Section id="politics" title="Politics" code="CAPITOL" items={politics} now={now} more="/c/politics" showLean adAfter={8} accent="amber" votes={votes} />
            <Section id="weird" title="Weird" code="ANOMALY" items={weird} now={now} more="/c/weird" accent="violet" votes={votes} />
          </div>
          <aside className="min-w-0 space-y-6" aria-label="Map, trending, latest wire and X">
            <section aria-labelledby="h-minimap" className="panel">
              <header className="panel-head flex items-center justify-between gap-2">
                <h2 id="h-minimap" className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100"><span className="inline-block h-3 w-1.5 bg-cyan-400" aria-hidden="true" />Live map<span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/GEOINT</span></h2>
                <Link href="/map" className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 hover:underline">Full map →</Link>
              </header>
              <div className="p-3"><MapView pins={pins} now={now} compact /></div>
            </section>
            <section aria-labelledby="h-trending" className="panel" data-testid="section-trending">
              <header className="panel-head flex items-center justify-between gap-2">
                <h2 id="h-trending" className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100"><span className="inline-block h-3 w-1.5 bg-amber-400" aria-hidden="true" />Trending<span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/HEAT</span></h2>
                <Link href="/trending" className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 hover:underline">Full list →</Link>
              </header>
              <TrendingList rows={trend} now={now} compact />
            </section>
            <Section id="latest" title="Latest wire" code="PRIORITY" items={latest} now={now} more="/c/top" votes={votes} leadCard={false} />
            <AdSlot kind="sidebar" />
            <XFeed posts={await interceptsPromise} serverNow={Date.now()} />
          </aside>
        </div>
        <VideoStrip videos={videos} />
        <XEmbeds posts={pinnedPosts()} />
        <div className="grid gap-6 lg:grid-cols-3">
          <Section id="us" title="U.S." code="DOMESTIC" items={us} now={now} more="/c/us" votes={votes} />
          <Section id="world" title="World" code="FOREIGN" items={world} now={now} more="/c/world" votes={votes} />
          <Section id="tech" title="Tech" code="SIGINT" items={tech} now={now} more="/c/tech" votes={votes} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Section id="sports" title="Sports" code="FIELD-OPS" items={sports} now={now} more="/c/sports" accent="sky" votes={votes} />
          <Section id="entertainment" title="Entertainment" code="COVER-STORY" items={ent} now={now} more="/c/entertainment" accent="rose" votes={votes} />
          <Section id="pop-culture" title="Pop Culture" code="CHATTER" items={pop} now={now} more="/c/pop-culture" accent="violet" votes={votes} />
        </div>
        <Section id="satire" title="Disinfo Desk" code="DISINFO" items={satire} now={now} more="/c/satire" accent="orange" votes={votes} note="These stories are jokes from satire outlets. They are not news." />
      </main>
    </>
  );
}
