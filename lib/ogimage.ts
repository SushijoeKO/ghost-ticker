// Server-side image discovery for stories whose feed has no usable photo.
// Reads the article's own <meta property="og:image"> / twitter:image (first ~256 KB of HTML only),
// then checks the image URL really serves an image that other sites may embed. Images are still
// hotlinked from the publisher; nothing is downloaded for rehosting.
// Uses node:http(s) directly (not the framework-patched fetch) so article pages are streamed, cut off at
// </head>, and never written to the data cache; identical lookups running in parallel share one request.
import http from "node:http";
import https from "node:https";
import { SITE } from "./config.ts";
const UA = `GhostTicker/1.0 (headline aggregator; preview image lookup; +${SITE.url}/about)`;
const PAGE_TIMEOUT = 3500;
const IMG_TIMEOUT = 3000;
const MAX_HTML = 256 * 1024;
const TTL = 6 * 3600 * 1000;

type Entry<T> = { v: T; at: number };
const ogCache = new Map<string, Entry<string | null>>(); // article link -> image url | null
const imgCache = new Map<string, Entry<boolean>>(); // image url -> embeddable?
const hostCache = new Map<string, Entry<boolean>>(); // image host -> embeddable?
function get<T>(m: Map<string, Entry<T>>, k: string): T | undefined {
  const e = m.get(k);
  if (!e) return undefined;
  if (Date.now() - e.at > TTL) { m.delete(k); return undefined; }
  return e.v;
}
function put<T>(m: Map<string, Entry<T>>, k: string, v: T) {
  if (m.size > 5000) m.delete(m.keys().next().value as string);
  m.set(k, { v, at: Date.now() });
}

export async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const ENT: Record<string, string> = { amp: "&", quot: '"', "#39": "'", apos: "'", lt: "<", gt: ">", "#x2F": "/", "#47": "/" };
const unent = (s: string) => s.replace(/&(amp|quot|#39|apos|lt|gt|#x2F|#47);/gi, (m, k) => ENT[k] ?? ENT[k.toLowerCase()] ?? m);

export function extractMetaImage(html: string, base: string): string | null {
  const head = html.slice(0, MAX_HTML);
  const keys = ["og:image:secure_url", "og:image:url", "og:image", "twitter:image", "twitter:image:src"];
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of keys) {
    for (const m of metas) {
      const k = m.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
      if (k !== key) continue;
      const c = m.match(/\bcontent\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!c) continue;
      try {
        const u = new URL(unent(c.trim()), base);
        if (u.protocol === "http:") u.protocol = "https:";
        if (u.protocol === "https:" && u.href.length <= 1000) return u.href;
      } catch {}
    }
  }
  return null;
}

type Raw = { status: number; headers: http.IncomingHttpHeaders; body: string; url: string };
/** Minimal GET: follows up to 3 redirects, stops reading at maxBytes or when `stop` matches. */
function rawGet(url: string, headers: Record<string, string>, timeout: number, maxBytes: number, stop?: RegExp, hops = 0): Promise<Raw | null> {
  return new Promise((resolve) => {
    let u: URL;
    try { u = new URL(url); } catch { return resolve(null); }
    if (u.protocol !== "https:" && u.protocol !== "http:") return resolve(null);
    const lib = u.protocol === "https:" ? https : http;
    let done = false;
    const finish = (v: Raw | null) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
    const req = lib.get(u, { headers: { "User-Agent": UA, ...headers } }, (res) => {
      const st = res.statusCode ?? 0;
      if (st >= 300 && st < 400 && res.headers.location && hops < 3) {
        res.resume(); req.destroy();
        let next: string; try { next = new URL(res.headers.location, u).href; } catch { return finish(null); }
        rawGet(next, headers, Math.max(500, deadline - Date.now()), maxBytes, stop, hops + 1).then(finish);
        return;
      }
      let buf = "";
      res.setEncoding("utf8");
      const end = () => { req.destroy(); finish({ status: st, headers: res.headers, body: buf, url: u.href }); };
      res.on("data", (d: string) => { buf += d; if (buf.length >= maxBytes || (stop && stop.test(buf))) end(); });
      res.on("end", end);
      res.on("error", end);
    });
    const deadline = Date.now() + timeout;
    const t = setTimeout(() => { req.destroy(); finish(null); }, timeout);
    req.on("error", () => finish(null));
  });
}

const inflight = new Map<string, Promise<unknown>>();
function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const p = inflight.get(key) as Promise<T> | undefined;
  if (p) return p;
  const q = fn().finally(() => inflight.delete(key));
  inflight.set(key, q);
  return q;
}
const IMG_HEADERS = { Accept: "image/avif,image/webp,image/*,*/*;q=0.5", Range: "bytes=0-2047" };
const hv = (h: http.IncomingHttpHeaders, k: string) => String(h[k] ?? "").toLowerCase();

/** og:image / twitter:image for an article URL (cached). */
export async function ogImage(link: string): Promise<string | null> {
  const hit = get(ogCache, link);
  if (hit !== undefined) return hit;
  return once("og:" + link, async () => {
    const r = await rawGet(link, { Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5" }, PAGE_TIMEOUT, MAX_HTML, /<\/head>/i);
    const img = r && r.status >= 200 && r.status < 300 && /html/.test(hv(r.headers, "content-type")) ? extractMetaImage(r.body, r.url) : null;
    put(ogCache, link, img);
    return img;
  });
}

/** True when the URL answers 200/206 with an image/* type and no same-origin/same-site CORP, without a Referer. */
export async function embeddable(url: string): Promise<boolean> {
  const hit = get(imgCache, url);
  if (hit !== undefined) return hit;
  return once("img:" + url, async () => {
    const r = await rawGet(url, IMG_HEADERS, IMG_TIMEOUT, 2048);
    const corp = r ? hv(r.headers, "cross-origin-resource-policy") : "";
    const ok = !!r && (r.status === 200 || r.status === 206) && /^image\//.test(hv(r.headers, "content-type")) && corp !== "same-origin" && corp !== "same-site";
    put(imgCache, url, ok);
    return ok;
  });
}

/** Host-level hotlink check. Only a definite refusal (CORP same-origin/site, 401/403/451, or a non-image
 *  answer) blocks a host; timeouts and network hiccups during a busy build don't. */
export async function hostEmbeddable(host: string, sample: string): Promise<boolean> {
  const hit = get(hostCache, host);
  if (hit !== undefined) return hit;
  return once("host:" + host, async () => {
    const r = await rawGet(sample, IMG_HEADERS, IMG_TIMEOUT, 2048);
    let ok = true;
    if (r) {
      const corp = hv(r.headers, "cross-origin-resource-policy"), type = hv(r.headers, "content-type");
      if (corp === "same-origin" || corp === "same-site" || [401, 403, 451].includes(r.status) || (r.status >= 200 && r.status < 300 && type && !/^image\//.test(type))) ok = false;
    }
    put(hostCache, host, ok);
    return ok;
  });
}
