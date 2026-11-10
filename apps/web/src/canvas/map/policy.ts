// Borders policy for the atlas maps, as pure functions. The policy text itself is in BORDERS_POLICY
// (the report to the orchestrator quotes it for docs/DECISIONS.md).
//
// Source: Natural Earth 5.1.1 admin-0 (de facto boundaries, public domain) plus its separate
// breakaway and disputed areas theme. Natural Earth draws who controls territory. That is a stance,
// not neutrality (data/LICENSES.yaml, natural-earth-5.1.1), so the rules below sit on top of it.

export const BORDERS_POLICY = [
  "Default rendering is neutral. The atlas takes no national viewpoint.",
  "Natural Earth breakaway and disputed areas are drawn with a neutral hatch and a dashed outline, above every fill. They are never colored by a choropleth and never counted toward any state.",
  "A choropleth value reaches a polygon only through that polygon's own territory code (ISO_A2_EH). Values are never copied from a neighboring or claiming state.",
  "Any entity that Natural Earth itself marks as claimed or self-administered gets a dashed outline. If it has no territory code of its own (Somaliland, Northern Cyprus, Siachen Glacier) it is hatched and never filled.",
  "Language points are Glottolog coordinates. A point or a country fill never states that a language belongs to a state.",
  "Historical borders, when they arrive, are labeled approximate.",
  "The note 'Borders are approximate and do not imply any position on disputed territory' is always visible on the map page.",
  "Alternative viewpoints may be offered later as a labeled lens built on the ADM0_A3_xx and FCLASS_xx columns. They are never the default and never silent.",
] as const;

export const BORDERS_NOTE = "Borders are approximate and do not imply any position on disputed territory.";

/** Natural Earth wording that records a claim, self-administration or treaty abeyance in NOTE_BRK. */
const CLAIM_NOTE = /claimed by|self[ -]?admin|partial self|abeyance/i;

export interface CountryProps {
  NAME_EN?: unknown;
  ADM0_A3?: unknown;
  ISO_A2_EH?: unknown;
  NOTE_BRK?: unknown;
}

/** True when Natural Earth itself records a claim or self-administration on this entity. We add no opinion. */
export function isContestedEntity(p: CountryProps): boolean {
  return typeof p.NOTE_BRK === "string" && CLAIM_NOTE.test(p.NOTE_BRK);
}

/** The only key a choropleth value may reach a polygon through. Null for -99 and anything not two capital letters. */
export function fillCode(p: CountryProps): string | null {
  const code = p.ISO_A2_EH;
  return typeof code === "string" && /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Contested and without a code of its own: hatched, never filled. */
export function isNeutralEntity(p: CountryProps): boolean {
  return isContestedEntity(p) && fillCode(p) === null;
}

/** Properties kept on each country feature. Everything else in the 130 columns stays out of the worker. */
export interface SlimCountry {
  NAME_EN: string;
  ADM0_A3: string;
  NOTE_BRK: string | null;
  tt_code: string;
  tt_contested: boolean;
  tt_neutral: boolean;
}

export function slimCountryProps(p: CountryProps): SlimCountry {
  const code = fillCode(p);
  return {
    NAME_EN: String(p.NAME_EN ?? ""),
    ADM0_A3: String(p.ADM0_A3 ?? ""),
    NOTE_BRK: typeof p.NOTE_BRK === "string" ? p.NOTE_BRK : null,
    tt_code: code ?? "",
    tt_contested: isContestedEntity(p),
    tt_neutral: isNeutralEntity(p),
  };
}

/* ------------------------------------------------------------ viewpoints */

/**
 * Natural Earth ships ADM0_A3_xx columns for 33 viewpoints (xx = AR, BD, ..., WB). A later, clearly
 * labeled lens could join on ADM0_A3_xx instead of ADM0_A3. Not used by the UI in Phase 0.
 */
export function viewpointKey(viewpoint: string | null): string {
  if (viewpoint === null) return "ADM0_A3";
  if (!/^[A-Z]{2}$/.test(viewpoint)) throw new Error(`Unknown viewpoint code: ${viewpoint}`);
  return `ADM0_A3_${viewpoint}`;
}

/* ------------------------------------------------------------ choropleth */

export interface TerritoryRow {
  iso3166: string;
  population_share: number;
  official_status: string | null;
}

export interface Fill {
  code: string;
  share: number;
  status: string | null;
  bin: number;
}

/** Lower bounds of the share bins, in percent of the territory's population. Bin 0 is under 1 percent. */
export const SHARE_BINS = [0, 1, 10, 50, 90] as const;
export const BIN_LABELS = ["Under 1%", "1% to 10%", "10% to 50%", "50% to 90%", "90% or more"] as const;

export function shareBin(share: number): number {
  let bin = 0;
  SHARE_BINS.forEach((lower, i) => {
    if (share >= lower) bin = i;
  });
  return bin;
}

export interface Join {
  /** One fill per code that has a polygon with its own code. */
  fills: Map<string, Fill>;
  /** Rows whose code has no polygon of its own on this map. Listed in the panel, never drawn. */
  unmatched: TerritoryRow[];
}

/**
 * Join CLDR territory rows to the codes that polygons can receive. Rows are never merged or
 * averaged: a repeated code keeps its first row and the repeat goes to unmatched.
 * `drawableCodes` comes from fillCode() over the country features, so a disputed area or a
 * neutral entity can never be reached.
 */
export function joinChoropleth(rows: readonly TerritoryRow[], drawableCodes: ReadonlySet<string>): Join {
  const fills = new Map<string, Fill>();
  const unmatched: TerritoryRow[] = [];
  for (const row of rows) {
    if (!drawableCodes.has(row.iso3166) || fills.has(row.iso3166)) {
      unmatched.push(row);
      continue;
    }
    fills.set(row.iso3166, {
      code: row.iso3166,
      share: row.population_share,
      status: row.official_status,
      bin: shareBin(row.population_share),
    });
  }
  return { fills, unmatched };
}

/** Statuses that get the heavy outline. Regional status is listed in the panel only. */
export function hasOfficialOutline(status: string | null): boolean {
  return status === "official" || status === "de_facto_official";
}

export const STATUS_LABEL: Record<string, string> = {
  official: "Official",
  de_facto_official: "De facto official",
  official_regional: "Official in a region",
};

export function statusLabel(status: string | null): string {
  if (status === null) return "No official status recorded";
  return STATUS_LABEL[status] ?? status;
}
