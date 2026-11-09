import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import RelTime from "@/components/RelTime";
import Thumb from "@/components/Thumb";
import VoteButton from "@/components/VoteButton";
import { ClearanceBadge, DisinfoBadge, TagBadge } from "@/components/Badges";
import { findCluster, getWireWithImages as getWire, relatedClusters } from "@/lib/feeds";
import { ogImage } from "@/lib/ogimage";
import { voteCounts } from "@/lib/db";

export const revalidate = 300;

async function load(id: string) {
  const w = await getWire();
  return { w, c: findCluster(w.clusters, id) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { c } = await load(id);
  if (!c) return { title: "Story" };
  const description = (c.lead.snippet || `${c.lead.title} — ${c.outlets} outlet${c.outlets === 1 ? "" : "s"}`).slice(0, 160);
  const image = c.image || (await ogImage(c.lead.link).catch(() => null)) || "/og.png";
  return {
    title: c.lead.title,
    description,
    alternates: { canonical: `/story/${c.id}` },
    openGraph: { title: c.lead.title, description, url: `/story/${c.id}`, type: "article", images: [{ url: image, alt: c.lead.title }] },
    twitter: { card: "summary_large_image", title: c.lead.title, description, images: [image] },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { w, c } = await load(id);
  if (!c) notFound();
  const votes = (await voteCounts([c.id], 60))[c.id] ?? 0;
  const related = relatedClusters(w.clusters, c, 4);
  const timeline = c.members.length ? c.members : [{ title: c.lead.title, link: c.lead.link, snippet: c.lead.snippet, ts: c.lead.ts, source: c.lead.source.name, image: c.image }];
  return (
    <>
      <Header active="home" />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <article className="panel overflow-hidden" data-testid="story-file">
          <header className="panel-head">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400">Story file /{c.id}</p>
          </header>
          <div className="space-y-4 p-4 sm:p-6">
            <h1 className="text-2xl font-black leading-tight text-zinc-50 sm:text-3xl">
              <TagBadge tag={c.tag} /> {c.lead.title}
            </h1>
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
              <a href={c.lead.link} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">{c.lead.source.name}</a>
              <span aria-hidden="true">//</span>
              <RelTime ts={c.lead.ts} serverNow={w.fetchedAt} />
              {c.satire ? <DisinfoBadge /> : <ClearanceBadge outlets={c.outlets} />}
              <VoteButton id={c.id} initial={votes} title={c.lead.title} link={c.lead.link} />
            </p>
            {c.lead.snippet && <p className="text-zinc-300">{c.lead.snippet}</p>}
            {c.image && (
              <Thumb src={c.image} source={c.lead.source.name} title={c.lead.title} ratio="16/9" className="w-full overflow-hidden rounded border border-zinc-800" />
            )}
            <p className="font-mono text-[11px] text-zinc-500">Headlines and short snippets only. Each link opens the outlet’s own report. We don’t copy articles or get around paywalls.</p>
          </div>
          <section aria-labelledby="story-outlets" className="border-t border-zinc-800">
            <h2 id="story-outlets" className="px-4 pt-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100 sm:px-6">Outlets <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/{c.outlets}</span></h2>
            <ol className="divide-y divide-zinc-800/80 px-4 sm:px-6" data-testid="story-outlets">
              {timeline.map((member) => (
                <li key={member.link} className="py-3" data-testid="story-outlet">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    <RelTime ts={member.ts} serverNow={w.fetchedAt} /> <span aria-hidden="true">//</span> {member.source}
                  </p>
                  <a href={member.link} target="_blank" rel="noopener noreferrer" className="mt-1 block font-semibold text-zinc-100 hover:text-emerald-300 hover:underline">{member.title}</a>
                  {member.snippet && <p className="mt-1 text-sm leading-snug text-zinc-400">{member.snippet.slice(0, 160)}</p>}
                </li>
              ))}
            </ol>
          </section>
        </article>
        {related.length > 0 && (
          <section className="panel" aria-labelledby="story-related" data-testid="story-related">
            <h2 id="story-related" className="panel-head font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">Related files</h2>
            <ul className="divide-y divide-zinc-800/80 px-4">
              {related.map((item) => (
                <li key={item.id} className="py-3">
                  <Link href={`/story/${item.id}`} className="font-semibold text-zinc-100 hover:text-emerald-300 hover:underline">{item.lead.title}</Link>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{item.lead.source.name} · {item.outlets} outlet{item.outlets === 1 ? "" : "s"}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
