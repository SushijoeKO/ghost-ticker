import { XMLParser } from "fast-xml-parser";
import { clean, text } from "./feeds";
import { tagFor } from "./tags.ts";

// Public YouTube channel RSS feeds of news outlets (channel ids verified Nov 8, 2026).
export const VIDEO_CHANNELS = [
  { id: "UCXIJgqnII2ZOINSWNOGFThA", name: "Fox News", lean: "Right" },
  { id: "UCx6h-dWzJ5NpAlja1YsApdg", name: "Newsmax", lean: "Right" },
  { id: "UCrvhNP_lWuPIP6QZzJmM-bw", name: "New York Post", lean: "Lean Right" },
  { id: "UCupvZG-5ko_eiXAupbDfxWw", name: "CNN", lean: "Left" },
  { id: "UCaXkIU1QidjPwiAYu6GcHjg", name: "MS NOW", lean: "Left" },
  { id: "UCeY0bbntWzzVIaj2z3QigXg", name: "NBC News", lean: "Lean Left" },
  { id: "UCBi2mrWuNuyYy4gbM6fU18Q", name: "ABC News", lean: "Lean Left" },
  { id: "UC52X5wxOL_s5yw0dQk7NtgA", name: "Associated Press", lean: "Center" },
  { id: "UChqUTb7kYRX8-EiaN3XFrSQ", name: "Reuters", lean: "Center" },
  { id: "UCCjG8NtOig0USdrT5D1FpxQ", name: "NewsNation", lean: "Center" },
  { id: "UCPWXiRWZ29zrxPFIQT7eHSA", name: "The Hill", lean: "Center" },
  { id: "UC16niRr50-MSBwiO3YDb3RA", name: "BBC News", lean: "Intl" },
  { id: "UCoMdktPbSTixAyNGwb-UYkQ", name: "Sky News", lean: "Intl" },
  { id: "UCNye-wNBqNL5ZzHSJj3l8Bg", name: "Al Jazeera English", lean: "Intl" },
  { id: "UCknLrEdhRCp1aegoMqRaCZg", name: "DW News", lean: "Intl" },
];

export interface Video { id: string; title: string; channel: string; lean: string; ts: number; thumb: string; sensitive: boolean }

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text", htmlEntities: true });

async function fetchChannel(ch: (typeof VIDEO_CHANNELS)[number]): Promise<Video[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const doc = parser.parse(await res.text());
    let entries = doc?.feed?.entry ?? [];
    if (!Array.isArray(entries)) entries = [entries];
    const out: Video[] = [];
    for (const e of entries.slice(0, 6)) {
      const id = text(e["yt:videoId"]);
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
      const title = clean(text(e.title)).slice(0, 160);
      if (/#shorts\b/i.test(title)) continue;
      const ts = Date.parse(text(e.published)) || 0;
      const tag = tagFor({ title, category: "top", breaking: false });
      out.push({ id, title, channel: ch.name, lean: ch.lean, ts, thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, sensitive: tag?.name === "PRIORITY" });
    }
    return out;
  } catch {
    return [];
  }
}

/** Newest videos across channels, at most two per channel. */
export async function getVideos(n = 12): Promise<Video[]> {
  const all = (await Promise.all(VIDEO_CHANNELS.map(fetchChannel))).flat().sort((a, b) => b.ts - a.ts);
  const per = new Map<string, number>();
  const out: Video[] = [];
  for (const v of all) {
    if ((per.get(v.channel) ?? 0) >= 2) continue;
    per.set(v.channel, (per.get(v.channel) ?? 0) + 1);
    out.push(v);
    if (out.length >= n) break;
  }
  return out;
}
