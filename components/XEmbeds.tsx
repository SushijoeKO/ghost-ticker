"use client";
import { useEffect, useRef, useState } from "react";

declare global { interface Window { twttr?: { widgets?: { load: (el?: Element) => void } } } }

function loadWidgets(): Promise<void> {
  if (window.twttr?.widgets) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://platform.twitter.com/widgets.js";
    s.async = true;
    s.charset = "utf-8";
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
}

function Post({ url, note }: { url: string; note?: string }) {
  const [on, setOn] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on || !box.current) return;
    const el = box.current;
    el.innerHTML = "";
    const bq = document.createElement("blockquote");
    bq.className = "twitter-tweet";
    bq.setAttribute("data-theme", "dark");
    bq.setAttribute("data-dnt", "true");
    const a = document.createElement("a");
    a.href = url;
    a.textContent = url;
    bq.appendChild(a);
    el.appendChild(bq);
    loadWidgets().then(() => window.twttr?.widgets?.load(el));
  }, [on, url]);
  return (
    <li className="panel p-3" data-testid="x-post">
      {note && <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-zinc-400">{note}</p>}
      {on ? <div ref={box} data-testid="x-embed" /> : (
        <div>
          <p className="break-all font-mono text-xs text-zinc-400">{url}</p>
          <button type="button" className="btn-ghost mt-2" onClick={() => setOn(true)} data-testid="x-load">Load post from X</button>
          <p className="mt-1 text-[11px] text-zinc-500">Loading contacts X (twitter.com), which may set cookies. <a className="underline" href={url} target="_blank" rel="noopener noreferrer">Open on X instead</a>.</p>
        </div>
      )}
    </li>
  );
}

export default function XEmbeds({ posts }: { posts: { url: string; note?: string }[] }) {
  if (!posts.length) return null;
  return (
    <section aria-labelledby="h-x" data-testid="section-x">
      <h2 id="h-x" className="mb-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">Pinned chatter <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/OPEN-CHANNEL</span></h2>
      <ul className="grid gap-3 md:grid-cols-2">{posts.map((p) => <Post key={p.url} {...p} />)}</ul>
    </section>
  );
}
