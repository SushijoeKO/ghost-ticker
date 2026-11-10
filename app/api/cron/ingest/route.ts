import { NextResponse } from "next/server";
import { getWireWithImages } from "@/lib/wire-cache";
import { ingest } from "@/lib/db";

// Vercel: vercel.json crons, daily at 12:00 UTC ("0 12 * * *").
// Cloudflare: wrangler.jsonc triggers.crons, same schedule. The Worker scheduled() handler calls this route with CRON_SECRET.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Same sweep the home page runs: fetch the wire, then archive every cluster. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || !authorized(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const w = await getWireWithImages();
  const archived = await ingest(w.clusters).catch(() => null);
  const ok = w.feeds.filter((f) => f.ok).length;
  return NextResponse.json({ ok: true, feeds: w.feeds.length, feedsOk: ok, clusters: w.clusters.length, archived });
}
