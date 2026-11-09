import Link from "next/link";
import type { Cluster } from "@/lib/feeds";
import Headline from "./Headline";
import AdSlot from "./AdSlot";

export default function Section({
  id, title, code, items, now, more, showLean = false, showSnippet = false, adAfter, accent = "emerald", votes = {}, leadCard = true, note,
}: {
  id: string; title: string; code: string; items: Cluster[]; now: number; more?: string;
  showLean?: boolean; showSnippet?: boolean; adAfter?: number; accent?: "emerald" | "red" | "amber" | "violet" | "sky" | "rose" | "orange"; votes?: Record<string, number>; leadCard?: boolean;
  note?: string;
}) {
  // lead card: if the first story has no photo, promote the next photo-bearing story among the top four
  if (leadCard && items.length > 1 && !items[0].image) {
    const k = items.slice(1, 4).findIndex((c) => c.image);
    if (k >= 0) items = [items[k + 1], ...items.filter((_, i) => i !== k + 1)];
  }
  const bar = { emerald: "bg-emerald-400", red: "bg-red-500", amber: "bg-amber-400", violet: "bg-fuchsia-400", sky: "bg-sky-400", rose: "bg-rose-400", orange: "bg-orange-400" }[accent];
  return (
    <section aria-labelledby={`h-${id}`} className="panel" data-testid={`section-${id}`}>
      <header className="panel-head flex items-center justify-between gap-2">
        <h2 id={`h-${id}`} className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">
          <span className={`inline-block h-3 w-1.5 ${bar}`} aria-hidden="true" />
          {title}
          <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/{code}</span>
        </h2>
        {more && (
          <Link href={more} className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 hover:text-emerald-300 hover:underline">
            Full file →
          </Link>
        )}
      </header>
      {note && <p className="border-b border-yellow-400/40 bg-yellow-300/15 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-yellow-50" data-testid="section-note">{note}</p>}
      {items.length === 0 ? (
        <p className="px-4 py-6 font-mono text-sm text-zinc-500">No traffic intercepted on this channel right now.</p>
      ) : (
        <ol className="divide-y divide-zinc-800/80 px-4">
          {items.map((c, i) => (
            <FragmentWithAd key={c.id} show={adAfter !== undefined && i === adAfter}>
              <Headline c={c} now={now} showLean={showLean} showSnippet={showSnippet} index={i} card={leadCard && i === 0} votes={votes[c.id] ?? 0} />
            </FragmentWithAd>
          ))}
        </ol>
      )}
    </section>
  );
}

function FragmentWithAd({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <>
      {show && (
        <li className="py-2" aria-hidden="true">
          <AdSlot kind="infeed" />
        </li>
      )}
      {children}
    </>
  );
}
