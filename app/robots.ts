import type { MetadataRoute } from "next";
import { LAUNCHED, SITE } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  if (!LAUNCHED) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return { rules: [{ userAgent: "*", allow: "/" }], sitemap: `${SITE.url}/sitemap.xml` };
}
