// Where search documents come from (spec 7.1, two tiers).
//
//   1. The pipeline's search documents, data/build/search/tier1.json and tier2.json (data-curator,
//      in progress). Their shape is not published yet; fromPipeline() accepts the field list of
//      spec 7.1 and anything it cannot read falls through to 2.
//   2. Until then, documents derived from data the app already has: tier 1 from the scope index
//      (scope list plus the scope bundles: names, endonyms, ISO codes) and tier 2 from tree.json
//      (Glottolog names and levels of every languoid). Nothing is typed by hand except the D-004
//      search aliases in src/data/names.ts.

import { SEARCH_ALIASES, labelFor } from "@/data/names";
import type { ScopeIndex } from "@/data/scopeIndex";
import type { TreeCounts } from "@/data/treeCounts";

import type { DocKind, SearchDoc, SearchName } from "./engine";

export const PIPELINE_URLS = { tier1: "/data/search/tier1.json", tier2: "/data/search/tier2.json" } as const;

type Raw = Record<string, unknown>;
const s_ = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Reader for the pipeline's search documents (pipeline/README.md, "search/tier1.json and tier2.json"):
 * {schema, tier, format, licenses, count, documents}. Shows `name`; `glottolog_name` is source data
 * and only matched (as an alias when it carries the D-004 alias). Countries are left out until the
 * country route ships; a macrolanguage candidate is kept only when it links exactly one node.
 */
export function fromPipeline(json: unknown, labels: Record<string, string>): SearchDoc[] | null {
  const list =
    json && typeof json === "object" && Array.isArray((json as Raw).documents)
      ? ((json as Raw).documents as unknown[])
      : null;
  if (!list) return null;
  const out: SearchDoc[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Raw;
    const id = s_(r.id);
    const rawKind = s_(r.kind);
    if (!id || !rawKind || rawKind === "country") continue;
    let kind: DocKind;
    let target = id;
    if (rawKind === "macrolanguage-candidate") {
      const c = arr(r.candidate_glottocodes).filter((x): x is string => typeof x === "string");
      if (c.length !== 1) continue;
      kind = "macrolanguage";
      target = c[0]!;
    } else kind = rawKind === "family" ? "family" : rawKind === "dialect" ? "dialect" : "language";
    const names: SearchName[] = [];
    const nm = (v: unknown) =>
      typeof v === "string" ? v : v && typeof v === "object" ? s_((v as Raw).name) : null;
    for (const v of arr(r.endonyms)) {
      const t = nm(v);
      if (t) names.push({ text: t, type: aliasOnly(t) ? "alias" : "endonym", lang: s_((v as Raw).lang) });
    }
    for (const v of arr(r.localized)) {
      const t = nm(v);
      if (t) names.push({ text: t, type: aliasOnly(t) ? "alias" : "other", lang: s_((v as Raw).lang) });
    }
    for (const v of arr(r.alt)) {
      const t = nm(v);
      if (t) names.push({ text: t, type: aliasOnly(t) ? "alias" : "other" });
    }
    for (const v of arr(r.aliases)) {
      const t = nm(v);
      if (t) names.push({ text: t, type: "alias" });
    }
    const gname = s_(r.glottolog_name);
    const name = s_(r.name) ?? labelFor(id, gname ?? id, labels);
    if (gname && gname !== name) names.push({ text: gname, type: aliasOnly(gname) ? "alias" : "other" });
    const endo = names.find((n) => n.type === "endonym" && n.text !== name) ?? null;
    out.push({
      id: target,
      kind,
      name,
      names,
      iso: s_(r.iso639_3),
      qid: s_(r.wikidata_qid),
      familyId: s_(r.family),
      parentId: s_(r.parent),
      endonym: endo ? { text: endo.text, lang: endo.lang ?? null } : null,
      inScope: r.in_scope === true,
      drawn: true,
    });
  }
  return out.length ? out : null;
}

/** D-004: a Glottolog name containing the search alias is matched but shown only as an alias. */
function aliasOnly(text: string): boolean {
  return /\bfarsi\b/i.test(text); // alias rule, see src/data/names.ts
}

function aliases(g: string): SearchName[] {
  return (SEARCH_ALIASES[g] ?? []).map((text) => ({ text, type: "alias" as const }));
}

/** Tier 1 from the scope index. */
export function tier1FromIndex(index: ScopeIndex): SearchDoc[] {
  const famName = new Map(index.families.map((f) => [f.g, f.name]));
  const docs: SearchDoc[] = index.langs.map((l) => {
    const endo = l.names.find((n) => n[2] === "endonym");
    const top = l.top ? (famName.get(l.top) ?? null) : null;
    const parent = l.lineage.length ? (famName.get(l.lineage.at(-1)!) ?? l.parentName) : null;
    return {
      id: l.g,
      kind: l.level === "dialect" ? "dialect" : "language",
      name: l.label,
      names: [
        ...l.names.map(([text, lang, type]) => ({
          text,
          lang,
          type: type === "endonym" ? ("endonym" as const) : ("other" as const),
        })),
        ...aliases(l.g),
      ],
      iso: l.iso,
      path: [top, parent && parent !== top ? parent : null].filter(Boolean).join(" / ") || null,
      endonym: endo ? { text: endo[0], lang: endo[1] } : null,
      inScope: l.decided,
      drawn: true,
    };
  });
  for (const f of index.families) {
    docs.push({
      id: f.g,
      kind: "family",
      name: f.name,
      names: [],
      path: f.top && f.top !== f.g ? (famName.get(f.top) ?? null) : null,
      inScope: true,
      drawn: true,
    });
  }
  return docs;
}

/** Tier 2 from tree.json: every Glottolog languoid by name and Glottocode. */
export function tier2FromTree(tree: TreeCounts, labels: Record<string, string>): SearchDoc[] {
  const rows = tree.rows;
  const docs: SearchDoc[] = [];
  for (let i = 0; i < rows.length; i++) {
    const [g, parent, level, name] = rows[i]!;
    let top = i;
    for (let p = parent, guard = 0; p >= 0 && guard < 200; p = rows[p]![1], guard++) top = p;
    const topName = top !== i ? rows[top]![3] : null;
    const parentName = parent >= 0 ? rows[parent]![3] : null;
    const label = labelFor(g, name, labels);
    docs.push({
      id: g,
      kind: level === 0 ? "family" : level === 2 ? "dialect" : "language",
      name: label,
      names: [
        ...(label !== name
          ? [{ text: name, type: aliasOnly(name) ? ("alias" as const) : ("other" as const) }]
          : []),
        ...aliases(g),
      ],
      path:
        [topName, parentName && parentName !== topName ? parentName : null].filter(Boolean).join(" / ") ||
        null,
      inScope: false,
      drawn: true,
    });
  }
  return docs;
}

export async function fetchPipeline(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
    return await res.json();
  } catch {
    return null;
  }
}
