import { ADS } from "@/lib/config";

// Reserved, in-flow ad space. It never overlays or covers content.
// With ADS_ENABLED=false nothing is requested from any ad network.
const SIZES = {
  header: "min-h-[90px]",
  sidebar: "min-h-[250px]",
  infeed: "min-h-[100px]",
} as const;

export default function AdSlot({ kind }: { kind: keyof typeof SIZES }) {
  const slot = ADS.SLOTS[kind];
  if (ADS.ADS_ENABLED && slot) {
    return (
      <div className={`ad-slot ${SIZES[kind]}`} data-ad-kind={kind}>
        <ins
          className="adsbygoogle block"
          data-ad-client={ADS.PUB_ID}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          {...(ADS.TEST_MODE ? { "data-adtest": "on" } : {})}
        />
      </div>
    );
  }
  if (!ADS.TEST_MODE) return null;
  return (
    <div
      className={`ad-slot ad-placeholder ${SIZES[kind]} flex items-center justify-center rounded border border-dashed border-zinc-700/80 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-600`}
      data-ad-kind={kind}
      data-testid={`ad-${kind}`}
    >
      Reserved · {kind} ad slot · inactive
    </div>
  );
}
