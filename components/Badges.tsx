import Redacted from "./Redacted";
import type { Tag } from "@/lib/tags.ts";
import { LEVELS, clearance, tipText } from "@/lib/clearance";

/** High-contrast mark so a joke headline cannot be read as reporting. */
export function SatireBadge() {
  return (
    <span className="satire-badge mr-1.5 inline-block rounded-sm bg-yellow-300 px-1.5 py-px align-middle font-mono text-[11px] font-black tracking-[0.16em] text-black" data-testid="satire-badge">
      SATIRE
    </span>
  );
}

/** Replaces L1–L4. Satire outlets do not count toward a clearance level. */
export function DisinfoBadge() {
  return (
    <span className="clr clr-disinfo" data-testid="disinfo-badge" title="Joke from a satire outlet. Not a clearance level.">
      <span aria-hidden="true">DISINFO</span>
      <span className="sr-only">Satire. Not a news clearance level.</span>
    </span>
  );
}

export function TagBadge({ tag }: { tag: Tag | null }) {
  if (!tag) return null;
  const cls = tag.name === "FLASH" ? "bg-red-600 text-white border-red-500" : tag.name === "PRIORITY" ? "bg-zinc-200 text-zinc-900 border-zinc-300" : "bg-amber-400/10 text-amber-200 border-amber-400/50";
  return (
    <span className={`gt-tag mr-1.5 inline-block rounded-sm border px-1 py-px align-middle font-mono text-[10px] font-bold tracking-wider ${cls}`} title={tag.hint} data-testid="tag" data-tag={tag.name} data-tone={tag.tone}>
      {tag.name}
    </span>
  );
}

export { clearance };

/** Clearance badge: a link to the legend; hover, focus or tap shows a one-line meaning (see ClearanceTip). */
export function ClearanceBadge({ outlets }: { outlets: number }) {
  const c = clearance(outlets);
  const n = `${outlets} outlet${outlets === 1 ? "" : "s"} on this story`;
  return (
    <a href="/about#clearance" className={`clr clr-l${c.lvl}`} data-testid="clearance" data-level={c.lvl} data-tip={tipText(c)} data-count={n}>
      <span aria-hidden="true">L{c.lvl} · {c.label}</span>
      <span className="sr-only">Clearance {tipText(c)} ({n}). Open the clearance levels legend.</span>
    </a>
  );
}

/** Static (non-interactive) badge for legends. */
export function LevelChip({ lvl }: { lvl: number }) {
  const c = LEVELS[lvl - 1];
  return <span className={`clr clr-l${c.lvl} clr-static`} data-testid="level-chip" data-level={c.lvl}>L{c.lvl} · {c.label}</span>;
}

/** Neutral field note with hover/tap/focus-to-declassify redaction bars over real story data (facts only). */
export function AgentNote({ also, place }: { also: string[]; place?: string | null }) {
  const names = also.length > 2 ? `${also.slice(0, 2).join(", ")} +${also.length - 2} more` : also.join(", ");
  return (
    <p className="agent-note mt-2 font-mono text-[11px] normal-case leading-relaxed tracking-wide text-zinc-400" data-testid="agent-note">
      <span className="text-zinc-500">AGENT NOTE:</span>{" "}
      {names ? <>corroborated by <Redacted kind="corroborating outlets">{names}</Redacted></> : <>single-source intercept</>}
      {place && <>; location <Redacted kind="location">{place}</Redacted></>}.
    </p>
  );
}
