import type { ArchiveRow } from "@/lib/db";
import RelTime from "./RelTime";
import VoteButton from "./VoteButton";
import { ClearanceBadge, DisinfoBadge, SatireBadge } from "./Badges";
import Thumb from "./Thumb";
import { canHotlink } from "@/lib/hotlink";

export default function TrendingList({ rows, now, compact = false, testid = "trending" }: { rows: (ArchiveRow & { score?: number; rank?: number })[]; now: number; compact?: boolean; testid?: string }) {
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (!row.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
  if (!unique.length) return <p className="px-4 py-6 font-mono text-sm text-zinc-500" data-testid={`${testid}-empty`}>No signal yet. Check back after the next sweep.</p>;
  return (
    <ol className="divide-y divide-zinc-800/80 px-4" data-testid={testid}>
      {unique.map((r, i) => (
        <li key={r.id} className="flex gap-3 py-2.5" data-testid={`${testid}-item`}>
          <span className="mt-0.5 shrink-0 font-mono text-[11px] text-amber-400/80" aria-hidden="true">#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <a href={r.link} target="_blank" rel="noopener noreferrer" className={`font-semibold leading-snug text-zinc-100 hover:text-emerald-300 hover:underline ${compact ? "text-sm" : ""}`}>
              {r.category === "satire" && <SatireBadge />}
              {r.breaking && r.category !== "satire" && <span className="mr-1.5 rounded-sm bg-red-600 px-1 align-middle font-mono text-[10px] font-bold text-white">FLASH</span>}
              {r.title}<span className="sr-only"> (opens {r.source} in a new tab)</span>
            </a>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-zinc-400">
              <span className="text-emerald-300/90">{r.source}</span>
              {r.published_at && <><span aria-hidden="true">//</span><RelTime ts={Date.parse(r.published_at)} serverNow={now} /></>}
              {!compact && (r.category === "satire" ? <DisinfoBadge /> : <ClearanceBadge outlets={r.outlets} />)}
              <VoteButton id={r.id} initial={r.votes} title={r.title} link={r.link} />
            </div>
          </div>
          {canHotlink(r.image) && (
            <a href={r.link} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true" className="gt-side-thumb self-start shrink-0 overflow-hidden rounded border border-zinc-800">
              <Thumb src={r.image} source={r.source} title={r.title} ratio="4/3" className="w-full" />
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}
