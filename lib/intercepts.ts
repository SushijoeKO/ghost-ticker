// Pure parsing for the Wire Intercepts panel. No network and no secrets.

export const INTERCEPT_ACCOUNTS = [
  { handle: "BBCBreaking", label: "BBC Breaking", href: "https://x.com/BBCBreaking" },
  { handle: "cnnbrk", label: "CNN Breaking", href: "https://x.com/cnnbrk" },
  { handle: "NPR", label: "NPR", href: "https://x.com/NPR" },
  { handle: "Reuters", label: "Reuters", href: "https://x.com/Reuters" },
  { handle: "rawsalerts", label: "Raw Alerts", href: "https://x.com/rawsalerts" },
  { handle: "Breaking911", label: "Breaking911", href: "https://x.com/Breaking911" },
  { handle: "DailyCaller", label: "Daily Caller", href: "https://x.com/DailyCaller" },
  { handle: "TheInsiderPaper", label: "Insider Paper", href: "https://x.com/TheInsiderPaper" },
  { handle: "Polymarket", label: "Polymarket", href: "https://x.com/Polymarket" },
  { handle: "Kalshi", label: "Kalshi", href: "https://x.com/Kalshi" },
  { handle: "ExxAlerts", label: "Exx Alerts", href: "https://x.com/ExxAlerts" },
] as const;

export const INTERCEPT_QUERY = INTERCEPT_ACCOUNTS.map((account) => `from:${account.handle}`).join(" OR ");
export const INTERCEPT_PAGE_LIMIT = 2;
export const INTERCEPT_POST_LIMIT = 40;
const TEXT_LIMIT = 280;

export type InterceptHandle = (typeof INTERCEPT_ACCOUNTS)[number]["handle"];
export type InterceptFilter = "all" | InterceptHandle;

export type InterceptPost = {
  id: string;
  url: string;
  text: string;
  createdAt: number;
  handle: string;
  name: string;
};

export type TextPart = { kind: "text" | "link"; value: string };

export function isInterceptHandle(value: string): value is InterceptHandle {
  return INTERCEPT_ACCOUNTS.some((account) => account.handle === value);
}

export function isInterceptFilter(value: string): value is InterceptFilter {
  return value === "all" || isInterceptHandle(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function capText(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= TEXT_LIMIT) return flat;
  return `${flat.slice(0, TEXT_LIMIT - 1).trimEnd()}…`;
}

function statusUrl(handle: string, id: string, given: unknown): string {
  if (typeof given === "string" && /^https:\/\/(x|twitter)\.com\//i.test(given)) return given;
  return `https://x.com/${encodeURIComponent(handle)}/status/${encodeURIComponent(id)}`;
}

function parseOne(value: unknown): InterceptPost | null {
  const tweet = asRecord(value);
  if (!tweet) return null;
  const id = typeof tweet.id === "string" || typeof tweet.id === "number" ? String(tweet.id).trim() : "";
  const text = typeof tweet.text === "string" ? capText(tweet.text) : "";
  const author = asRecord(tweet.author);
  const handle = typeof author?.userName === "string" ? author.userName.trim() : "";
  const name = typeof author?.name === "string" && author.name.trim() ? author.name.trim() : handle;
  const createdAt = typeof tweet.createdAt === "string" ? Date.parse(tweet.createdAt) : NaN;
  if (!id || !text || !handle || !Number.isFinite(createdAt)) return null;
  return { id, url: statusUrl(handle, id, tweet.url), text, createdAt, handle, name };
}

export function hasTweetList(payload: unknown): boolean {
  const body = asRecord(payload);
  return !!body && Array.isArray(body.tweets);
}

export function parseTweets(payload: unknown): InterceptPost[] {
  const body = asRecord(payload);
  const tweets = body && Array.isArray(body.tweets) ? body.tweets : [];
  const posts: InterceptPost[] = [];
  for (const tweet of tweets) {
    const post = parseOne(tweet);
    if (post) posts.push(post);
  }
  return posts;
}

export function nextCursor(payload: unknown): string | null {
  const body = asRecord(payload);
  if (!body || body.has_next_page !== true) return null;
  if (typeof body.next_cursor !== "string" || !body.next_cursor.trim()) return null;
  return body.next_cursor;
}

export function mergePosts(pages: InterceptPost[][]): InterceptPost[] {
  const sorted = pages.flat().sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const out: InterceptPost[] = [];
  for (const post of sorted) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    out.push(post);
    if (out.length >= INTERCEPT_POST_LIMIT) break;
  }
  return out;
}

export function filterPosts(posts: InterceptPost[], account: InterceptFilter): InterceptPost[] {
  if (account === "all") return posts;
  const want = account.toLowerCase();
  return posts.filter((post) => post.handle.toLowerCase() === want);
}

const HTTPS_URL = /https:\/\/[^\s]+/g;

export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(HTTPS_URL)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    let url = match[0];
    let trailing = "";
    while (/[),.;:!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    if (url) parts.push({ kind: "link", value: url });
    if (trailing) parts.push({ kind: "text", value: trailing });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  if (!parts.length) parts.push({ kind: "text", value: text });
  return parts;
}
