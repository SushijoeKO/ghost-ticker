import { SECTION_LABEL, SECTIONS, type Filters, type SectionId } from "@/lib/query";

const select = "rounded border border-zinc-700 bg-black/60 px-2 py-2 font-mono text-xs uppercase tracking-wide text-zinc-100 focus:border-emerald-400 focus:outline-none";

export default function FilterBar({ filters, sections = true }: { filters: Filters; sections?: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="filter-bar">
      {sections && (
        <label className="flex min-w-[9rem] flex-1 flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Section
          <select name="section" defaultValue={filters.section} className={select}>
            <option value="">Any desk</option>
            {SECTIONS.map((id) => (
              <option key={id} value={id}>{SECTION_LABEL[id as SectionId]}</option>
            ))}
          </select>
        </label>
      )}
      <label className="flex min-w-[8rem] flex-1 flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Outlet
        <input name="outlet" type="search" defaultValue={filters.outlet} maxLength={80} placeholder="Reuters" autoComplete="off" className={`${select} normal-case`} data-testid="filter-outlet" />
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Time
        <select name="range" defaultValue={filters.range} className={select} data-testid="filter-range">
          <option value="">Any time</option>
          <option value="1h">1 hour</option>
          <option value="6h">6 hours</option>
          <option value="24h">24 hours</option>
          <option value="7d">7 days</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        Clearance
        <select name="level" defaultValue={filters.level ? String(filters.level) : ""} className={select} data-testid="filter-level">
          <option value="">Any level</option>
          <option value="1">L1 Confidential</option>
          <option value="2">L2 Secret</option>
          <option value="3">L3 Top Secret</option>
          <option value="4">L4 Cosmic</option>
        </select>
      </label>
      <label className="flex items-center gap-2 self-end py-2 font-mono text-[11px] uppercase tracking-wide text-yellow-200">
        <input type="checkbox" name="satire" value="1" defaultChecked={filters.satire && filters.section !== "satire"} className="accent-yellow-300" data-testid="filter-satire" />
        Include satire
      </label>
      <button type="submit" className="btn-solid self-end">Apply</button>
    </div>
  );
}
