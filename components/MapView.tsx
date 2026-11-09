"use client";
import { useMemo, useState } from "react";
import type { Pin } from "@/lib/feeds";

const REGIONS: Record<string, [number, number, number, number]> = {
  World: [0, 15, 1000, 400],
  "N. America": [60, 60, 300, 170],
  Europe: [440, 70, 170, 95],
  "Middle East": [560, 130, 130, 75],
  Asia: [620, 60, 300, 190],
};

function ago(ts: number, now: number) {
  if (!ts) return "";
  const m = Math.max(0, Math.round((now - ts) / 60000));
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
}

export default function MapView({ pins, now, compact = false }: { pins: Pin[]; now: number; compact?: boolean }) {
  const [region, setRegion] = useState("World");
  const [sel, setSel] = useState<string | null>(null);
  const vb = REGIONS[region];
  const k = vb[2] / 1000; // keep pins the same on-screen size when zoomed
  const selected = useMemo(() => pins.find((p) => p.id === sel) ?? null, [pins, sel]);

  return (
    <div className="map-wrap" data-testid={compact ? "mini-map" : "map"}>
      {!compact && (
        <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Map region">
          {Object.keys(REGIONS).map((r) => (
            <button key={r} type="button" onClick={() => { setRegion(r); setSel(null); }} aria-pressed={region === r}
              className={`map-chip rounded-sm border px-2 py-1 font-mono text-[11px] uppercase tracking-wider ${region === r ? "border-emerald-400 text-emerald-200" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <svg viewBox={vb.join(" ")} className="map-svg block w-full rounded border border-emerald-900/60" role="group" aria-label={`World map with ${pins.length} intel locations`}>
          <rect x="0" y="0" width="1000" height="500" fill="#020806" />
          <image href="/world.svg" x="0" y="0" width="1000" height="500" />
          {/* draw least important first so breaking/newest pins sit on top */}
          {[...pins].reverse().map((p) => {
            const age = now - p.newest;
            const fresh = age < 3600e3 ? "pin-hot" : age < 6 * 3600e3 ? "pin-warm" : "pin-cold";
            const r = (p.level >= 3 ? 3.2 : 4) * k * (compact ? 1.6 : 1.2);
            return (
              <g key={p.id} className={`pin ${fresh} ${p.breaking ? "pin-breaking" : ""}`} role="button" tabIndex={0}
                aria-label={`${p.name}: ${p.count} stor${p.count === 1 ? "y" : "ies"}${p.breaking ? ", breaking" : ""}`} aria-expanded={sel === p.id}
                onClick={() => setSel(sel === p.id ? null : p.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(sel === p.id ? null : p.id); } }}
                data-testid="pin" data-name={p.name}>
                <circle cx={p.x} cy={p.y} r={r * (compact ? 3.5 : 2.6)} fill="transparent" />
                <circle className="pin-ring" cx={p.x} cy={p.y} r={r * 2} />
                <circle className="pin-dot" cx={p.x} cy={p.y} r={sel === p.id ? r * 1.5 : r} />
              </g>
            );
          })}
        </svg>
        {selected && (
          <div className="map-panel panel mt-2 p-3 sm:absolute sm:bottom-2 sm:left-2 sm:mt-0 sm:max-w-md" role="region" aria-label={`Headlines near ${selected.name}`} data-testid="pin-panel">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">⌖ {selected.name} · {selected.count}</p>
              <button type="button" onClick={() => setSel(null)} className="map-chip font-mono text-xs text-zinc-400 hover:text-zinc-100" aria-label="Close headlines panel">✕</button>
            </div>
            <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto">
              {selected.items.map((it) => (
                <li key={it.id} className="text-sm leading-snug">
                  {it.breaking && <span className="mr-1 rounded-sm bg-red-600 px-1 font-mono text-[9px] font-bold text-white">FLASH</span>}
                  <a href={it.link} target="_blank" rel="noopener noreferrer" className="text-zinc-100 hover:text-emerald-300 hover:underline">{it.title}</a>
                  <span className="ml-1 font-mono text-[10px] uppercase text-zinc-500">{it.source} · {ago(it.ts, now)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
