// The Phase 1 scope list (content/scope/phase-1-languages.yaml), read through one loader so new
// fields drop in without touching callers. Contested entries keep their candidates; the shell never
// picks one: an entry with a null glottocode is reachable through its candidates only.

import type { YamlValue } from "./yamlLite.ts";

export type Level = "family" | "language" | "dialect";

export interface ScopeCandidate {
  glottocode: string;
  glottologName: string | null;
  level: Level | null;
}

export interface ScopeEntry {
  rank: number | null;
  chartName: string;
  glottocode: string | null;
  /** The label the atlas uses (display_name), when the scope list sets one. */
  displayName: string | null;
  glottologName: string | null;
  level: Level | null;
  iso639_3: string | null;
  wikidataQid: string | null;
  familyPath: string | null;
  confidence: string | null;
  nodeConfidence: string | null;
  /** "nort3139#sout3123": the entry has no page of its own; it is a section of another page. */
  page: string | null;
  lumperGroup: string | null;
  inspectorNote: string | null;
  candidates: ScopeCandidate[];
}

export interface ScopeFamily {
  glottocode: string;
  name: string;
  parent: string | null;
  depth: number | null;
  topLevel: string | null;
}

export interface LumperGroup {
  id: string;
  label: string | null;
  ancestor: string | null;
  members: string[];
}

export interface ScopeFile {
  languages: ScopeEntry[];
  families: ScopeFamily[];
  lumperGroups: LumperGroup[];
}

type Obj = { [key: string]: YamlValue };
const isObj = (v: YamlValue | undefined): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: YamlValue | undefined): string | null => (typeof v === "string" && v !== "" ? v : typeof v === "number" ? String(v) : null);
const num = (v: YamlValue | undefined): number | null => (typeof v === "number" ? v : null);
const level = (v: YamlValue | undefined): Level | null => (v === "family" || v === "language" || v === "dialect" ? v : null);
const list = (v: YamlValue | undefined): YamlValue[] => (Array.isArray(v) ? v : []);

export function readScope(doc: YamlValue): ScopeFile {
  const root = isObj(doc) ? doc : {};
  const languages = list(root.languages).filter(isObj).map(
    (e): ScopeEntry => ({
      rank: num(e.rank),
      chartName: str(e.chart_name) ?? "",
      glottocode: str(e.glottocode),
      displayName: str(e.display_name),
      glottologName: str(e.glottolog_name),
      level: level(e.level),
      iso639_3: str(e.iso639_3),
      wikidataQid: str(e.wikidata_qid),
      familyPath: str(e.family_path),
      confidence: str(e.confidence),
      nodeConfidence: str(e.node_confidence),
      page: str(e.page),
      lumperGroup: str(e.lumper_group),
      inspectorNote: str(e.inspector_note),
      candidates: list(e.candidates)
        .filter(isObj)
        .map((c) => ({ glottocode: str(c.glottocode) ?? "", glottologName: str(c.glottolog_name), level: level(c.level) }))
        .filter((c) => c.glottocode !== ""),
    }),
  );
  const families = list(root.families).filter(isObj).map(
    (f): ScopeFamily => ({
      glottocode: str(f.glottocode) ?? "",
      name: str(f.name) ?? "",
      parent: str(f.parent_glottocode),
      depth: num(f.depth),
      topLevel: str(f.top_level),
    }),
  );
  const groupsRaw = root.lumper_groups;
  const lumperGroups: LumperGroup[] = isObj(groupsRaw)
    ? Object.entries(groupsRaw).map(([id, g]) => {
        const o = isObj(g) ? g : {};
        return {
          id,
          label: str(o.label),
          ancestor: str(o.ancestor),
          members: list(o.members).map((m) => (isObj(m) ? str(m.glottocode) : str(m))).filter((m): m is string => !!m),
        };
      })
    : [];
  return { languages, families: families.filter((f) => f.glottocode !== ""), lumperGroups };
}

export interface PrerenderTarget {
  path: string;
  glottocode: string;
  kind: "language" | "family";
}

/**
 * Pages to prerender: every scope entry with its own glottocode (no `page` redirect), the candidates
 * of entries left contested without one, and every family above them.
 */
export function prerenderTargets(scope: ScopeFile): PrerenderTarget[] {
  const out = new Map<string, PrerenderTarget>();
  const add = (glottocode: string, lvl: Level | null) => {
    const kind = lvl === "family" ? "family" : "language";
    const path = `/${kind}/${glottocode}`;
    if (!out.has(path)) out.set(path, { path, glottocode, kind });
  };
  for (const e of scope.languages) {
    if (e.glottocode) {
      if (!e.page) add(e.glottocode, e.level);
    } else {
      for (const c of e.candidates) add(c.glottocode, c.level);
    }
  }
  for (const f of scope.families) add(f.glottocode, "family");
  return [...out.values()];
}

/** Label rule (D-004): the scope list's display_name, else the Glottolog name. */
export function scopeLabel(e: Pick<ScopeEntry, "displayName" | "glottologName" | "chartName">): string {
  return e.displayName ?? e.glottologName ?? e.chartName;
}
