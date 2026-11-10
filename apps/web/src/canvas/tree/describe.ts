// Screen-reader text for a node. Names and counts come from tree.json, nothing from memory.

import type { GlyphFigures, KindFigures } from "./glyph";
import { GLYPH_KINDS } from "./glyph";
import { LEVEL_DIALECT, LEVEL_FAMILY, LEVEL_LANGUAGE, LEVEL_WORLD, type TreeLayout } from "./layout";

const nf = new Intl.NumberFormat("en");
const plural = (n: number, one: string, many: string) => `${nf.format(n)} ${n === 1 ? one : many}`;

export function levelLabel(level: number): string {
  if (level === LEVEL_FAMILY) return "family";
  if (level === LEVEL_LANGUAGE) return "language";
  if (level === LEVEL_DIALECT) return "dialect";
  return "world";
}

type Describable = Pick<TreeLayout, "name" | "level" | "languages" | "childStart">;

/** "Indo-European, family, 595 languages" */
export function describeNode(L: Describable, v: number): string {
  const level = L.level[v]!;
  const kids = L.childStart[v + 1]! - L.childStart[v]!;
  if (level === LEVEL_WORLD) return `${L.name[v]}, ${plural(kids, "top-level group", "top-level groups")}, ${plural(L.languages[v]!, "language", "languages")}`;
  if (level === LEVEL_FAMILY) return `${L.name[v]}, family, ${plural(L.languages[v]!, "language", "languages")}`;
  if (level === LEVEL_LANGUAGE) return kids > 0 ? `${L.name[v]}, language, ${plural(kids, "dialect", "dialects")}` : `${L.name[v]}, language`;
  return kids > 0 ? `${L.name[v]}, dialect, ${plural(kids, "sub-entry", "sub-entries")}` : `${L.name[v]}, dialect`;
}

/* ------------------------------------------------------------------ speakers */

const KIND_LABEL = {
  l1: "First-language speakers",
  total: "Total speakers",
  unstated: "Speakers, kind not stated",
  l2: "Second-language speakers",
} as const;

const compact = new Intl.NumberFormat("en", { notation: "compact", compactDisplay: "long", maximumFractionDigits: 1 });
const year = new Intl.NumberFormat("en", { useGrouping: false });

function unitOf(n: number): string {
  return compact.formatToParts(n).find((p) => p.type === "compact")?.value ?? "";
}

/** "71.4 to 82.2 million" when both ends share a unit, else "900 thousand to 1.2 million". One figure: "71.4 million". */
export function formatFigureRange(min: number, max: number): string {
  const a = compact.format(min);
  const b = compact.format(max);
  if (a === b) return a;
  const u = unitOf(min);
  if (u && u === unitOf(max)) return `${a.slice(0, a.length - u.length).trim()} to ${b}`;
  return `${a} to ${b}`;
}

function describeKind(kind: keyof typeof KIND_LABEL, f: KindFigures): string {
  const parts = [`${KIND_LABEL[kind]}: ${formatFigureRange(f.min, f.max)}`, `${f.sources} ${f.sources === 1 ? "source" : "sources"}`];
  if (f.firstYear !== null && f.lastYear !== null) {
    parts.push(f.firstYear === f.lastYear ? year.format(f.firstYear) : `${year.format(f.firstYear)} to ${year.format(f.lastYear)}`);
  }
  return `${parts.join(", ")}.`;
}

/**
 * "First-language speakers: 71.4 to 82.2 million, 5 sources, 2006 to 2021." One sentence per kind
 * that has a figure, in the order L1, total, kind not stated, L2. "No speaker figure yet." when none.
 */
export function describeSpeakers(f: GlyphFigures | null): string {
  if (!f) return "No speaker figure yet.";
  const out: string[] = [];
  for (const k of GLYPH_KINDS) {
    const g = f[k];
    if (g) out.push(describeKind(k, g));
  }
  return out.length ? out.join(" ") : "No speaker figure yet.";
}
