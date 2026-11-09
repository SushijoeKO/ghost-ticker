import type { Cluster } from "@/lib/feeds";

export default function Ticker({ items }: { items: Cluster[] }) {
  if (items.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="ticker-row" aria-hidden={hidden || undefined}>
      {items.map((c) => (
        <li key={c.id + (hidden ? "-b" : "")} className="ticker-item">
          <span className="text-red-400" aria-hidden="true">◆</span>{" "}
          <a href={c.lead.link} target="_blank" rel="noopener noreferrer" tabIndex={hidden ? -1 : undefined} className="hover:underline">
            {c.lead.title}
          </a>{" "}
          <span className="text-zinc-400">[{c.lead.source.name}]</span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Breaking ticker" className="ticker border-y border-red-900/70 bg-red-950/40">
      <div className="flex items-stretch">
        <div className="ticker-label shrink-0 bg-red-600 px-3 py-2 font-mono text-xs font-bold tracking-[0.2em] text-white flex items-center gap-2">
          <span className="live-dot" aria-hidden="true" /> FLASH
        </div>
        <div className="ticker-viewport relative min-w-0 flex-1 overflow-hidden py-2 font-mono text-sm">
          <div className="ticker-track" data-testid="ticker-track" style={{ ["--ticker-dur" as string]: `${Math.max(40, items.length * 9)}s` }}>
            {row(false)}
            {row(true)}
          </div>
        </div>
      </div>
    </section>
  );
}
