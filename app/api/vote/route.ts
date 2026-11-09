import { NextResponse } from "next/server";
import { ingest, vote, voteCounts } from "@/lib/db";
import { getWire, hash } from "@/lib/feeds";

export const dynamic = "force-dynamic";
const ID = /^[a-z0-9]{4,16}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

function sameSite(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** The page may show a headline the archive hasn't stored yet (cached page vs. a newer sweep).
 *  Look it up in the server's own feed data and archive it, but only if the id really is the
 *  hash of one of that story's links, so clients can't inject arbitrary rows. */
async function archiveFromWire(id: string, link: string | null): Promise<boolean> {
  const w = await getWire();
  const c = w.clusters.find((x) => x.id === id) ?? (link ? w.clusters.find((x) => x.links.includes(link)) : undefined);
  if (!c || !c.links.some((l) => hash(l) === id)) return false;
  return (await ingest([c], id)) === 1;
}

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter((i) => ID.test(i)).slice(0, 300);
  return NextResponse.json({ counts: ids.length ? await voteCounts(ids, null) : {} }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  if (!sameSite(req)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403, headers: NO_STORE });
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE }); }
  const id = String(body?.id ?? ""), voter = String(body?.voter ?? "").toLowerCase();
  const link = typeof body?.link === "string" && /^https?:\/\//.test(body.link) && body.link.length <= 1000 ? body.link : null;
  if (!ID.test(id) || !UUID.test(voter)) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400, headers: NO_STORE });
  let r = await vote(id, voter);
  if (r && !r.ok && r.error === "unknown_item" && (await archiveFromWire(id, link))) r = await vote(id, voter);
  if (!r) {
    console.error("[vote] backend unavailable", { id, env: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY });
    return NextResponse.json({ ok: false, error: "unavailable" }, { status: 503, headers: NO_STORE });
  }
  if (!r.ok) console.warn("[vote] rejected", { id, error: r.error });
  const status = r.ok ? 200 : r.error === "rate_limited" ? 429 : r.error === "unknown_item" ? 404 : 400;
  return NextResponse.json(r, { status, headers: NO_STORE });
}
