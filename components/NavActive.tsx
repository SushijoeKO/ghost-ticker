"use client";
import { useEffect } from "react";

/** Keeps the active channel visible in the horizontally scrolling nav on small screens. */
export default function NavActive() {
  useEffect(() => {
    const ul = document.querySelector<HTMLElement>("[data-testid=nav-list]");
    const a = ul?.querySelector<HTMLElement>(".nav-active");
    if (!ul || !a) return;
    const left = a.offsetLeft - (ul.clientWidth - a.offsetWidth) / 2;
    ul.scrollLeft = Math.max(0, left);
  }, []);
  return null;
}
