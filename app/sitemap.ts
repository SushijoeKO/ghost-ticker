import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { CATEGORIES } from "@/lib/sources";
import { getWire } from "@/lib/feeds";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const wire = await getWire().catch(() => null);
  const stories = (wire?.clusters ?? []).filter((cluster) => !cluster.satire).slice(0, 300);
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "always", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE.url}/c/${c.slug}`, lastModified: now, changeFrequency: "always" as const, priority: 0.8 })),
    { url: `${SITE.url}/map`, lastModified: now, changeFrequency: "always", priority: 0.6 },
    { url: `${SITE.url}/trending`, lastModified: now, changeFrequency: "always", priority: 0.5 },
    ...stories.map((cluster) => ({ url: `${SITE.url}/story/${cluster.id}`, lastModified: new Date(cluster.lead.ts || now), changeFrequency: "hourly" as const, priority: 0.6 })),
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
