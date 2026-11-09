"use client";
import { useEffect, useState } from "react";

const VOTER_KEY = "gt-voter";
const VOTED_KEY = "gt-voted";

export function voterId(): string {
  let v = "";
  try { v = localStorage.getItem(VOTER_KEY) ?? ""; } catch {}
  if (!/^[0-9a-f-]{36}$/.test(v)) {
    v = crypto.randomUUID();
    try { localStorage.setItem(VOTER_KEY, v); } catch {}
  }
  return v;
}
function votedSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(VOTED_KEY) ?? "[]")); } catch { return new Set(); }
}
function remember(id: string, on: boolean) {
  const s = votedSet();
  if (on) s.add(id); else s.delete(id);
  try { localStorage.setItem(VOTED_KEY, JSON.stringify([...s].slice(-500))); } catch {}
}

// Live counts: pages are cached for a minute or more, so every button asks the site (one batched,
// same-origin request) for current totals after it mounts, and buttons for the same story stay in sync.
const subs = new Map<string, Set<(n: number) => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
function publish(id: string, n: number) { subs.get(id)?.forEach((f) => f(n)); }
function subscribe(id: string, f: (n: number) => void) {
  if (!subs.has(id)) subs.set(id, new Set());
  subs.get(id)!.add(f);
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 60);
  return () => { subs.get(id)?.delete(f); };
}
async function flush() {
  timer = null;
  const ids = [...queue];
  queue = new Set();
  for (let i = 0; i < ids.length; i += 250) {
    const chunk = ids.slice(i, i + 250);
    try {
      const r = await fetch(`/api/vote?ids=${chunk.join(",")}`, { cache: "no-store" });
      if (!r.ok) continue;
      const { counts } = (await r.json()) as { counts: Record<string, number> };
      for (const id of chunk) if (id in counts) publish(id, counts[id]);
    } catch {}
  }
}

export default function VoteButton({ id, initial = 0, title, link }: { id: string; initial?: number; title: string; link?: string }) {
  const [count, setCount] = useState(initial);
  const [voted, setVoted] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setVoted(votedSet().has(id));
    return subscribe(id, (n) => setCount((c) => (busy ? c : n)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function vote() {
    if (voted || busy) return;
    const before = count;
    setBusy(true);
    setMsg("");
    setVoted(true);
    setCount(before + 1); // optimistic
    try {
      const res = await fetch("/api/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, voter: voterId(), link }) });
      const j = await res.json().catch(() => ({}));
      if (j.ok) {
        const n = typeof j.votes === "number" ? j.votes : before + 1;
        setCount(n);
        publish(id, n);
        remember(id, true);
        if (j.already) setMsg("Already logged");
      } else {
        setVoted(false);
        setCount(typeof j.votes === "number" ? j.votes : before);
        setMsg(j.error === "rate_limited" ? "Slow down, agent" : j.error === "unknown_item" ? "Story expired, refresh" : "Signal lost");
      }
    } catch {
      setVoted(false);
      setCount(before);
      setMsg("Signal lost");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span className="inline-flex items-center gap-1 normal-case">
      <button type="button" onClick={vote} disabled={busy} aria-pressed={voted} aria-label={`${voted ? "Upvoted" : "Upvote"}: ${title}`}
        className={`vote-btn inline-flex items-center justify-center rounded-sm border px-1.5 font-mono text-[11px] ${voted ? "border-emerald-400 bg-emerald-400/15 text-emerald-200" : "border-zinc-600 text-zinc-300 hover:border-emerald-400 hover:text-emerald-200"}`} data-testid="vote" data-id={id}>
        ▲ <span data-testid="vote-count">{count}</span>
      </button>
      {msg && <span role="status" className="text-[10px] text-amber-300" data-testid="vote-msg">{msg}</span>}
    </span>
  );
}
