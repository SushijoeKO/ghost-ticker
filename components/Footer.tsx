import Link from "next/link";
import { SITE } from "@/lib/config";
import { ConsentLink } from "./ConsentBanner";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-emerald-900/60 bg-black/70">
      <div className="mx-auto max-w-7xl px-4 py-8 font-mono text-xs text-zinc-400">
        <p className="max-w-3xl leading-relaxed">
          Headlines, short snippets and links only. We never copy full articles or rehost images; thumbnails load from each outlet.
        </p>
        <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 uppercase tracking-wider">
          <Link href="/about" className="footer-link hover:text-emerald-300 hover:underline">About &amp; Sources</Link>
          <Link href="/privacy" className="footer-link hover:text-emerald-300 hover:underline">Privacy</Link>
          <Link href="/terms" className="footer-link hover:text-emerald-300 hover:underline">Terms</Link>
          <ConsentLink />
          <a href={`mailto:${SITE.contact}`} className="footer-link hover:text-emerald-300 hover:underline">Contact</a>
        </nav>
        <p className="mt-6 text-zinc-300" data-testid="copyright">© 2026 SushijoeKO. All rights reserved.</p>
      </div>
    </footer>
  );
}
