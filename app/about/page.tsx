import type { Metadata } from "next";
import Doc from "@/components/Doc";
import { SOURCES, CATEGORIES } from "@/lib/sources";
import { getWire } from "@/lib/feeds";
import { VIDEO_CHANNELS } from "@/lib/videos";
import { SITE } from "@/lib/config";
import { LEVELS } from "@/lib/clearance";
import { LevelChip } from "@/components/Badges";

export const revalidate = 300;
export const metadata: Metadata = { title: "About & Sources", description: "How Ghost Ticker works and every outlet it links to.", alternates: { canonical: "/about" } };

export default async function About() {
  const w = await getWire();
  const status = new Map(w.feeds.map((f) => [f.id, f]));
  const groups = CATEGORIES.filter((c) => c.slug !== "breaking");
  return (
    <Doc active="about">
      <h1>About &amp; Sources</h1>
      <p>
        {SITE.name} is an independent headline index run by {SITE.operator}. Every few minutes it sweeps the public RSS feeds listed
        below, removes near-duplicate stories, flags fresh breaking items, and links each headline straight to the publisher.
      </p>
      <h2>How it works</h2>
      <ul>
        <li>Feeds refresh about every 5 minutes. A feed that fails or times out is skipped until the next sweep.</li>
        <li>We show only the headline, the outlet name, the time, and at most a short summary the outlet puts in its own feed. We never copy full articles or rehost images: story photos are shown directly from the publisher’s servers: the photo in the outlet’s feed, another outlet’s photo of the same story, or the preview image the publisher declares on its own article page. When there is no usable photo the story is shown as text.</li>
        <li>When several outlets run the same story, we show one headline and list the others under “+ more outlets”.</li>
        <li>“Flash” marks stories from hard-news feeds that are only a few hours old and match urgent keywords, or that several outlets picked up within the hour. It is automatic and can be wrong.</li>
        <li>Politics mixes left, center and right outlets on purpose. Lean labels are approximate and based on widely cited media-bias ratings; they are not our judgment of any story.</li>
        <li><strong>Tags</strong> like SUSPICIOUS, BURN NOTICE or WTF-INT are added automatically for fun. Sports, entertainment and pop-culture stories get their own desk tags (PLAYBOOK LEAKED, ASSET TRANSFER, PAPARAZZI SIGINT, DROP ZONE and more). Stories about deaths, violence, disasters, abuse, misconduct allegations, serious injuries or other tragedies never get a joke tag: they get only a neutral FLASH or PRIORITY label, or none.</li>
        <li><strong>Clearance levels</strong> (L1 to L4) show how many outlets are carrying a story. See <a href="#clearance">Clearance Levels</a> below.</li>
        <li><strong>Disinfo Desk</strong> (<a href="/c/satire">/c/satire</a>) is jokes from satire outlets. Every item wears a SATIRE badge. Those headlines are never breaking, never the top story, never in the ticker, the map, or trending, and they do not raise a story’s clearance level.</li>
        <li>The <strong>live map</strong> guesses a location from the headline text using a built-in list of countries, U.S. states and major cities. It can be wrong. Map outlines come from Natural Earth (public domain).</li>
        <li><strong>Video intercepts</strong> come from news outlets’ public YouTube channel feeds ({VIDEO_CHANNELS.map((c) => c.name).join(", ")}). Players load only when you press play.</li>
        <li><strong>Upvotes and trending</strong> are anonymous (see the Privacy Policy). Trending weighs votes, the number of outlets and freshness. The searchable archive keeps headlines for about 7 days.</li>
      </ul>
      <section id="clearance" aria-labelledby="clearance-h" data-testid="about-clearance">
        <h2 id="clearance-h">Clearance Levels</h2>
        <p>
          Every headline carries a clearance badge. It tells you how many of the outlets we watch are reporting the same story right now.
          Think of it as how loud the chatter is on the wire.
        </p>
        <dl className="mt-3 space-y-3" data-testid="clearance-levels">
          {LEVELS.map((l) => (
            <div key={l.lvl} className="rounded border border-zinc-800 bg-black/30 p-3" data-testid={`clearance-def-${l.lvl}`}>
              <dt className="flex flex-wrap items-center gap-2"><LevelChip lvl={l.lvl} /> <span className="font-mono text-xs uppercase tracking-wider text-zinc-300">{l.range}</span></dt>
              <dd className="mt-1 text-zinc-300">{l.blurb}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3">
          <li><strong>Levels update automatically.</strong> As more outlets pick a story up, its badge climbs on the next sweep, about every 5 minutes. A story can start at L1 and reach L4 within the hour.</li>
          <li><strong>A level shows reach, not truth.</strong> A high level means a story is being widely reported. It does not mean we have checked it, and a low level does not mean it is wrong. Always read the outlet’s full report.</li>
          <li>Tap, hover or focus any badge on the site for a one-line reminder of what it means.</li>
        </ul>
        <h3 className="mt-5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-zinc-100">Tags</h3>
        <p>
          The small yellow labels in front of some headlines, like SUSPICIOUS, BURN NOTICE, PLAYBOOK LEAKED or PAPARAZZI SIGINT, are jokes added
          automatically from keywords in the headline. They are not a judgment of the story. Stories about deaths, violence, disasters,
          abuse, serious injuries or other tragedies never get a joke tag. At most they get a neutral FLASH (fresh urgent news) or PRIORITY label.
        </p>
        <h3 className="mt-5 font-mono text-sm font-bold uppercase tracking-[0.15em] text-zinc-100">Redaction bars</h3>
        <p>
          The black bars in agent notes hide real details from the story, like which other outlets are carrying it or where it happened.
          Hover over, focus or tap a bar to declassify it. Nothing secret is hidden there: it is just part of the game.
        </p>
      </section>
      <p>
        All headlines, summaries and trademarks belong to their publishers. Publishers who want a feed removed can email{" "}
        <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>.
      </p>
      <h2>Sources ({SOURCES.length})</h2>
      <p className="font-mono text-xs text-zinc-400">
        Last sweep: {w.feeds.filter((f) => f.ok).length} of {w.feeds.length} feeds answered.
      </p>
      {groups.map((g) => (
        <section key={g.slug} aria-labelledby={`src-${g.slug}`}>
          <h3 id={`src-${g.slug}`} className="mt-6 font-mono text-sm font-bold uppercase tracking-[0.15em] text-zinc-100">{g.label}</h3>
          <ul data-testid={`sources-${g.slug}`}>
            {SOURCES.filter((s) => s.category === g.slug).map((s) => {
              const st = status.get(s.id);
              return (
                <li key={s.id}>
                  <a href={s.home} target="_blank" rel="noopener noreferrer">{s.name}</a>{" "}
                  <span className="font-mono text-xs text-zinc-400">· {s.lean} · <a href={s.url} target="_blank" rel="noopener noreferrer" className="!text-zinc-400">feed</a> · {st?.ok ? "online" : st?.reached ? "no recent items" : "offline this sweep"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Doc>
  );
}
