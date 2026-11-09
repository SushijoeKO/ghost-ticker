"use client";
import { useEffect, useState } from "react";
import { beep, ensureAudio } from "./FxRoot";

export default function FxControls() {
  const [crt, setCrt] = useState(true);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    setCrt(document.documentElement.classList.contains("crt"));
    try { setSound(localStorage.getItem("gt-sound") === "on"); } catch {}
  }, []);
  const toggleCrt = () => {
    const v = !crt; setCrt(v);
    document.documentElement.classList.toggle("crt", v);
    try { localStorage.setItem("gt-crt", v ? "on" : "off"); } catch {}
    if (!v) window.dispatchEvent(new Event("gt-fx-off"));
  };
  const toggleSound = () => {
    const v = !sound; setSound(v);
    try { localStorage.setItem("gt-sound", v ? "on" : "off"); } catch {}
    if (v) { ensureAudio(); beep(); }
  };
  const cls = (on: boolean) => `fx-toggle rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${on ? "border-emerald-400 text-emerald-200" : "border-zinc-700 text-zinc-400"}`;
  return (
    <div className="flex gap-1.5" role="group" aria-label="Display and sound settings">
      <button type="button" className={cls(crt)} aria-pressed={crt} onClick={toggleCrt} data-testid="crt-toggle" title="Retro effects: CRT scanlines and the headline decrypt animation">CRT {crt ? "on" : "off"}</button>
      <button type="button" className={cls(sound)} aria-pressed={sound} onClick={toggleSound} data-testid="sound-toggle" title="Beep when new breaking items arrive">{sound ? "🔊 Alerts on" : "🔇 Alerts off"}</button>
    </div>
  );
}
