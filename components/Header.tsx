import Link from "next/link";
import Logo from "./Logo";
import Clock from "./Clock";
import FxControls from "./FxControls";
import NavActive from "./NavActive";
import RelTime from "./RelTime";
import SearchField from "./SearchField";
import { CATEGORIES } from "@/lib/sources";
import { SITE } from "@/lib/config";

export default function Header({ fetchedAt, feedsOk, feedsTotal, active }: { fetchedAt?: number; feedsOk?: number; feedsTotal?: number; active?: string }) {
  return (
    <header className="border-b border-emerald-900/60 bg-black/60">
      <div className="classif-bar font-mono text-[10px] tracking-[0.35em] text-center py-1">
        UNCLASSIFIED<span className="hidden sm:inline"> // OPEN-SOURCE INTELLIGENCE</span> // FOR PUBLIC RELEASE
      </div>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label={`${SITE.name} home`}>
          <Logo className="h-11 w-11" />
          <span>
            <span className="brand block text-2xl font-black tracking-[0.12em] text-zinc-50 sm:text-3xl">
              GHOST<span className="text-emerald-400">TICKER</span>
            </span>
            <span className="block font-mono text-[11px] tracking-wider text-zinc-400">{SITE.tagline}</span>
          </span>
        </Link>
        <form action="/search" method="get" role="search" className="order-last flex w-full min-w-0 gap-2 sm:order-none sm:w-64" aria-label="Search the wire">
          <label htmlFor="header-q" className="sr-only">Search headlines. Press slash to focus.</label>
          <SearchField id="header-q" placeholder="Search  /" />
          <button type="submit" className="btn-solid shrink-0 px-3">Go</button>
        </form>
        <div className="flex flex-col items-start gap-2 sm:items-end">
        <FxControls />
        <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 font-mono text-[11px] uppercase tracking-wider text-zinc-400 sm:text-right">
          <span>Clock</span>
          <span className="text-emerald-300"><Clock /></span>
          {fetchedAt !== undefined && (
            <>
              <span>Last sweep</span>
              <span className="text-emerald-300" data-testid="last-sweep"><RelTime ts={fetchedAt} serverNow={fetchedAt} /></span>
              <span>Feeds online</span>
              <span className="text-emerald-300" data-testid="feeds-online">{feedsOk}/{feedsTotal}</span>
            </>
          )}
        </div>
        </div>
      </div>
      <nav aria-label="Channels" className="border-t border-zinc-800/80">
        <ul className="nav-scroll mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 font-mono text-xs uppercase tracking-[0.15em] no-scrollbar" data-testid="nav-list">
          <li><Link href="/" className={`nav-link ${active === "home" ? "nav-active" : ""}`} aria-current={active === "home" ? "page" : undefined}>Home</Link></li>
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <Link href={`/c/${c.slug}`} className={`nav-link ${active === c.slug ? "nav-active" : ""} ${c.slug === "breaking" ? "text-red-300" : ""} ${c.slug === "satire" ? "text-yellow-300" : ""}`} aria-current={active === c.slug ? "page" : undefined}>
                {c.label}
              </Link>
            </li>
          ))}
          <li><Link href="/map" className={`nav-link ${active === "map" ? "nav-active" : ""} text-cyan-300`} aria-current={active === "map" ? "page" : undefined}>Map</Link></li>
          <li><Link href="/trending" className={`nav-link ${active === "trending" ? "nav-active" : ""}`} aria-current={active === "trending" ? "page" : undefined}>Trending</Link></li>
          <li><Link href="/search" className={`nav-link ${active === "search" ? "nav-active" : ""}`} aria-current={active === "search" ? "page" : undefined}>Search</Link></li>
          <li><Link href="/about" className={`nav-link ${active === "about" ? "nav-active" : ""}`} aria-current={active === "about" ? "page" : undefined}>Sources</Link></li>
        </ul>
        <NavActive />
      </nav>
    </header>
  );
}
