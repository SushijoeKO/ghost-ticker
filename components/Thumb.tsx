"use client";
import { useEffect, useRef, useState } from "react";
import Placeholder from "./Placeholder";

/**
 * Fixed-aspect photo frame. The publisher's own image is hotlinked (never rehosted), cropped with
 * object-fit: cover, and swapped for a compact placeholder in the same frame if it fails, so no layout jump.
 */
export default function Thumb({ src, source, title, ratio = "16/9", className = "", eager = false }: { src: string | null; source: string; title: string; ratio?: "16/9" | "4/3" | "1/1"; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(!src);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    if (img.complete) { if (img.naturalWidth === 0) setFailed(true); else setLoaded(true); }
  }, []);
  const big = ratio === "16/9";
  return (
    <div className={`gt-frame ${loaded ? "is-loaded" : ""} ${className}`} style={{ aspectRatio: ratio.replace("/", " / ") }} data-testid="thumb-frame">
      {failed || !src ? (
        <Placeholder source={source} size={big ? "lg" : "sm"} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={ref}
          src={src}
          alt={`Photo from ${source}: ${title}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={(e) => { if ((e.currentTarget as HTMLImageElement).naturalWidth === 0) setFailed(true); else setLoaded(true); }}
          onError={() => setFailed(true)}
          data-testid="thumb"
        />
      )}
    </div>
  );
}
