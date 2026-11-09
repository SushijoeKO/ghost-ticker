import { LEVELS } from "@/lib/clearance";
import { LevelChip } from "./Badges";

// Home-page key. Desktop/tablet: one compact strip. Mobile: a collapsed <details> so it never pushes content down.
const short = (r: string) => r.replace(/ outlets?$/, "");
export default function ClearanceKey() {
  const items = LEVELS.map((l) => (
    <li key={l.lvl} className="flex items-center gap-1.5 whitespace-nowrap"><LevelChip lvl={l.lvl} /><span className="text-zinc-400">{l.range}</span></li>
  ));
  const strip = LEVELS.map((l) => (
    <li key={l.lvl} className="flex items-center gap-1.5 whitespace-nowrap"><LevelChip lvl={l.lvl} /><span className="text-zinc-400">{short(l.range)}<span className="sr-only"> {l.range.endsWith("outlet") ? "outlet" : "outlets"}</span></span></li>
  ));
  return (
    <>
      <nav aria-label="Clearance levels key" className="clr-key hidden items-center gap-x-4 gap-y-2 rounded border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-zinc-300 sm:flex sm:flex-wrap" data-testid="clearance-key">
        <span className="font-bold tracking-[0.2em] text-zinc-200">Clearance levels <span className="font-normal normal-case tracking-normal text-zinc-500">· outlets carrying the story</span></span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1.5">{strip}</ul>
        <a href="/about#clearance" className="ml-auto normal-case text-emerald-300 underline-offset-2 hover:underline">What do these mean? →</a>
      </nav>
      <details className="clr-key rounded border border-zinc-800 bg-black/40 font-mono text-[11px] uppercase tracking-wide text-zinc-300 sm:hidden" data-testid="clearance-key-mobile">
        <summary className="cursor-pointer px-3 py-2 font-bold tracking-[0.2em] text-zinc-200">Clearance levels <span className="font-normal normal-case tracking-normal text-zinc-500">· how many outlets carry a story</span></summary>
        <ul className="grid gap-1.5 px-3 pb-2">{items}</ul>
        <a href="/about#clearance" className="block px-3 pb-2.5 normal-case text-emerald-300 underline-offset-2 hover:underline">What do these mean? →</a>
      </details>
    </>
  );
}
