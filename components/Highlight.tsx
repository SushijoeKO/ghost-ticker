import { highlightParts } from "@/lib/query";

export default function Highlight({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlightParts(text, terms).map((part, index) => part.hit
        ? <mark key={index} className="rounded-sm bg-emerald-400/25 px-0.5 text-emerald-50">{part.text}</mark>
        : <span key={index}>{part.text}</span>)}
    </>
  );
}
