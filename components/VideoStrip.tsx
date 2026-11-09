"use client";
import { useState } from "react";
import type { Video } from "@/lib/videos";

/** Thumbnails only until the visitor clicks; then a youtube-nocookie.com player is created for that one video. */
export default function VideoStrip({ videos }: { videos: Video[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  if (!videos.length) return null;
  return (
    <section aria-labelledby="h-video" className="panel" data-testid="section-video">
      <header className="panel-head flex flex-wrap items-center justify-between gap-2">
        <h2 id="h-video" className="flex items-center gap-2 font-mono text-sm font-bold uppercase tracking-[0.18em] text-zinc-100">
          <span className="inline-block h-3 w-1.5 bg-cyan-400" aria-hidden="true" />Video intercepts<span className="text-[10px] font-normal tracking-[0.25em] text-zinc-500">/FOOTAGE</span>
        </h2>
        <p className="font-mono text-[10px] text-zinc-500">Players load from YouTube (privacy-enhanced mode) only when you press play.</p>
      </header>
      <ul className="no-scrollbar flex gap-3 overflow-x-auto p-4">
        {videos.map((v) => (
          <li key={v.id} className="w-64 shrink-0" data-testid="video">
            <div className="relative aspect-video overflow-hidden rounded border border-zinc-800 bg-black">
              {playing === v.id ? (
                <iframe src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`} title={`${v.channel}: ${v.title}`} className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" data-testid="video-iframe" />
              ) : (
                <button type="button" onClick={() => setPlaying(v.id)} className="group absolute inset-0 block h-full w-full" aria-label={`Play video from ${v.channel}: ${v.title} (loads YouTube)`} data-testid="video-play">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.thumb} alt={`Video thumbnail from ${v.channel}: ${v.title}`} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-80 group-hover:opacity-100" />
                  <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                    <span className="rounded-full border-2 border-cyan-300 bg-black/60 px-3 py-1 font-mono text-xs font-bold tracking-widest text-cyan-200">▶ PLAY</span>
                  </span>
                </button>
              )}
            </div>
            <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-zinc-100">{v.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{v.channel} · {v.lean}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
