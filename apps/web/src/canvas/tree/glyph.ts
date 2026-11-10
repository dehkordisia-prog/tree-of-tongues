// The speaker glyph (docs/specs/app-shell.md 5.3): geometry from data, and a small store that
// fetches the figures of the languages drawn at the current zoom.
//
// Rules that the code keeps (D-005, D-022):
//   - a figure is drawn only when a source states it; no figure gives a ring whose size means nothing
//   - L1, Total and "kind not stated" stay apart; nothing is summed or averaged
//   - the disc and the ring sit at the MINIMUM of their kind; the band runs to the maximum
//   - rows that reached a node only through attached_via are left out (they are never used for sizing)
//   - families have no glyph

import type { SpeakerRow } from "@/data/bundle";
import { BUNDLE_URL } from "@/data/bundle";
import { summarizeSpeakers, type SpeakerKind } from "@/data/speakers";

import type { TreeLayout } from "./layout";

/** The kinds the glyph and the screen-reader text use, in reading order. */
export const GLYPH_KINDS = ["l1", "total", "unstated", "l2"] as const satisfies readonly SpeakerKind[];

export interface KindFigures {
  min: number;
  max: number;
  /** Number of figures (rows), each listed with its source in the Inspector. The Inspector also counts rows. */
  sources: number;
  firstYear: number | null;
  lastYear: number | null;
}

export type GlyphFigures = Record<SpeakerKind, KindFigures | null>;

/**
 * Size rule. Radii are fractions of the one-entry slot of a language.
 *   radius = FILL * sqrt(figure / FULL_AT), at least MIN_R, at most FILL.
 * Area follows the figure on one scale for the whole canvas, between the two clamps.
 */
export const GLYPH_SCALE = {
  /** The figure at which a circle fills its slot. Larger figures are drawn at this size. */
  FULL_AT: 100_000_000,
  FILL: 0.9,
  /** Smallest size, shared by every figure below the threshold and by the no-data ring. */
  MIN_R: 0.15,
} as const;

/** The figure below which circles all share the minimum size. */
export const GLYPH_MIN_FIGURE = (GLYPH_SCALE.MIN_R / GLYPH_SCALE.FILL) ** 2 * GLYPH_SCALE.FULL_AT;

export function glyphRadius(figure: number): number {
  const { FULL_AT, FILL, MIN_R } = GLYPH_SCALE;
  if (!(figure > 0)) return MIN_R;
  return Math.min(FILL, Math.max(MIN_R, FILL * Math.sqrt(figure / FULL_AT)));
}

export type GlyphRole = "band" | "disc" | "ring" | "dashed" | "dotted";

export interface GlyphPart {
  role: GlyphRole;
  /** Outer radius, fraction of the slot. */
  r: number;
  /** Band only: width inward from r, fraction of the slot. */
  width?: number;
}

function bandOf(f: KindFigures): GlyphPart | null {
  if (f.max <= f.min) return null;
  const lo = glyphRadius(f.min);
  const hi = glyphRadius(f.max);
  if (hi <= lo) return null; // both under the minimum size (or both over the cap)
  return { role: "band", r: hi, width: hi - lo };
}

/** Parts in painting order: bands, then disc, then ring. `null` figures give the no-data ring. */
export function glyphParts(f: GlyphFigures | null): GlyphPart[] {
  if (!f || (!f.l1 && !f.total && !f.unstated)) return [{ role: "dotted", r: GLYPH_SCALE.MIN_R }];
  const parts: GlyphPart[] = [];
  if (f.l1 || f.total) {
    if (f.l1) {
      const b = bandOf(f.l1);
      if (b) parts.push(b);
    }
    if (f.total) {
      const b = bandOf(f.total);
      if (b) parts.push(b);
    }
    if (f.l1) parts.push({ role: "disc", r: glyphRadius(f.l1.min) });
    if (f.total) parts.push({ role: "ring", r: glyphRadius(f.total.min) });
    return parts;
  }
  // Kind not stated only: dashed ring at the minimum, band to the maximum, no disc.
  const u = f.unstated!;
  const b = bandOf(u);
  if (b) parts.push(b);
  parts.push({ role: "dashed", r: glyphRadius(u.min) });
  return parts;
}

/** Rows to figures. Attached-via rows and deprecated rows are dropped before anything is counted. */
export function figuresFromRows(rows: readonly SpeakerRow[]): GlyphFigures {
  const usable = rows.filter((r) => !(r as { attached_via?: string | null }).attached_via);
  const s = summarizeSpeakers(usable);
  const out = {} as GlyphFigures;
  for (const k of ["l1", "l2", "total", "unstated"] as const) {
    const g = s.groups[k];
    out[k] =
      g.min === null || g.max === null
        ? null
        : { min: g.min, max: g.max, sources: g.rows.length, firstYear: g.firstYear, lastYear: g.lastYear };
  }
  return out;
}

/* ------------------------------------------------------------------ store */

export type GlyphState = "none" | "pending" | "ready" | "error";

export type RowFetcher = (glottocode: string) => Promise<SpeakerRow[] | null>;

export const fetchBundleRows: RowFetcher = async (glottocode) => {
  const res = await fetch(BUNDLE_URL(glottocode));
  if (!res.ok) return null;
  const type = res.headers.get("content-type") ?? "";
  if (type.includes("text/html")) return null;
  const b = (await res.json()) as { speakers?: SpeakerRow[] };
  return Array.isArray(b.speakers) ? b.speakers : [];
};

/**
 * Figures per language node, loaded from the bundles of the languages that are drawn with a glyph.
 * tree.json says whether a language has any figure (anyMax), so a language without one never needs
 * a request. At most `maxConcurrent` requests run; each request() replaces the waiting queue with
 * the latest visible set.
 */
export class SpeakerStore {
  /** Increases whenever a figure arrives. */
  revision = 0;
  onChange: (() => void) | null = null;
  private readonly done = new Map<number, GlyphFigures | null>();
  private readonly inflight = new Map<number, Promise<void>>();
  private queue: number[] = [];
  private running = 0;

  constructor(
    private readonly layout: Pick<TreeLayout, "glottocode" | "anyMax">,
    private readonly fetchRows: RowFetcher = fetchBundleRows,
    private readonly maxConcurrent = 4,
  ) {}

  state(v: number): GlyphState {
    if (Number.isNaN(this.layout.anyMax[v]!)) return "none";
    if (!this.done.has(v)) return "pending";
    return this.done.get(v) ? "ready" : "error";
  }

  figures(v: number): GlyphFigures | null {
    return this.done.get(v) ?? null;
  }

  /** Replace the waiting queue (closest first). Nodes that are loaded or loading are skipped. */
  request(nodes: readonly number[]): void {
    this.queue = nodes.filter((v) => this.state(v) === "pending" && !this.inflight.has(v));
    this.pump();
  }

  /** Resolves when the node is loaded or has failed, or after `timeoutMs`. Never rejects. */
  ensure(v: number, timeoutMs = 1500): Promise<void> {
    if (this.state(v) !== "pending") return Promise.resolve();
    const p = this.load(v);
    return Promise.race([p, new Promise<void>((res) => setTimeout(res, timeoutMs))]);
  }

  private load(v: number): Promise<void> {
    const have = this.inflight.get(v);
    if (have) return have;
    const p = (async () => {
      try {
        const rows = await this.fetchRows(this.layout.glottocode[v]!);
        this.done.set(v, rows ? figuresFromRows(rows) : null);
      } catch {
        this.done.set(v, null);
      }
      this.inflight.delete(v);
      this.running = Math.max(0, this.running - 1);
      this.revision++;
      this.onChange?.();
      this.pump();
    })();
    this.inflight.set(v, p);
    this.running++;
    return p;
  }

  private pump(): void {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const v = this.queue.shift()!;
      if (this.state(v) === "pending" && !this.inflight.has(v)) void this.load(v);
    }
  }
}
