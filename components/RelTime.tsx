"use client";
import { useEffect, useState } from "react";

export function rel(ts: number, now: number): string {
  if (!ts) return "time n/a";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function RelTime({ ts, serverNow }: { ts: number; serverNow: number }) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!ts) return <span>time n/a</span>;
  const iso = new Date(ts).toISOString();
  const abs = new Date(ts).toLocaleString("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return (
    <time dateTime={iso} title={abs} suppressHydrationWarning>
      {rel(ts, now)}
    </time>
  );
}
