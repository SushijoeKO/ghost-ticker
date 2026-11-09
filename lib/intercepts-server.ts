// Server-only. TWITTERAPI_IO_KEY is read here and never returned or logged.
import { cache } from "react";
import { hasTweetList, INTERCEPT_PAGE_LIMIT, INTERCEPT_QUERY, mergePosts, nextCursor, parseTweets, type InterceptPost } from "./intercepts";

const UPSTREAM = "https://api.twitterapi.io/twitter/tweet/advanced_search";
const REVALIDATE_SECONDS = 900;
const TIMEOUT_MS = 5000;
const COOLDOWN_MS = 900_000;

let lastGood: InterceptPost[] = [];
let cooldownUntil = 0;

function loopbackBase(): string | null {
  const raw = process.env.TWITTERAPI_IO_BASE?.trim().replace(/\/$/, "");
  if (!raw) return null;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(raw)) return null;
  return raw;
}

function upstreamUrl(cursor?: string): string {
  const base = loopbackBase();
  const url = new URL(base ? `${base}/twitter/tweet/advanced_search` : UPSTREAM);
  url.searchParams.set("queryType", "Latest");
  url.searchParams.set("query", INTERCEPT_QUERY);
  if (cursor) url.searchParams.set("cursor", cursor);
  return url.toString();
}

async function fetchPage(key: string, cursor: string | undefined, signal: AbortSignal): Promise<unknown | null> {
  const res = await fetch(upstreamUrl(cursor), {
    headers: { "X-API-Key": key },
    signal,
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function loadIntercepts(key: string): Promise<InterceptPost[] | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let first: unknown | null;
  try {
    first = await fetchPage(key, undefined, signal);
  } catch {
    return null;
  }
  if (!first || !hasTweetList(first)) return null;
  const pages = [parseTweets(first)];
  let cursor = nextCursor(first);
  for (let page = 1; page < INTERCEPT_PAGE_LIMIT && cursor && !signal.aborted; page += 1) {
    try {
      const next = await fetchPage(key, cursor, signal);
      if (!next) break;
      pages.push(parseTweets(next));
      cursor = nextCursor(next);
    } catch {
      break;
    }
  }
  return mergePosts(pages);
}

export const getIntercepts = cache(async (): Promise<InterceptPost[]> => {
  const key = process.env.TWITTERAPI_IO_KEY?.trim();
  if (!key) return lastGood;
  if (Date.now() < cooldownUntil) return lastGood;
  try {
    const posts = await loadIntercepts(key);
    if (!posts) {
      cooldownUntil = Date.now() + COOLDOWN_MS;
      return lastGood;
    }
    lastGood = posts;
    return posts;
  } catch {
    cooldownUntil = Date.now() + COOLDOWN_MS;
    return lastGood;
  }
});
