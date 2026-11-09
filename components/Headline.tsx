import Link from "next/link";
import type { Cluster } from "@/lib/feeds";
import RelTime from "./RelTime";
import Thumb from "./Thumb";
import VoteButton from "./VoteButton";
import { ClearanceBadge, DisinfoBadge, SatireBadge, TagBadge, AgentNote } from "./Badges";
import Decrypt from "./Decrypt";

const LEAN_STYLE: Record<string, string> = {
  Left: "border-sky-500/60 text-sky-300",
  "Lean Left": "border-sky-400/40 text-sky-200",
  Center: "border-zinc-400/50 text-zinc-200",
  "Lean Right": "border-rose-400/40 text-rose-200",
  Right: "border-rose-500/60 text-rose-300",
  Libertarian: "border-amber-400/50 text-amber-200",
  Intl: "border-emerald-400/40 text-emerald-200",
};

export default function Headline({ c, now, showLean = false, showSnippet = false, index, card = false, votes = 0, decrypt = false }: { c: Cluster; now: number; showLean?: boolean; showSnippet?: boolean; index?: number; card?: boolean; votes?: number; decrypt?: boolean }) {
  const { lead } = c;
  const label = `${lead.title} (opens the story file)`;
  return (
    <li className={`headline group py-2.5 ${card ? "headline-card" : ""} ${card && !c.image ? "headline-card-text" : ""}`} data-testid="headline" data-id={c.id} data-tag={c.tag?.name ?? ""}>
      {card && c.image && (
        <Link href={`/story/${c.id}`} tabIndex={-1} aria-hidden="true" className="mb-2 block overflow-hidden rounded border border-zinc-800">
          <Thumb src={c.image} source={lead.source.name} title={lead.title} ratio="16/9" className="w-full" />
        </Link>
      )}
      <div className="flex gap-3">
        {index !== undefined && !card && (
          <span className="mt-0.5 shrink-0 font-mono text-[11px] text-emerald-500/70" aria-hidden="true">
            {String(index + 1).padStart(3, "0")}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link href={`/story/${c.id}`} aria-label={label} data-testid="story-link"
            className={`headline-link font-semibold leading-snug text-zinc-100 decoration-emerald-400/70 underline-offset-2 hover:text-emerald-300 hover:underline focus-visible:text-emerald-300 ${card ? "text-lg" : ""}`}>
            {c.satire && <SatireBadge />}
            <TagBadge tag={c.tag} />
            <Decrypt id={c.id} text={lead.title} play={card || decrypt} />
            <span className="sr-only"> (opens the story file)</span>
          </Link>
          {(showSnippet || card) && lead.snippet && <p className="mt-1 text-sm leading-snug text-zinc-400">{lead.snippet}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-zinc-400">
            <a href={lead.link} target="_blank" rel="noopener noreferrer" className="text-emerald-300/90 hover:underline" data-testid="source">{lead.source.name}</a>
            {showLean && <span data-testid="lean" className={`rounded-sm border px-1 normal-case ${LEAN_STYLE[lead.source.lean] ?? ""}`}>{lead.source.lean}</span>}
            <span aria-hidden="true">//</span>
            <RelTime ts={lead.ts} serverNow={now} />
            {c.satire ? <DisinfoBadge /> : <ClearanceBadge outlets={c.outlets} />}
            {c.geo && <span className="normal-case text-cyan-300/80" title="Mapped location">⌖ {c.geo.name}</span>}
            <VoteButton id={c.id} initial={votes} title={lead.title} link={lead.link} />
            {c.also.length > 0 && (
              <details className="normal-case">
                <summary className="cursor-pointer text-amber-300/90 hover:text-amber-200">+{c.also.length} more {c.also.length === 1 ? "outlet" : "outlets"}</summary>
                <ul className="mt-1 space-y-0.5 pl-2">
                  {c.also.map((a) => (
                    <li key={a.link}><a href={a.link} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-emerald-300 hover:underline">{a.name}</a></li>
                  ))}
                </ul>
              </details>
            )}
          </div>
          {card && <AgentNote also={c.also.map((a) => a.name)} place={c.geo?.name} />}
        </div>
        {!card && c.image && (
          <Link href={`/story/${c.id}`} tabIndex={-1} aria-hidden="true" className="gt-side-thumb self-start shrink-0 overflow-hidden rounded border border-zinc-800">
            <Thumb src={c.image} source={lead.source.name} title={lead.title} ratio="4/3" className="w-full" />
          </Link>
        )}
      </div>
    </li>
  );
}
