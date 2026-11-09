import raw from "../pinned-posts.json";

const RE = /^https:\/\/(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{5,25}\/?$/;
export function pinnedPosts(): { url: string; note?: string }[] {
  const posts = Array.isArray((raw as any).posts) ? (raw as any).posts : [];
  return posts
    .map((p: any) => (typeof p === "string" ? { url: p } : p))
    .filter((p: any) => p && typeof p.url === "string" && RE.test(p.url.trim()))
    .map((p: any) => ({ url: p.url.trim(), note: typeof p.note === "string" ? p.note.slice(0, 80) : undefined }))
    .slice(0, 6);
}
