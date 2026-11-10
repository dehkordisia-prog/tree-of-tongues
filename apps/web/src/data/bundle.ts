// The per-languoid bundle written by the pipeline (data/build/bundles/{glottocode}.json, schema 1).
// Types follow the files as built; every fact keeps its source_id, locator, retrieval date and confidence.

export type Confidence = "high" | "medium" | "low" | "contested";

export interface Provenance {
  source_id: string;
  locator: string;
  retrieved_at: string;
  confidence: Confidence;
  notes?: string | null;
}

export interface Languoid extends Provenance {
  name: string;
  level: "family" | "language" | "dialect";
  category: string | null;
  endangerment: string | null;
  is_isolate: boolean | null;
  iso639_3: string | null;
  latitude: number | null;
  longitude: number | null;
  macroarea: string | null;
  parent_glottocode: string | null;
  wikidata_qid: string | null;
}

export interface NameRow extends Provenance {
  lang: string | null;
  name: string;
  script: string | null;
  type: "exonym" | "endonym" | "alias" | string;
}

export interface SpeakerReference {
  retrieved: string | null;
  stated_in: string | null;
  stated_in_label: string | null;
  url: string | null;
}

export interface SpeakerRow extends Provenance {
  kind: "L1" | "L2" | "total" | "unknown" | string;
  value: number;
  year: number | null;
  rank: "preferred" | "normal" | "deprecated" | string;
  method: string | null;
  part: string | null;
  references: SpeakerReference[] | null;
  disagrees_gt_25pct: boolean;
}

export interface TerritoryItem {
  cldr_code?: string;
  iso3166: string;
  official_status: string | null;
  population_share: number | null;
  year: number | null;
}

export interface TerritoryBlock {
  source_id: string;
  locator_template: string;
  retrieved_at: string;
  confidence: Confidence;
  notes: string | null;
  items: TerritoryItem[];
}

export interface XrefRow extends Provenance {
  scheme: string;
  code: string;
}

export interface SourceInfo {
  attribution: string;
  license: string;
  url: string;
  version: string;
}

export interface Bundle {
  schema: number;
  glottocode: string;
  languoid: Languoid;
  /** Ancestors, root family first, parent last. The languoid itself is not included. */
  lineage: { glottocode: string; level: string; name: string }[];
  children: { items: [glottocode: string, name: string, level: string][]; total: number };
  names: { items: NameRow[] } | NameRow[];
  speakers: SpeakerRow[];
  territories: TerritoryBlock[];
  xrefs: XrefRow[];
  sources: Record<string, SourceInfo>;
}

export const BUNDLE_URL = (glottocode: string) => `/data/bundles/${glottocode}.json`;

export function nameRows(b: Bundle): NameRow[] {
  return Array.isArray(b.names) ? b.names : (b.names?.items ?? []);
}

/** Endonym: CLDR first, then Wikidata, then Glottolog. Never typed by hand. */
export function endonymOf(b: Bundle): NameRow | null {
  const rows = nameRows(b).filter((n) => n.type === "endonym");
  const order = (id: string) => (id.startsWith("cldr") ? 0 : id === "wikidata" ? 1 : 2);
  return rows.sort((a, c) => order(a.source_id) - order(c.source_id))[0] ?? null;
}

/** Locator for one territory row, from the block's template. */
export function territoryLocator(block: TerritoryBlock, item: TerritoryItem): string {
  return block.locator_template.replace("{iso3166}", item.iso3166).replace("{cldr_code}", item.cldr_code ?? "");
}

export type BundleResult =
  | { status: "ok"; bundle: Bundle }
  | { status: "missing" }
  | { status: "error" };

/** Fetch a bundle. 404 (or a dev server's HTML page) means missing; anything else is an error. */
export async function fetchBundle(glottocode: string, signal?: AbortSignal): Promise<BundleResult> {
  let res: Response;
  try {
    res = await fetch(BUNDLE_URL(glottocode), { signal });
  } catch {
    return { status: "error" };
  }
  if (res.status === 404) return { status: "missing" };
  if (!res.ok) return { status: "error" };
  if ((res.headers.get("content-type") ?? "").includes("text/html")) return { status: "missing" };
  try {
    return { status: "ok", bundle: (await res.json()) as Bundle };
  } catch {
    return { status: "error" };
  }
}
