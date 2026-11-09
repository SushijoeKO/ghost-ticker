import type { Metadata } from "next";
import Doc from "@/components/Doc";
import { SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Terms of Use", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <Doc>
      <h1>Terms of Use</h1>
      <p>Effective: November 8, 2026. These terms cover your use of {SITE.name}, operated by {SITE.operator} (<a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>).</p>
      <h2>What this site is</h2>
      <p>{SITE.name} is a headline index. It automatically collects headlines from publishers’ public RSS feeds and links to the original stories. We don’t write, edit or verify those stories, and a headline appearing here is not an endorsement.</p>
      <h2>Third-party content</h2>
      <p>Headlines, summaries, names and trademarks belong to their publishers. Links lead to sites we don’t control. Publishers who want their feed removed can email us and we will remove it promptly.</p>
      <h2>Age</h2>
      <p>You must be at least 13 years old to use this site.</p>
      <h2>Acceptable use</h2>
      <p>Don’t scrape, overload, or try to break the site, and don’t use it for anything unlawful.</p>
      <h2>No warranty</h2>
      <p>The site is provided “as is”. Automated labels such as “Flash”, lean ratings and story grouping can be wrong. Headlines may be outdated, inaccurate or changed by the publisher. Don’t rely on this site for emergency information; follow official sources.</p>
      <h2>Limitation of liability</h2>
      <p>To the fullest extent the law allows, {SITE.operator} is not liable for any loss arising from your use of the site or of linked third-party sites.</p>
      <h2>Copyright</h2>
      <p>The {SITE.name} name, design, logo and code are © 2026 SushijoeKO. All rights reserved.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of California, USA, without regard to its conflict-of-law rules.</p>
      <h2>Changes</h2>
      <p>We may update these terms and will change the effective date when we do.</p>
    </Doc>
  );
}
