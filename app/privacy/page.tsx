import type { Metadata } from "next";
import Doc from "@/components/Doc";
import { SITE } from "@/lib/config";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <Doc>
      <h1>Privacy Policy</h1>
      <p>Effective: November 8, 2026. Operator: {SITE.operator}. Contact: <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>.</p>
      <h2>What we collect</h2>
      <ul>
        <li>No accounts, no sign-up, no comments. We do not ask for your name, email or any personal details.</li>
        <li>We use Vercel Web Analytics, which counts anonymized page views without cookies or cross-site identifiers. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">Vercel's privacy policy</a>.</li>
        <li>Your privacy choice, display settings (CRT effect, sound alerts) and the list of stories you upvoted are saved only in your own browser (local storage).</li>
        <li><strong>Upvotes:</strong> the first time you upvote, your browser makes a random anonymous ID (a UUID, not linked to your name, email, IP address or device) and keeps it in local storage. When you vote, that ID and the story ID are stored in our database (hosted by Supabase) so each browser counts once per story and to limit abuse (for example, a few votes per minute). Votes are kept with the story for about 7 days and then deleted. Clearing your browser storage removes the ID from your device.</li>
        <li><strong>Search:</strong> search terms are sent to our server to query the headline archive; we don’t store them in our database.</li>
        <li>Our host, Vercel, processes standard technical data (such as IP address and browser type) in server logs to deliver and secure the site. See Vercel’s privacy policy.</li>
      </ul>
      <h2>Images, videos and posts from other sites</h2>
      <p>Story photos are shown straight from each publisher’s own servers (as listed in their public feeds), and video thumbnails come from YouTube’s image server (i.ytimg.com). Loading them lets those servers see your IP address and browser type; we send them no referrer.</p>
      <p>Thumbnails load directly from the publishers’ servers. Those publishers may set their own cookies or log the request under their own privacy policies. We don’t control that.</p>
      <p>Video players and X (Twitter) posts are <strong>click-to-load</strong>. Nothing is loaded from YouTube’s player or from X until you press “Play” or “Load post”. Videos then play from youtube-nocookie.com (YouTube’s privacy-enhanced mode), and posts load from platform.twitter.com / X. Once loaded, those services may set cookies or similar technologies and collect data under their own policies: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google/YouTube Privacy Policy</a> and <a href="https://x.com/en/privacy" target="_blank" rel="noopener noreferrer">X Privacy Policy</a>. We don’t receive data back from them.</p>
      <p>The home page also includes an optional Wire Intercepts panel of breaking-news posts from X, which stays unloaded until you press “Load live posts from X”, after which <a href="https://x.com/en/privacy" target="_blank" rel="noopener noreferrer">X’s privacy policy</a> applies.</p>
      <h2>Links to other sites</h2>
      <p>Headlines link to outside publishers. When you click one, you leave this site and that publisher’s own privacy policy applies.</p>
      <h2>Advertising</h2>
      <p>
        Ads are currently turned off. If we turn on Google AdSense in the future, Google and its partners may use cookies to serve ads
        based on your visits to this and other sites. You can opt out of personalised advertising at{" "}
        <a href="https://adssettings.google.com" target="_blank" rel="noopener noreferrer">Google Ads Settings</a> and learn more at{" "}
        <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">How Google uses cookies in advertising</a>.
        Visitors in the EEA, UK and Switzerland will be asked for consent first, and you can change your choice any time with “Privacy choices” in the footer.
      </p>
      <h2>Children</h2>
      <p>This site is meant for people aged 13 and older. We do not knowingly collect personal information from children under 13.</p>
      <h2>Your rights</h2>
      <p>Depending on where you live (including California under the CCPA/CPRA and the EEA/UK under the GDPR), you may have rights to access or delete data about you. Because we don’t collect personal data ourselves, there is usually nothing to return, but you can email us with any request.</p>
      <h2>Changes</h2>
      <p>We may update this policy and will change the effective date when we do.</p>
    </Doc>
  );
}
