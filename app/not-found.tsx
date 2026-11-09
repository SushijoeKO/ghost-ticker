import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = { title: "Signal lost (404)", robots: { index: false, follow: false } };

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-red-400">Error 404 // file not found</p>
        <h1 className="mt-4 font-mono text-4xl font-black uppercase tracking-[0.1em] text-zinc-50">Signal lost</h1>
        <p className="mt-4 text-zinc-400">This dossier was shredded, moved, or never existed.</p>
        <Link href="/" className="btn-solid mt-8 inline-block">Return to base</Link>
      </main>
    </>
  );
}
