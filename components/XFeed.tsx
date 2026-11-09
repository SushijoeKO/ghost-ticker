"use client";

import { useState } from "react";
import RelTime from "./RelTime";
import { filterPosts, INTERCEPT_ACCOUNTS, isInterceptFilter, linkify, type InterceptFilter, type InterceptPost } from "@/lib/intercepts";

function LinkedText({ text }: { text: string }) {
  return (
    <>
      {linkify(text).map((part, index) => part.kind === "link" ? (
        <a key={index} href={part.value} target="_blank" rel="noopener nofollow ugc" className="text-emerald-300 underline">{part.value}</a>
      ) : (
        <span key={index}>{part.value}</span>
      ))}
    </>
  );
}

function PostCard({ post, serverNow }: { post: InterceptPost; serverNow: number }) {
  const profile = INTERCEPT_ACCOUNTS.find((account) => account.handle.toLowerCase() === post.handle.toLowerCase())?.href
    ?? `https://x.com/${encodeURIComponent(post.handle)}`;
  return (
    <li className="border-b border-zinc-800/80 py-2.5" data-testid="x-post" data-handle={post.handle}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm text-zinc-100">
          <span className="font-semibold">{post.name}</span>{" "}
          <a href={profile} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] text-emerald-400 hover:underline">@{post.handle}</a>
        </p>
        <span className="shrink-0 font-mono text-[10px] tracking-wider text-zinc-500">
          <RelTime ts={post.createdAt} serverNow={serverNow} />
        </span>
      </div>
      <p className="mt-1 text-sm leading-snug text-zinc-300"><LinkedText text={post.text} /></p>
      <a href={post.url} target="_blank" rel="noopener nofollow ugc" className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-emerald-400 hover:underline">View on X</a>
    </li>
  );
}

export default function XFeed({ posts, serverNow }: { posts: InterceptPost[]; serverNow: number }) {
  const [account, setAccount] = useState<InterceptFilter>("all");
  const visible = filterPosts(posts, account);
  const selected = account === "all" ? null : INTERCEPT_ACCOUNTS.find((item) => item.handle === account);

  return (
    <section className="panel min-w-0 max-w-full overflow-hidden" aria-labelledby="h-x-feed" data-testid="section-x-feed">
      <header className="panel-head flex flex-wrap items-center justify-between gap-2">
        <h2 id="h-x-feed" className="flex flex-wrap items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">
          <span className="inline-block h-3 w-1.5 bg-emerald-400" aria-hidden="true" />
          Wire intercepts
          <span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/LIVE FROM X</span>
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500" data-testid="x-feed-updated">Updated every 15 min</p>
      </header>
      <div className="px-2 py-2 sm:hidden">
        <label htmlFor="x-feed-account" className="sr-only">Wire account</label>
        <select
          id="x-feed-account"
          className="w-full rounded border border-zinc-700 bg-black/60 px-2 py-2 font-mono text-xs uppercase tracking-wider text-zinc-100 focus:border-emerald-400 focus:outline-none"
          value={account}
          data-testid="x-feed-select"
          onChange={(event) => {
            if (isInterceptFilter(event.target.value)) setAccount(event.target.value);
          }}
        >
          <option value="all">All</option>
          {INTERCEPT_ACCOUNTS.map((item) => (
            <option key={item.handle} value={item.handle}>{item.label}</option>
          ))}
        </select>
      </div>
      <div className="no-scrollbar hidden gap-1 overflow-x-auto overscroll-x-contain px-2 py-2 sm:flex" role="tablist" aria-label="Wire accounts" data-testid="x-feed-tabs">
        <button type="button" role="tab" id="x-tab-all" aria-selected={account === "all"} className={`btn-ghost shrink-0 px-2 py-1 text-[10px] ${account === "all" ? "border-emerald-400 text-emerald-300" : ""}`} onClick={() => setAccount("all")}>All</button>
        {INTERCEPT_ACCOUNTS.map((item) => {
          const selectedTab = account === item.handle;
          return (
            <button
              key={item.handle}
              type="button"
              role="tab"
              id={`x-tab-${item.handle}`}
              aria-selected={selectedTab}
              className={`btn-ghost shrink-0 px-2 py-1 text-[10px] ${selectedTab ? "border-emerald-400 text-emerald-300" : ""}`}
              onClick={() => setAccount(item.handle)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="h-[360px] max-w-full overflow-y-auto overflow-x-hidden px-3" data-testid="x-feed-stage">
        {visible.length ? (
          <ul>
            {visible.map((post) => <PostCard key={post.id} post={post} serverNow={serverNow} />)}
          </ul>
        ) : (
          <p className="py-6 text-center font-mono text-xs leading-relaxed text-zinc-400" data-testid="x-feed-empty">
            {selected ? (
              <>No recent intercepts — open <a className="text-emerald-400 underline" href={selected.href} target="_blank" rel="noopener noreferrer">@{selected.handle}</a> on X</>
            ) : (
              "No recent intercepts."
            )}
          </p>
        )}
      </div>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 border-t border-zinc-800/80 px-3 py-2" data-testid="x-feed-links">
        {INTERCEPT_ACCOUNTS.map((item) => (
          <li key={item.handle}>
            <a className="font-mono text-[11px] text-emerald-400 underline" href={item.href} target="_blank" rel="noopener noreferrer">
              <span className="sr-only">{item.label} </span>@{item.handle}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
