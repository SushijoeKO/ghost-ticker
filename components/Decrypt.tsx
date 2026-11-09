"use client";
import { useEffect, useRef, useState } from "react";

/**
 * One-time "decrypt" of a headline. The real characters always stay in the DOM in place (so copy/paste,
 * screen readers and layout never change); each not-yet-decoded character is painted over with a
 * monospace glyph via ::after on a per-character span, so the scramble lines up exactly with the real text.
 * Plays once per story per browser (remembered in localStorage), only for headlines marked `play`,
 * only when the retro FX toggle is on and reduced motion is off, and it always settles on the real text.
 */
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&$*+=<>/";
const KEY = "gt-decrypted";
const fxOn = () => document.documentElement.classList.contains("crt");
const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function seenSet(): string[] { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
function markSeen(id: string) { try { const s = seenSet().filter((x) => x !== id); s.push(id); localStorage.setItem(KEY, JSON.stringify(s.slice(-400))); } catch {} }
const glyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

// a little queue so several headlines entering the viewport together decode one after another, not all at once
let running = 0;
const MAX_RUNNING = 2;
const waiting: (() => void)[] = [];
function acquire(fn: () => void) { if (running < MAX_RUNNING) { running++; fn(); } else waiting.push(fn); }
function release() { running = Math.max(0, running - 1); const n = waiting.shift(); if (n) { running++; n(); } }

export default function Decrypt({ id, text, play = false }: { id: string; text: string; play?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<{ done: number; g: string[] } | null>(null);
  useEffect(() => {
    if (!play || !text || text.length > 220) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window) || reduced() || !fxOn() || seenSet().includes(id)) return;
    let alive = true, started = false, raf = 0, safety: ReturnType<typeof setTimeout> | undefined, tick = 0;
    const finish = () => {
      if (!alive) return;
      alive = false;
      cancelAnimationFrame(raf); clearTimeout(safety);
      setState(null);
      if (started) release();
    };
    const run = () => {
      if (!alive || document.hidden) { if (alive) { alive = false; release(); } return; }
      started = true;
      markSeen(id);
      const dur = Math.min(900, Math.max(700, text.length * 11));
      const t0 = performance.now();
      safety = setTimeout(finish, dur + 300); // settles even if animation frames are throttled
      const step = (now: number) => {
        if (!alive) return;
        const p = (now - t0) / dur;
        if (p >= 1) return finish();
        if (++tick % 2 === 0) { // ~30 fps is plenty and keeps React work small
          const done = Math.floor(text.length * p * p * (3 - 2 * p)); // ease in-out, left to right
          setState({ done, g: Array.from({ length: text.length }, glyph) });
        }
        raf = requestAnimationFrame(step);
      };
      setState({ done: 0, g: Array.from({ length: text.length }, glyph) });
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting || document.hidden) return;
      io.disconnect();
      acquire(run);
    }, { threshold: 0.6 });
    io.observe(el);
    const onHide = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", finish);
    window.addEventListener("gt-fx-off", finish);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", finish);
      window.removeEventListener("gt-fx-off", finish);
      if (alive) { alive = false; cancelAnimationFrame(raf); clearTimeout(safety); if (started) release(); }
    };
  }, [id, text, play]);

  if (!state) return <span ref={ref} data-decrypt={id}>{text}</span>;
  // one span per character keyed by its absolute position, so the DOM structure is identical in every frame
  // (only classes/attributes change): nothing moves, nothing rewraps, no layout shift
  return (
    <span ref={ref} data-decrypt={id} data-decrypting="" className="gt-decrypting">
      {Array.from(text).map((ch, i) =>
        ch === " " ? " " : <span key={i} className={i < state.done ? undefined : "gt-ch"} data-g={i < state.done ? undefined : state.g[i]}>{ch}</span>,
      )}
    </span>
  );
}
