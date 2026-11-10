// Speaker figures for display (docs/specs/app-shell.md section 5; D-005, D-022).
//   - Never averaged, never summed. A range is min to max of the figures of one kind.
//   - Kinds stay apart: L1, L2, Total, and "Kind not stated" (Wikidata kind unknown). An unstated
//     figure never enters the L1 or Total range.
//   - Wikidata rank "deprecated" is folded away and never enters a range.

import type { SpeakerRow } from "./bundle";

export type SpeakerKind = "l1" | "l2" | "total" | "unstated";
export const SPEAKER_KINDS: readonly SpeakerKind[] = ["l1", "l2", "total", "unstated"];

export interface SpeakerGroup {
  kind: SpeakerKind;
  /** Newest year first; rows without a year last. */
  rows: SpeakerRow[];
  min: number | null;
  max: number | null;
  firstYear: number | null;
  lastYear: number | null;
  /** Distinct references (stated-in label or URL), at least 1 per row. */
  sources: number;
}

export interface SpeakerSummary {
  groups: Record<SpeakerKind, SpeakerGroup>;
  deprecated: SpeakerRow[];
  /** Any figure flagged by the pipeline as differing by more than 25 percent from others of its kind. */
  disagrees: boolean;
  /** L1 maximum exceeds the Total minimum: the figures come from different sources and years. */
  mixed: boolean;
  /** At least one non-deprecated figure exists. */
  any: boolean;
}

export function kindOf(row: SpeakerRow): SpeakerKind {
  const k = row.kind.toLowerCase();
  if (k === "l1") return "l1";
  if (k === "l2") return "l2";
  if (k === "total") return "total";
  return "unstated";
}

export function referenceKey(row: SpeakerRow): string {
  const r = row.references?.[0];
  return r?.stated_in_label ?? r?.stated_in ?? r?.url ?? `${row.source_id}:${row.locator}`;
}

function group(kind: SpeakerKind, rows: SpeakerRow[]): SpeakerGroup {
  const sorted = [...rows].sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || b.value - a.value);
  const values = rows.map((r) => r.value);
  const years = rows.map((r) => r.year).filter((y): y is number => typeof y === "number");
  return {
    kind,
    rows: sorted,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    firstYear: years.length ? Math.min(...years) : null,
    lastYear: years.length ? Math.max(...years) : null,
    sources: new Set(rows.map(referenceKey)).size,
  };
}

export function summarizeSpeakers(rows: readonly SpeakerRow[]): SpeakerSummary {
  const live = rows.filter((r) => r.rank !== "deprecated" && Number.isFinite(r.value));
  const by: Record<SpeakerKind, SpeakerRow[]> = { l1: [], l2: [], total: [], unstated: [] };
  for (const r of live) by[kindOf(r)].push(r);
  const groups = Object.fromEntries(SPEAKER_KINDS.map((k) => [k, group(k, by[k])])) as Record<SpeakerKind, SpeakerGroup>;
  const l1 = groups.l1;
  const total = groups.total;
  return {
    groups,
    deprecated: rows.filter((r) => r.rank === "deprecated"),
    disagrees: live.some((r) => r.disagrees_gt_25pct),
    mixed: l1.max !== null && total.min !== null && l1.max > total.min,
    any: live.length > 0,
  };
}

/** Compact long form in the interface locale (Persian gets Persian digits). Exact values go in the popover. */
export function formatCompact(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 }).format(n);
}

export function formatExact(n: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(n);
}

export function formatYear(y: number, locale: string): string {
  return new Intl.NumberFormat(locale, { useGrouping: false }).format(y);
}
