import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/Header";
import RelTime from "@/components/RelTime";
import Thumb from "@/components/Thumb";
import VoteButton from "@/components/VoteButton";
import { ClearanceBadge, DisinfoBadge } from "@/components/Badges";
import { stableClusterId } from "@/lib/feeds";
import { getWire } from "@/lib/wire-cache";
import { lookupArchivedStory, voteCounts } from "@/lib/db";
import { relatedStories, resolveStory, storyIndex, type StoryFile } from "@/lib/stories";

export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const w = await getWire();
    return w.clusters
      .filter((cluster) => !cluster.satire)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((cluster) => ({ id: cluster.id }));
  } catch {
    return [];
  }
}

async function load(id: string): Promise<{ story: StoryFile; fetchedAt: number; related: StoryFile[] } | { redirectTo: string } | null> {
  const w = await getWire();
  const index = storyIndex(w.clusters, w.fetchedAt);
  const hit = resolveStory(index, id);
  if (hit?.redirectTo) return { redirectTo: hit.redirectTo };
  if (hit) return { story: hit.story, fetchedAt: index.fetchedAt, related: relatedStories(index, hit.story, 4) };
  const archived = await lookupArchivedStory(id);
  if (archived?.redirectTo) return { redirectTo: archived.redirectTo };
  if (!archived) return null;
  const again = resolveStory(index, stableClusterId(archived.story.link));
  if (again && again.story.id !== id) return { redirectTo: again.story.id };
  return { story: archived.story, fetchedAt: Date.now(), related: [] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded || "redirectTo" in loaded) return { title: "Story" };
  const { story } = loaded;
  const description = (story.snippet || `${story.title} — ${story.outlets} outlet${story.outlets === 1 ? "" : "s"}`).slice(0, 160);
  const image = story.image || "/og.png";
  return {
    title: story.title,
    description,
    alternates: { canonical: `/story/${story.id}` },
    openGraph: { title: story.title, description, url: `/story/${story.id}`, type: "article", images: [{ url: image, alt: story.title }] },
    twitter: { card: "summary_large_image", title: story.title, description, images: [image] },
  };
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded) notFound();
  if ("redirectTo" in loaded) permanentRedirect(`/story/${loaded.redirectTo}`);
  const { story, fetchedAt, related } = loaded;
  const votes = (await voteCounts([story.id], 60))[story.id] ?? 0;
  const timeline = story.members.length ? story.members : [{ title: story.title, link: story.link, snippet: story.snippet, ts: story.ts, source: story.source }];
  return (
    <>
      <Header active="home" />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <article className="panel overflow-hidden" data-testid="story-file">
          <header className="panel-head">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-400">Story file /{story.id}</p>
          </header>
          <div className="space-y-4 p-4 sm:p-6">
            <h1 className="text-2xl font-black leading-tight text-zinc-50 sm:text-3xl">{story.title}</h1>
            <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-400">
              <a href={story.link} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">{story.source}</a>
              <span aria-hidden="true">//</span>
              <RelTime ts={story.ts} serverNow={fetchedAt} />
              {story.satire ? <DisinfoBadge /> : <ClearanceBadge outlets={story.outlets} />}
              <VoteButton id={story.id} initial={votes} title={story.title} link={story.link} />
            </p>
            {story.snippet && <p className="text-zinc-300">{story.snippet}</p>}
            {story.image && (
              <Thumb src={story.image} source={story.source} title={story.title} ratio="16/9" className="w-full overflow-hidden rounded border border-zinc-800" />
            )}
            <p className="font-mono text-[11px] text-zinc-500">Headlines and short snippets only. Each link opens the outlet’s own report. We don’t copy articles or get around paywalls.</p>
          </div>
          <section aria-labelledby="story-outlets" className="border-t border-zinc-800">
            <h2 id="story-outlets" className="px-4 pt-4 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100 sm:px-6">Outlets <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/{story.outlets}</span></h2>
            <ol className="divide-y divide-zinc-800/80 px-4 sm:px-6" data-testid="story-outlets">
              {timeline.map((member) => (
                <li key={member.link} className="py-3" data-testid="story-outlet">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                    <RelTime ts={member.ts} serverNow={fetchedAt} /> <span aria-hidden="true">//</span> {member.source}
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
                  <Link href={`/story/${item.id}`} className="font-semibold text-zinc-100 hover:text-emerald-300 hover:underline">{item.title}</Link>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-zinc-500">{item.source} · {item.outlets} outlet{item.outlets === 1 ? "" : "s"}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
