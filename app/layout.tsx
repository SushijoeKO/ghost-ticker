import type { Metadata, Viewport } from "next";
import "./globals.css";
import Footer from "@/components/Footer";
import ConsentBanner from "@/components/ConsentBanner";
import FxRoot from "@/components/FxRoot";
import ClearanceTip from "@/components/ClearanceTip";
import { ADS, LAUNCHED, SITE } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — Intercepted headlines, declassified`, template: `%s · ${SITE.name}` },
  description: "A spy-console news wire: breaking alerts, politics from left, center and right, and the weirdest stories online, linked straight to the original sources.",
  applicationName: SITE.name,
  robots: LAUNCHED ? { index: true, follow: true } : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  openGraph: { type: "website", siteName: SITE.name, title: SITE.name, description: SITE.tagline, url: SITE.url, images: [{ url: "/og.png", width: 1200, height: 630, alt: "Ghost Ticker" }] },
  twitter: { card: "summary_large_image", title: SITE.name, description: SITE.tagline, images: ["/og.png"] },
  other: { "google-adsense-account": ADS.PUB_ID },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#05070a", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="crt" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem("gt-crt")==="off")document.documentElement.classList.remove("crt")}catch(e){}` }} />
        {ADS.ADS_ENABLED && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADS.PUB_ID}`} crossOrigin="anonymous" />
        )}
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:bg-emerald-500 focus:px-3 focus:py-2 focus:text-black">Skip to headlines</a>
        {children}
        <Footer />
        <ConsentBanner />
        <FxRoot />
        <ClearanceTip />
      </body>
    </html>
  );
}
