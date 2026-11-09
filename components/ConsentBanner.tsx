"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "gt-consent-v1";
// Regions where a consent prompt is shown automatically (EEA, UK, Switzerland),
// detected from the browser time zone only. No IP lookup, no third-party calls.
const EU_TZ = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)|Arctic\/)/;

export function openConsent() {
  window.dispatchEvent(new Event("gt-open-consent"));
}

export default function ConsentBanner() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(KEY); } catch {}
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const preview = new URLSearchParams(location.search).has("consent-preview");
    if (!stored && (EU_TZ.test(tz) || preview)) setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener("gt-open-consent", onOpen);
    return () => window.removeEventListener("gt-open-consent", onOpen);
  }, []);
  const choose = (v: "granted" | "denied") => {
    try { localStorage.setItem(KEY, JSON.stringify({ ads: v, at: new Date().toISOString() })); } catch {}
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-500/40 bg-zinc-950/95 p-4 backdrop-blur" data-testid="consent">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center">
        <div className="text-sm text-zinc-300">
          <p id="consent-title" className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Privacy clearance</p>
          <p className="mt-1">
            Ghost Ticker uses no tracking or analytics. If advertising is switched on in the future, ad partners may use cookies to
            personalise ads. Choose whether you allow that; you can change it any time from the footer. See the{" "}
            <Link href="/privacy" className="text-emerald-300 underline">Privacy Policy</Link>.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => choose("denied")} className="btn-ghost">Reject</button>
          <button onClick={() => choose("granted")} className="btn-solid">Accept</button>
        </div>
      </div>
    </div>
  );
}

export function ConsentLink() {
  return (
    <button type="button" onClick={openConsent} className="footer-link hover:text-emerald-300 hover:underline">
      Privacy choices
    </button>
  );
}
