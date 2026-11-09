"use client";
import { useState } from "react";

/**
 * Black marker bar over a real detail (keyboard: Tab to focus, Enter/Space toggles, Esc re-redacts). Hover (on hover-capable devices) or keyboard focus wipes the ink away;
 * tap/click/Enter/Space toggles it; leaving focus re-redacts. The text is always in the DOM, so the bar has
 * exactly the right length and screen readers get a clear label.
 */
export default function Redacted({ kind, children }: { kind: string; children: string }) {
  const [open, setOpen] = useState(false);
  return (
    // a span with role=button (not <button>): real buttons render as inline-blocks, which breaks inline wrapping
    <span
      role="button"
      tabIndex={0}
      className={`redacted ${open ? "revealed" : ""}`}
      aria-expanded={open}
      aria-label={`${open ? "Declassified" : "Redacted"} ${kind}: ${children}`}
      title={open ? undefined : `Redacted ${kind}: tap or hover to declassify`}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } else if (e.key === "Escape") setOpen(false); }}
      onBlur={() => setOpen(false)}
      data-testid="redacted"
    >
      <span className="redacted-text">{children}</span>
    </span>
  );
}
