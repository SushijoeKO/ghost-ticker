import type { MetadataRoute } from "next";
import { SITE } from "@/lib/config";
import { CATEGORIES } from "@/lib/sources";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "always", priority: 1 },
    ...CATEGORIES.map((c) => ({ url: `${SITE.url}/c/${c.slug}`, lastModified: now, changeFrequency: "always" as const, priority: 0.8 })),
    { url: `${SITE.url}/map`, lastModified: now, changeFrequency: "always", priority: 0.6 },
    { url: `${SITE.url}/trending`, lastModified: now, changeFrequency: "always", priority: 0.5 },
    { url: `${SITE.url}/about`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${SITE.url}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE.url}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
