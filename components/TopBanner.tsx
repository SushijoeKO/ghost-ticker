import Link from "next/link";
import type { Cluster } from "@/lib/feeds";
import RelTime from "./RelTime";
import Thumb from "./Thumb";
import VoteButton from "./VoteButton";
import { AgentNote, ClearanceBadge, TagBadge } from "./Badges";
import Decrypt from "./Decrypt";

export default function TopBanner({ c, now, votes = 0 }: { c?: Cluster; now: number; votes?: number }) {
  if (!c) return null;
  const { lead } = c;
  return (
    <section aria-labelledby="top-story" className="top-banner relative overflow-hidden rounded-md border-2 border-red-600 bg-gradient-to-br from-red-950 via-[#1a0507] to-black p-5 sm:p-8" data-testid="top-banner" data-tag={c.tag?.name ?? ""}>
      <div className={`grid gap-6 ${c.image ? "lg:grid-cols-[1.35fr_1fr] lg:items-center" : ""}`}>
        <div className="min-w-0">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-red-300">
            <span className="live-dot mr-2 inline-block align-middle" aria-hidden="true" />
            {c.breaking ? "Flash traffic · top story" : "Top story"}
          </p>
          <h2 id="top-story" className="mt-3 max-w-5xl text-2xl font-black uppercase leading-tight text-white sm:text-4xl">
            <Link href={`/story/${c.id}`} data-testid="story-link" aria-label={`${lead.title} (opens the story file)`} className="hover:underline decoration-red-400 underline-offset-4">
              <TagBadge tag={c.tag} />
              <Decrypt id={c.id} text={lead.title} play />
              <span className="sr-only"> (opens the story file)</span>
            </Link>
          </h2>
          {lead.snippet && <p className="mt-3 max-w-3xl text-zinc-300">{lead.snippet}</p>}
          <p className="mt-4 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-wider text-zinc-300">
            <a href={lead.link} target="_blank" rel="noopener noreferrer" className="text-red-300 hover:underline">{lead.source.name}</a> <span aria-hidden="true">//</span> <RelTime ts={lead.ts} serverNow={now} />
            <ClearanceBadge outlets={c.outlets} />
            <VoteButton id={c.id} initial={votes} title={lead.title} link={lead.link} />
          </p>
          {c.also.length > 0 && (
            <p className="mt-2 font-mono text-xs text-zinc-400">
              Also carrying: {c.also.slice(0, 5).map((a, i) => (
                <span key={a.link}>{i > 0 && ", "}<a href={a.link} target="_blank" rel="noopener noreferrer" className="text-amber-200 hover:underline">{a.name}</a></span>
              ))}
            </p>
          )}
          <AgentNote also={c.also.map((a) => a.name)} place={c.geo?.name} />
        </div>
        {c.image && (
          <Link href={`/story/${c.id}`} tabIndex={-1} aria-hidden="true" className="relative block self-start overflow-hidden rounded border border-red-900/70">
            <Thumb src={c.image} source={lead.source.name} title={lead.title} ratio="16/9" className="w-full" eager />
            <span className="pointer-events-none absolute right-2 top-2 rotate-6 border-2 border-red-500/70 bg-black/50 px-2 font-mono text-xs font-black tracking-[0.3em] text-red-400" aria-hidden="true">EYES ONLY</span>
          </Link>
        )}
      </div>
    </section>
  );
}
