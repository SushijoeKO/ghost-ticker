import { NextResponse } from "next/server";
import { getWire } from "@/lib/wire-cache";

export const revalidate = 60;

export async function GET() {
  const w = await getWire();
  const recent = w.clusters.filter((c) => c.lead.ts && w.fetchedAt - c.lead.ts < 12 * 3600e3).slice(0, 150);
  return NextResponse.json({ at: w.fetchedAt, ids: recent.map((c) => c.id), breaking: w.clusters.filter((c) => c.breaking).map((c) => c.id) });
}
