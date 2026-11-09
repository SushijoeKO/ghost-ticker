"use client";
import { useEffect, useRef, useState } from "react";

// One shared tooltip for every clearance badge (a.clr[data-tip]). Hover or keyboard focus shows it;
// on touch the first tap shows it and a second tap (or the "legend" link) opens /about#clearance.
// Fixed-position so it is never clipped by cards; the badge's own sr-only text carries the same meaning.
type Tip = { el: HTMLElement; text: string; count: string; level: string; x: number; y: number; below: boolean; touch: boolean };

export default function ClearanceTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const cur = useRef<Tip | null>(null);
  const hideT = useRef<number | undefined>(undefined);
  const lastPointer = useRef<string>("mouse");
  const lastDown = useRef(0);

  useEffect(() => {
    const badge = (t: EventTarget | null) => (t instanceof Element ? (t.closest("a.clr[data-tip]") as HTMLElement | null) : null);
    const set = (t: Tip | null) => {
      cur.current?.el.classList.remove("clr-open");
      cur.current = t; setTip(t);
      t?.el.classList.add("clr-open");
    };
    const show = (el: HTMLElement, touch = false) => {
      window.clearTimeout(hideT.current);
      const r = el.getBoundingClientRect();
      const below = r.top < 72;
      set({ el, text: el.dataset.tip ?? "", count: el.dataset.count ?? "", level: el.dataset.level ?? "1", x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below, touch });
    };
    const hideSoon = () => { window.clearTimeout(hideT.current); hideT.current = window.setTimeout(() => set(null), 160); };
    const inTip = (n: EventTarget | null) => !!(n instanceof Node && ref.current?.contains(n));

    const onOver = (e: PointerEvent) => { if (e.pointerType === "touch") return; const b = badge(e.target); if (b) show(b); else if (inTip(e.target)) window.clearTimeout(hideT.current); };
    const onOut = (e: PointerEvent) => { if (e.pointerType === "touch") return; if ((badge(e.target) || inTip(e.target)) && !badge(e.relatedTarget) && !inTip(e.relatedTarget)) hideSoon(); };
    const onDown = (e: PointerEvent) => { lastPointer.current = e.pointerType; lastDown.current = performance.now(); };
    // focus that comes from a tap is handled by the click (first tap = show), so it must not pre-open the tip
    const onFocusIn = (e: FocusEvent) => { const b = badge(e.target); if (b && !(lastPointer.current === "touch" && performance.now() - lastDown.current < 1000)) show(b); };
    const onFocusOut = (e: FocusEvent) => { if (badge(e.target) && !badge(e.relatedTarget) && !inTip(e.relatedTarget) && lastPointer.current !== "touch") hideSoon(); };
    const onClick = (e: MouseEvent) => {
      const b = badge(e.target);
      if (b && lastPointer.current === "touch" && cur.current?.el !== b) { e.preventDefault(); show(b, true); return; }
      if (!b && !inTip(e.target) && cur.current) set(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && cur.current) set(null); };
    const onScroll = () => { if (cur.current) set(null); };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // clamp horizontally once the tip has a width
  useEffect(() => {
    const n = ref.current;
    if (!n || !tip) return;
    const w = n.offsetWidth;
    const left = Math.min(Math.max(8, tip.x - w / 2), window.innerWidth - w - 8);
    n.style.left = `${left}px`;
    n.style.top = tip.below ? `${tip.y}px` : `${tip.y - n.offsetHeight}px`;
    n.style.visibility = "visible";
  }, [tip]);

  if (!tip) return null;
  return (
    <div ref={ref} role="tooltip" id="gt-clr-tip" aria-hidden="true" className={`clr-tip clr-tip-l${tip.level}`} data-testid="clearance-tip" style={{ visibility: "hidden", left: 0, top: 0 }}>
      <span className="block font-bold">{tip.text}</span>
      <span className="block text-zinc-400">{tip.count}{tip.touch ? " · tap the badge again to open the legend" : ""}</span>
      <a href="/about#clearance" tabIndex={-1} className="mt-1 inline-block text-emerald-300 underline underline-offset-2" data-testid="clearance-tip-link">Clearance levels legend →</a>
    </div>
  );
}
