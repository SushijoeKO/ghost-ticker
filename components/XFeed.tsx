"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT = "https://platform.twitter.com/widgets.js";
const WAIT_MS = 8000;
const TIMELINE_HEIGHT = 320;

const ACCOUNTS = [
  { handle: "BBCBreaking", label: "BBC Breaking", href: "https://x.com/BBCBreaking" },
  { handle: "cnnbrk", label: "CNN Breaking", href: "https://x.com/cnnbrk" },
  { handle: "NPR", label: "NPR", href: "https://x.com/NPR" },
  { handle: "Reuters", label: "Reuters", href: "https://x.com/Reuters" },
  { handle: "rawsalerts", label: "Raw Alerts", href: "https://x.com/rawsalerts" },
  { handle: "Breaking911", label: "Breaking911", href: "https://x.com/Breaking911" },
  { handle: "DailyCaller", label: "Daily Caller", href: "https://x.com/DailyCaller" },
  { handle: "TheInsiderPaper", label: "Insider Paper", href: "https://x.com/TheInsiderPaper" },
  { handle: "Polymarket", label: "Polymarket", href: "https://x.com/Polymarket" },
  { handle: "Kalshi", label: "Kalshi", href: "https://x.com/Kalshi" },
  { handle: "ExxAlerts", label: "Exx Alerts", href: "https://x.com/ExxAlerts" },
] as const;

type Handle = (typeof ACCOUNTS)[number]["handle"];

type Widgets = {
  load?: (el?: Element) => void;
};

function isHandle(value: string): value is Handle {
  return ACCOUNTS.some((account) => account.handle === value);
}

function timelineReady(el: HTMLElement): boolean {
  const iframe = el.querySelector("iframe");
  if (!(iframe instanceof HTMLIFrameElement)) return false;
  const style = window.getComputedStyle(iframe);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const box = iframe.getBoundingClientRect();
  return box.width >= 40 && box.height >= 40;
}

function widgets(): Widgets | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { twttr?: { widgets?: Widgets } }).twttr?.widgets;
}

let scriptPromise: Promise<boolean> | null = null;

function loadWidgets(): Promise<boolean> {
  try {
    if (widgets()?.load) return Promise.resolve(true);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve) => {
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      try {
        let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
        if (!script) {
          script = document.createElement("script");
          script.src = SCRIPT;
          script.async = true;
          script.charset = "utf-8";
          script.id = "gt-x-widgets";
          document.body.appendChild(script);
        }
        script.addEventListener("load", () => finish(true), { once: true });
        script.addEventListener("error", () => finish(false), { once: true });
        window.setTimeout(() => finish(false), WAIT_MS);
      } catch {
        finish(false);
      }
    });
    return scriptPromise;
  } catch {
    return Promise.resolve(false);
  }
}

async function readyWidgets(): Promise<Widgets | undefined> {
  const loaded = await loadWidgets();
  if (!loaded && !widgets()?.load) return undefined;
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const api = widgets();
    if (api?.load) return api;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  return widgets();
}

function XAccountControls({ handle, onChange }: { handle: Handle; onChange: (next: Handle) => void }) {
  return (
    <>
      <div className="px-2 py-2 sm:hidden">
        <label htmlFor="x-feed-account" className="sr-only">Wire account</label>
        <select
          id="x-feed-account"
          className="w-full rounded border border-zinc-700 bg-black/60 px-2 py-2 font-mono text-xs uppercase tracking-wider text-zinc-100 focus:border-emerald-400 focus:outline-none"
          value={handle}
          aria-controls="x-feed-stage"
          data-testid="x-feed-select"
          onChange={(event) => {
            if (isHandle(event.target.value)) onChange(event.target.value);
          }}
        >
          {ACCOUNTS.map((account) => (
            <option key={account.handle} value={account.handle}>{account.label}</option>
          ))}
        </select>
      </div>
      <div className="no-scrollbar hidden gap-1 overflow-x-auto overscroll-x-contain px-2 py-2 sm:flex" role="tablist" aria-label="Wire accounts" data-testid="x-feed-tabs">
        {ACCOUNTS.map((account) => {
          const selected = handle === account.handle;
          return (
            <button
              key={account.handle}
              type="button"
              role="tab"
              id={`x-tab-${account.handle}`}
              aria-selected={selected}
              aria-controls="x-feed-stage"
              className={`btn-ghost shrink-0 px-2 py-1 text-[10px] ${selected ? "border-emerald-400 text-emerald-300" : ""}`}
              onClick={() => onChange(account.handle)}
            >
              {account.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default function XFeed() {
  const [optIn, setOptIn] = useState(false);
  const [handle, setHandle] = useState<Handle>("BBCBreaking");
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!optIn) return;
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    setFailed(false);
    const timer = window.setTimeout(() => {
      if (!cancelled && !timelineReady(el)) setFailed(true);
    }, WAIT_MS);
    const seen = new MutationObserver(() => {
      if (!timelineReady(el)) return;
      window.clearTimeout(timer);
      if (!cancelled) setFailed(false);
    });
    seen.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "height", "width"] });

    (async () => {
      try {
        try {
          el.replaceChildren();
        } catch {
          el.textContent = "";
        }
        const anchor = document.createElement("a");
        anchor.className = "twitter-timeline";
        anchor.href = `https://twitter.com/${handle}`;
        anchor.setAttribute("data-theme", "dark");
        anchor.setAttribute("data-height", String(TIMELINE_HEIGHT));
        anchor.setAttribute("data-dnt", "true");
        anchor.textContent = `@${handle}`;
        el.appendChild(anchor);
        const api = await readyWidgets();
        if (cancelled) return;
        if (!api?.load) {
          setFailed(true);
          return;
        }
        api.load(el);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      seen.disconnect();
    };
  }, [optIn, handle]);

  return (
    <section className="panel min-w-0 max-w-full overflow-hidden" aria-labelledby="h-x-feed" data-testid="section-x-feed">
      <header className="panel-head">
        <h2 id="h-x-feed" className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">
          <span className="inline-block h-3 w-1.5 bg-emerald-400" aria-hidden="true" />
          Wire intercepts
          <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/LIVE FROM X</span>
        </h2>
      </header>
      <XAccountControls handle={handle} onChange={setHandle} />
      <div id="x-feed-stage" className="h-[360px] max-w-full overflow-hidden" data-testid="x-feed-stage">
        {optIn ? (
          <div className="flex h-full min-h-0 flex-col">
            <div ref={box} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [&_iframe]:max-w-full" data-testid="x-timeline" />
            {failed ? (
              <p className="shrink-0 px-3 pb-2 font-mono text-xs text-zinc-300" data-testid="x-feed-fallback-msg">Open on X</p>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <button type="button" className="btn-solid" onClick={() => setOptIn(true)} data-testid="x-feed-load">
              Load live posts from X
            </button>
            <p className="max-w-xs font-mono text-[11px] leading-relaxed text-zinc-400">
              This loads content from X.{" "}
              <a className="text-emerald-400 underline" href="https://x.com/en/privacy" target="_blank" rel="noopener noreferrer">
                X’s privacy policy
              </a>{" "}
              applies.
            </p>
          </div>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800/80 px-3 py-2" data-testid="x-feed-links">
        {ACCOUNTS.map((account) => (
          <li key={account.handle}>
            <a className="font-mono text-[11px] text-emerald-400 underline" href={account.href} target="_blank" rel="noopener noreferrer">
              <span className="sr-only">{account.label} </span>@{account.handle}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
