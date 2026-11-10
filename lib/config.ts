// ===== Site switches =====
// LAUNCHED=true: pages are indexable and robots.txt allows crawlers.
// Set false to put the site back behind noindex and Disallow: /.
export const LAUNCHED = true;

function siteUrl(): string {
  // Bracket access so the bundler does not bake the value in at build time.
  const key = ["SITE", "URL"].join("_");
  const raw = process.env[key]?.trim();
  if (!raw) return "https://ghost-ticker.vercel.app";
  return raw.replace(/\/$/, "");
}

export const SITE = {
  name: "Ghost Ticker",
  tagline: "Intercepted headlines. Declassified every five minutes.",
  get url() {
    return siteUrl();
  },
  operator: "SushijoeKO",
  contact: "sushijoe6@gmail.com",
  year: 2026,
};

// ===== Ads (OFF) =====
// ADS_ENABLED=false: the AdSense script is never loaded and slots render as
// reserved, in-flow placeholders only. TEST_MODE=true keeps placeholders visible
// and marks any future ad requests as test traffic (data-adtest="on").
export const ADS = {
  ADS_ENABLED: false,
  TEST_MODE: true,
  PUB_ID: "ca-pub-4772936401730421",
  // Fill with real slot ids from AdSense after approval.
  SLOTS: { header: "", sidebar: "", infeed: "" },
};

// Feed refresh window in seconds (ISR). 300 = 5 minutes.
export const REVALIDATE_SECONDS = 300;
