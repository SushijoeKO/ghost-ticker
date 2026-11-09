// Compact "no visual" stand-in: static/scanline texture, an outlet mark and a small stamp.
// It always fills its parent frame (which has a fixed aspect ratio), so swapping it in never shifts layout.
export function initials(name: string) {
  const w = name.replace(/^the\s+/i, "").split(/[\s\-.&]+/).filter(Boolean);
  return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] ?? "GT").slice(0, 2)).toUpperCase();
}
export default function Placeholder({ source, size = "sm" }: { source: string; size?: "sm" | "lg" }) {
  return (
    <div className={`gt-ph gt-ph-${size}`} role="img" aria-label={`No photo available from ${source}`} data-testid="thumb-placeholder">
      <span className="gt-ph-mark" aria-hidden="true">{initials(source)}</span>
      {size === "lg" && <span className="gt-ph-stamp" aria-hidden="true">NO VISUAL</span>}
    </div>
  );
}
