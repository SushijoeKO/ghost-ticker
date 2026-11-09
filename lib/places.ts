// Headline geolocation against a built-in Natural Earth gazetteer.
// Pure module (no imports) so it can be unit-tested with plain Node.

export interface GazEntry { n: string; a: string[]; x: number; y: number; l: number; c: string | null; amb: boolean; ctx: string[]; ctxOnly?: boolean }
export interface Place { id: string; name: string; x: number; y: number; level: number; country: string | null }

const PREP = /(?:^|[^A-Za-z])(in|from|to|across|near|into|inside|outside|throughout|at)\s+(?:the\s+)?$/i;
// Media / brand names that contain a place but are not about it.
const BRAND_AFTER = /^\s+(Times|Post|Journal|Examiner|Tribune|Herald|Daily|Magazine|Free Beacon|Mail|Star|Sun|Globe|Gazette|Inquirer|Chronicle|Observer|Review|Today|Independent|Standard|Telegraph)\b/;

export function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[’‘]/g, "'");
}
function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

interface Pat { re: RegExp; entry: GazEntry; isAlias: boolean; len: number }

export function makeLocator(gaz: GazEntry[]) {
  const pats: Pat[] = [];
  for (const e of gaz) {
    const names = [{ s: e.n, alias: false }, ...e.a.map((s) => ({ s, alias: true }))];
    for (const { s, alias } of names) {
      const n = norm(s);
      if (n.length < 3) continue;
      pats.push({ re: new RegExp(`(?<![A-Za-z])${esc(n)}(?![A-Za-z])`, "g"), entry: e, isAlias: alias, len: n.length });
    }
  }
  pats.sort((a, b) => b.len - a.len); // longest names first; matched spans are masked

  function scan(text: string): { e: GazEntry; pos: number }[] {
    const orig = norm(text);
    let t = orig;
    const hits: { e: GazEntry; pos: number }[] = [];
    for (const p of pats) {
      p.re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = p.re.exec(t))) {
        const start = m.index, end = start + m[0].length;
        const after = t.slice(end, end + 24);
        if (BRAND_AFTER.test(after)) continue;
        const e = p.entry;
        if (e.amb && !p.isAlias) {
          const hasCtx = e.ctx.some((c) => orig.includes(norm(c)));
          const hasPrep = PREP.test(orig.slice(Math.max(0, start - 20), start));
          if (e.ctxOnly ? !hasCtx : !(hasCtx || hasPrep)) continue;
        }
        hits.push({ e, pos: start });
        t = t.slice(0, start) + " ".repeat(end - start) + t.slice(end); // mask
        p.re.lastIndex = end;
      }
    }
    return hits;
  }

  function best(hits: { e: GazEntry; pos: number }[]): Place | null {
    if (!hits.length) return null;
    hits.sort((a, b) => b.e.l - a.e.l || a.pos - b.pos);
    const e = hits[0].e;
    return { id: e.n, name: e.n, x: e.x, y: e.y, level: e.l, country: e.c };
  }

  /** Most specific place in the title; falls back to the snippet only if the title names none. */
  return function locate(title: string, snippet = ""): Place | null {
    return best(scan(title)) ?? (snippet ? best(scan(snippet)) : null);
  };
}
