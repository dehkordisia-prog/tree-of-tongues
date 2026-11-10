// Search over typed documents (spec 7.1): diacritic- and case-insensitive, prefix and fuzzy (edit
// distance 1 from 5 characters), exact codes. Ranking: exact name, exact code, exact other name or alias (provisional: an exact alias beats a prefix, so "Farsi" finds Iranian Persian before Farsic), prefix, alias prefix, fuzzy;
// then in-scope first. No dependency: a linear scan over about 27,000 short documents runs in a few
// milliseconds, and the result shape stays the same if the pipeline later ships a MiniSearch index.

export type DocKind = "language" | "dialect" | "family" | "macrolanguage" | "country";

export interface SearchName {
  text: string;
  lang?: string | null;
  /** alias: matched, shown only as "Alias: ..." (D-004). */
  type: "name" | "endonym" | "alias" | "other";
}

export interface SearchDoc {
  id: string;
  kind: DocKind;
  /** The label the atlas shows. */
  name: string;
  names: SearchName[];
  iso?: string | null;
  qid?: string | null;
  /** Short family path: top family and parent. */
  path?: string | null;
  /** Top-level family and parent glottocodes; the path is built from them when `path` is absent. */
  familyId?: string | null;
  parentId?: string | null;
  endonym?: { text: string; lang: string | null } | null;
  inScope: boolean;
  drawn: boolean;
}

export type MatchReason =
  | { kind: "name" }
  | { kind: "alias"; text: string }
  | { kind: "iso"; code: string }
  | { kind: "glottocode"; code: string }
  | { kind: "otherName"; text: string };

export interface Hit {
  doc: SearchDoc;
  score: number;
  reason: MatchReason;
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/ı/g, "i").trim();
}

const LATIN = /^[\p{Script=Latin}\p{N}\s\p{P}]*$/u;

export function queryIsLongEnough(q: string): boolean {
  const t = q.trim();
  if (!t) return false;
  return LATIN.test(t) ? t.length >= 2 : t.length >= 1;
}

/** True when a and b differ by at most one insertion, deletion or substitution. */
export function withinOne(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (la > lb) i++;
    else if (lb > la) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

interface Prepared {
  doc: SearchDoc;
  name: string;
  others: { n: string; text: string; alias: boolean }[];
}

export class SearchEngine {
  private docs: Prepared[] = [];
  private ids = new Set<string>();

  private names = new Map<string, string>();

  /** Display name of any document by id (for family paths). */
  nameOf(id: string | null | undefined): string | null {
    return id ? (this.names.get(id) ?? null) : null;
  }

  pathOf(d: SearchDoc): string | null {
    if (d.path) return d.path;
    const top = d.familyId && d.familyId !== d.id ? this.nameOf(d.familyId) : null;
    const parent = d.parentId && d.parentId !== d.familyId ? this.nameOf(d.parentId) : null;
    return [top, parent].filter(Boolean).join(" / ") || null;
  }

  get size(): number {
    return this.docs.length;
  }

  add(docs: readonly SearchDoc[]): void {
    for (const doc of docs) {
      const key = `${doc.kind === "dialect" ? "language" : doc.kind}:${doc.id}`;
      if (this.ids.has(key)) continue;
      this.ids.add(key);
      if (doc.kind !== "macrolanguage") this.names.set(doc.id, doc.name);
      this.docs.push({
        doc,
        name: normalize(doc.name),
        others: doc.names
          .map((n) => ({ n: normalize(n.text), text: n.text, alias: n.type === "alias" }))
          .filter((o) => o.n),
      });
    }
  }

  search(query: string, limit = 400): Hit[] {
    const q = normalize(query);
    if (!queryIsLongEnough(query)) return [];
    const fuzzy = q.length >= 5;
    const hits: Hit[] = [];
    for (const p of this.docs) {
      const d = p.doc;
      let best: Hit | null = null;
      const consider = (score: number, reason: MatchReason) => {
        if (!best || score > best.score) best = { doc: d, score, reason };
      };
      if (p.name === q) consider(100, { kind: "name" });
      if (d.id === q && /^[a-z0-9]{4}\d{4}$/.test(q)) consider(95, { kind: "glottocode", code: d.id });
      if (d.iso && d.iso === q) consider(95, { kind: "iso", code: d.iso });
      if (d.qid && d.qid.toLowerCase() === q) consider(94, { kind: "otherName", text: d.qid });
      if (p.name.startsWith(q)) consider(80 - Math.min(10, p.name.length - q.length) / 10, { kind: "name" });
      else if (p.name.includes(` ${q}`)) consider(72, { kind: "name" });
      for (const o of p.others) {
        if (o.n === p.name) continue;
        if (o.n === q)
          consider(
            o.alias ? 85 : 86,
            o.alias ? { kind: "alias", text: o.text } : { kind: "otherName", text: o.text },
          );
        else if (o.n.startsWith(q))
          consider(
            o.alias ? 62 : 66,
            o.alias ? { kind: "alias", text: o.text } : { kind: "otherName", text: o.text },
          );
      }
      if (!best && fuzzy) {
        if (withinOne(p.name, q) || withinOne(p.name.slice(0, q.length), q)) consider(40, { kind: "name" });
        else
          for (const o of p.others) {
            if (withinOne(o.n, q)) {
              consider(36, o.alias ? { kind: "alias", text: o.text } : { kind: "otherName", text: o.text });
              break;
            }
          }
      }
      if (best) {
        const b = best as Hit;
        b.score += d.inScope ? 5 : 0;
        hits.push(b);
      }
    }
    hits.sort((a, b) => b.score - a.score || a.doc.name.localeCompare(b.doc.name, "en"));
    return hits.slice(0, limit);
  }
}

export const GROUP_ORDER: readonly DocKind[] = ["language", "macrolanguage", "family", "country", "dialect"];

export function groupHits(hits: readonly Hit[]): { kind: DocKind; hits: Hit[] }[] {
  return GROUP_ORDER.map((kind) => ({ kind, hits: hits.filter((h) => h.doc.kind === kind) })).filter(
    (g) => g.hits.length,
  );
}
