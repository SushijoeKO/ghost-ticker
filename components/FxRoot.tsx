"use client";
import { useEffect, useState } from "react";

// Site-wide spy effects (decrypt lives in Decrypt.tsx, redaction bars in Redacted.tsx): refresh poller with
// "new intel" toast and an optional (off by default) Web Audio alert for NEW breaking items.

let audioCtx: AudioContext | null = null;
export function soundOn() { try { return localStorage.getItem("gt-sound") === "on"; } catch { return false; } }
export function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  audioCtx?.resume?.();
  return audioCtx;
}
export function beep() {
  const ctx = ensureAudio();
  if (!ctx) return;
  const t = ctx.currentTime;
  [880, 660, 880].forEach((f, i) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "square"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t + i * 0.16); g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.16 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.13);
    o.connect(g).connect(ctx.destination); o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.15);
  });
  (window as any).__gtBeeps = ((window as any).__gtBeeps ?? 0) + 1;
}

export default function FxRoot() {
  const [toast, setToast] = useState<{ n: number; breaking: number } | null>(null);

  // refresh poller (same-origin /api/pulse only)
  useEffect(() => {
    let known: Set<string> | null = null;
    let knownBreaking: Set<string> | null = null;
    const poll = async () => {
      try {
        const r = await fetch("/api/pulse", { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { ids: string[]; breaking: string[] };
        if (!known || !knownBreaking) { known = new Set(j.ids); knownBreaking = new Set(j.breaking); return; }
        const fresh = j.ids.filter((i) => !known!.has(i));
        const freshB = j.breaking.filter((i) => !knownBreaking!.has(i));
        j.ids.forEach((i) => known!.add(i)); j.breaking.forEach((i) => knownBreaking!.add(i));
        if (fresh.length || freshB.length) {
          setToast({ n: fresh.length, breaking: freshB.length });
          if (freshB.length && soundOn()) beep();
        }
      } catch {}
    };
    (window as any).__gtPulseNow = poll;
    poll();
    const t = setInterval(poll, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!toast) return null;
  return (
    <div className="gt-toast fixed bottom-4 right-4 z-50 max-w-xs rounded border border-emerald-400/60 bg-black/90 p-3 font-mono text-xs text-emerald-100 shadow-lg" role="status" aria-live="polite" data-testid="toast">
      <p className="font-bold uppercase tracking-[0.2em] text-emerald-300">{toast.breaking ? "⚠ New flash traffic" : "New intel"}</p>
      <p className="mt-1">{toast.n} new item{toast.n === 1 ? "" : "s"}{toast.breaking ? `, ${toast.breaking} breaking` : ""} intercepted.</p>
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn-solid !px-2 !py-1" onClick={() => location.reload()}>Refresh</button>
        <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => setToast(null)}>Dismiss</button>
      </div>
    </div>
  );
}
