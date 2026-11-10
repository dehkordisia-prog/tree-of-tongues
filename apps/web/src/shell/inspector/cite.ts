// Turns bundle rows into citation chip content. Wording for the chip text follows spec 4.6.

import type { Bundle, Provenance, SpeakerRow, TerritoryBlock, TerritoryItem } from "@/data/bundle";
import { territoryLocator } from "@/data/bundle";
import { formatExact, formatYear, type SpeakerGroup } from "@/data/speakers";

import type { CiteRow } from "./Citation";

const SHORT: Record<string, string> = {
  wikidata: "Wikidata",
  "cldr-49": "CLDR 49",
  "glottolog-5.3": "Glottolog 5.3",
};

export function sourceShort(id: string): string {
  return SHORT[id] ?? id;
}

export const day = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

type Tr = (k: never, o?: Record<string, unknown>) => string;

export function provRow(b: Bundle, p: Provenance, extra: Partial<CiteRow> = {}): CiteRow {
  const info = b.sources[p.source_id];
  return {
    source: sourceShort(p.source_id),
    year: null,
    locator: p.locator,
    retrieved: day(p.retrieved_at),
    license: info?.license ?? null,
    confidence: p.confidence,
    notes: p.notes ?? null,
    url: info?.url ?? null,
    ...extra,
  };
}

export function speakerRow(
  b: Bundle,
  r: SpeakerRow,
  locale: string,
  kindLabel: string,
  rankLabel?: string,
): CiteRow {
  const ref = r.references?.[0] ?? null;
  const statedLabel = ref?.stated_in_label ?? ref?.stated_in ?? ref?.url ?? null;
  return provRow(b, r, {
    value: formatExact(r.value, locale),
    year: r.year === null ? null : formatYear(r.year, locale),
    kind: kindLabel,
    method: r.method,
    rank: rankLabel,
    noReference: !ref || !statedLabel,
    statedIn: ref && statedLabel ? { label: statedLabel, url: ref.url } : null,
    // A Wikidata statement locator is "statement/Q150-..."; link the item page.
    url: r.locator.startsWith("statement/")
      ? `https://www.wikidata.org/wiki/${r.locator.slice(10).split("-")[0]}`
      : (b.sources[r.source_id]?.url ?? null),
  });
}

export function territoryRow(
  b: Bundle,
  block: TerritoryBlock,
  item: TerritoryItem,
  extra: Partial<CiteRow> = {},
): CiteRow {
  return {
    source: sourceShort(block.source_id),
    year: item.year === null ? null : String(item.year),
    locator: territoryLocator(block, item),
    retrieved: day(block.retrieved_at),
    license: b.sources[block.source_id]?.license ?? null,
    confidence: block.confidence,
    notes: block.notes,
    url: b.sources[block.source_id]?.url ?? null,
    ...extra,
  };
}

/** "Wikidata, 2019" for one figure; "3 sources, 2011 to 2022" for a range. */
export function groupShort(g: SpeakerGroup, t: Tr, locale: string): string {
  if (g.rows.length === 1) {
    const r = g.rows[0]!;
    return `${sourceShort(r.source_id)}, ${r.year === null ? t("cite.noYear" as never) : formatYear(r.year, locale)}`;
  }
  const n = t("cite.sourcesCount" as never, { count: g.rows.length });
  if (g.firstYear === null || g.lastYear === null) return `${n}, ${t("cite.noYear" as never)}`;
  if (g.firstYear === g.lastYear) return `${n}, ${formatYear(g.firstYear, locale)}`;
  return `${n}, ${t("cite.years" as never, { from: formatYear(g.firstYear, locale), to: formatYear(g.lastYear, locale) })}`;
}
