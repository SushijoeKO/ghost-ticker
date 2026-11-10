"use client";

import { useEffect, useRef } from "react";

/** Header and archive search box. The form is a normal GET, so it works with JavaScript off. */
export default function SearchField({ id, defaultValue = "", placeholder }: { id: string; defaultValue?: string; placeholder?: string }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id !== "header-q") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      document.getElementById("header-q")?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    let timer = 0;
    const onInput = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (input.value.trim() === defaultValue.trim()) return;
        input.form?.requestSubmit();
      }, 350);
    };
    input.addEventListener("input", onInput);
    return () => {
      window.clearTimeout(timer);
      input.removeEventListener("input", onInput);
    };
  }, [defaultValue]);

  return (
    <input
      ref={ref}
      id={id}
      name="q"
      type="search"
      defaultValue={defaultValue}
      maxLength={120}
      placeholder={placeholder ?? "Search the wire"}
      autoComplete="off"
      enterKeyHint="search"
      aria-keyshortcuts="/"
      className="min-w-0 flex-1 rounded border border-zinc-700 bg-black/60 px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400 focus:outline-none"
      data-testid={id === "header-q" ? "header-search" : "search-input"}
    />
  );
}
