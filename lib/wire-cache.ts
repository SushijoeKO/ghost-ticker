import { gunzipSync, gzipSync } from "node:zlib";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { loadWire, type Wire } from "./feeds.ts";

// The full wire is about 6 MB, over the data-cache limit, so the shared entry is gzipped.
const loadWirePacked = unstable_cache(
  async () => gzipSync(JSON.stringify(await loadWire())).toString("base64"),
  ["gt-wire-v6"],
  { revalidate: 300 },
);

/** One clustered sweep, reused for about five minutes. Story pages read this instead of refetching every feed. */
export const getWire = cache(async (): Promise<Wire> => {
  const packed = await loadWirePacked();
  return JSON.parse(gunzipSync(Buffer.from(packed, "base64")).toString()) as Wire;
});

export const getWireWithImages = cache(async () => {
  const wire = await getWire();
  const { enrichImages } = await import("./images.ts");
  await enrichImages(wire.clusters, wire.fetchedAt).catch(() => {});
  return wire;
});
