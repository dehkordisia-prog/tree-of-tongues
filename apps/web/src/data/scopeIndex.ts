// The scope index: a small digest of the scope list plus the bundles of the scope languages and
// families, generated at build time (app/server/scopeIndex.server.ts) and served to the client as a
// lazily loaded chunk (virtual:tt-scope-index). It feeds Go deeper, the world view and tier-1 search.
// Every value is copied from the scope list, the bundles or tree.json; nothing is typed by hand.

import type { Level } from "./scope.ts";

export interface IndexLang {
  g: string;
  label: string;
  level: Level;
  /** Ancestor glottocodes, root family first (from the bundle). Empty when data is not built. */
  lineage: string[];
  /** Top-level family glottocode. */
  top: string | null;
  macroarea: string | null;
  /** CLDR 49 territory rows: [ISO 3166 code, share of population or null, 1 if official]. */
  terr: [string, number | null, 0 | 1][];
  /** Glottolog children of the language (its dialects). */
  dialects: number;
  iso: string | null;
  /** True for a scope entry with its own glottocode; false for a candidate of a contested entry. */
  decided: boolean;
  confidence: string | null;
  /** Search material from the bundle: endonyms and CLDR or Wikidata names, with their language tags. */
  names: [name: string, lang: string | null, type: string][];
  /** Name of the top family, for search rows. */
  parentName: string | null;
}

export interface IndexFamily {
  g: string;
  name: string;
  parent: string | null;
  top: string | null;
  macroareas: string[];
  /** Glottolog counts of languages and dialects in the subtree (tree.json), not speakers. */
  languages: number | null;
  dialects: number | null;
}

/** A Lumper/Splitter group (D-022, D-023), copied from lumper_groups in the scope list. */
export interface IndexLumpGroup {
  id: string;
  /** The label as the scope list words it (a Glottolog node or the atlas's own grouping). */
  label: string | null;
  ancestor: string | null;
  /** owner_decision from the scope list, for example "pending". */
  ownerDecision: string | null;
  members: { g: string; label: string }[];
}

export interface ScopeIndex {
  /** False when data/build was absent at build time (CI): only scope-list facts are present. */
  built: boolean;
  /** Display labels by glottocode (scope list display_name, then D-004 overrides). */
  labels: Record<string, string>;
  langs: IndexLang[];
  families: IndexFamily[];
  /** The largest top-level families by Glottolog language count, largest first. */
  topFamilies: { g: string; name: string; languages: number }[];
  /** Pilot profiles for the world view, by glottocode, in order. */
  pilots: string[];
  /** Lumper/Splitter groups. Optional so older fixtures stay valid. */
  lumpGroups?: IndexLumpGroup[];
  /** inspector_note by glottocode, for scope entries with a lumper_group. */
  lumpNotes?: Record<string, { group: string; note: string | null }>;
}

export const EMPTY_INDEX: ScopeIndex = { built: false, labels: {}, langs: [], families: [], topFamilies: [], pilots: [] };

let pending: Promise<ScopeIndex> | null = null;

/** Client and prerender: load the generated index once. */
export function loadScopeIndex(): Promise<ScopeIndex> {
  pending ??= import("virtual:tt-scope-index").then(
    (m) => m.default as ScopeIndex,
    () => EMPTY_INDEX,
  );
  return pending;
}
