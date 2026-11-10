// Semantic zoom and level of detail. Pure: layout + camera + focus in, flat typed arrays out.
// Both renderers draw exactly the same Scene.
//
// Rules (screen radii in CSS px):
//   - a node smaller than MIN_DRAW_PX, or outside the viewport, is skipped with its whole subtree
//   - children of a family or language are drawn once the parent radius reaches OPEN_PX
//   - dialects (children of a language) are drawn last, once the language reaches OPEN_DIALECT_PX
//   - a node with nothing drawn inside it gets a centered label when radius >= LABEL_MIN_PX and
//     the name fits (about 1.8 radii wide)
//   - an opened node gets a label at its top edge when radius >= INTERIOR_LABEL_MIN_PX and its
//     largest child is under INTERIOR_ROOM of its radius (otherwise the edge is crowded)
//   - a language whose one-entry slot is at least GLYPH_MIN_PX wide gets a speaker glyph (glyph.ts):
//     its circle turns light and the glyph is drawn inside the slot; its label moves below the circle
//   - labels are picked greedily (focused path, scope languages, larger circles) and a label that
//     would touch an accepted one is dropped (labels.ts); at most MAX_LABELS

import type { Camera, Size } from "./camera";
import { glyphParts, type GlyphPart, type SpeakerStore } from "./glyph";
import { selectLabels, type LabelCandidate } from "./labels";
import { LEVEL_DIALECT, LEVEL_LANGUAGE, type TreeLayout } from "./layout";

const NORMAL_LOD = {
  MIN_DRAW_PX: 0.6,
  OPEN_PX: 6,
  OPEN_DIALECT_PX: 36,
  LABEL_MIN_PX: 15,
  INTERIOR_LABEL_MIN_PX: 44,
  /** An opened node is labeled at its top edge only when its largest child is under this share of its radius. */
  INTERIOR_ROOM: 0.72,
  LABEL_FONT_PX: 12,
  /** Average glyph advance used to decide whether a name fits. */
  LABEL_CHAR_PX: 6.4,
  MAX_LABELS: 250,
  DIM: 0.2,
  LEAF_ALPHA: 0.88,
  LINE_PX: 1.25,
  /** A speaker glyph is drawn when the one-entry slot of a language has at least this screen radius. */
  GLYPH_MIN_PX: 5,
  /** Alpha of the translucent range band, the light language circle and the glyph disc. */
  BAND_ALPHA: 0.3,
  SLOT_ALPHA: 0.14,
  DISC_ALPHA: 0.92,
  GLYPH_RING_PX: 1.5,
  NO_DATA_RING_PX: 1,
  /** Most speaker-figure requests asked of the store per build, closest to the center first. */
  MAX_WANTED: 48,
};

/** Live thresholds. Mutated only by setLodMode (the ?stress=1 benchmark switch). */
export const LOD: typeof NORMAL_LOD = { ...NORMAL_LOD };

/**
 * "stress" turns semantic zoom off so that every one of the 27,177 languoids is drawn at the
 * world view (most are under a quarter of a pixel; the point is the instance count). It is an upper bound for renderer cost, not a design setting.
 */
export function setLodMode(mode: "normal" | "stress"): void {
  Object.assign(LOD, NORMAL_LOD);
  if (mode === "stress") Object.assign(LOD, { MIN_DRAW_PX: 0.05, OPEN_PX: 0.05, OPEN_DIALECT_PX: 0.05 });
}

export type Rgb = readonly [number, number, number];
export interface Palette {
  /** One mark color per FAMILY_ORDER entry. */
  mark: readonly Rgb[];
  ink: Rgb;
  canvas: Rgb;
  /** The line-strong token: the dotted no-data ring. */
  lineStrong: Rgb;
}

export const LABEL_KIND_CENTER = 0;
export const LABEL_KIND_TOP = 1;
/** Under the circle (languages with a glyph, so the label does not cover it). */
export const LABEL_KIND_BELOW = 2;

/** Line styles in Scene.style. Only the PixiJS renderer draws the dashed and dotted ones. */
export const STYLE_SOLID = 0;
export const STYLE_DASHED = 1;
export const STYLE_DOTTED = 2;

/** Does a name of this length fit inside a circle of screen radius rs? */
export function labelFits(nameLength: number, rs: number): boolean {
  return nameLength * LOD.LABEL_CHAR_PX <= 1.8 * rs;
}

export function opensChildren(
  layout: Pick<TreeLayout, "childStart" | "childList" | "level">,
  node: number,
  rs: number,
): boolean {
  const a = layout.childStart[node]!;
  if (a === layout.childStart[node + 1]) return false;
  const dialects = layout.level[layout.childList[a]!] === LEVEL_DIALECT;
  return rs >= (dialects ? LOD.OPEN_DIALECT_PX : LOD.OPEN_PX);
}

export class Scene {
  /** Drawn instances: nodes and glyph parts, in painting order. The renderers draw this many. */
  count = 0;
  /** Nodes among them (glyph parts have id -1). */
  nodeCount = 0;
  labelCount = 0;
  /** Increases whenever the drawn content differs from the previous build. */
  version = 0;
  /** Number of nodes the traversal visited (drawn or culled at the frontier). */
  visited = 0;
  cap = 32768;
  /** Node id, or -1 for a glyph part. */
  id = new Int32Array(this.cap);
  x = new Float32Array(this.cap);
  y = new Float32Array(this.cap);
  r = new Float32Array(this.cap);
  fill = new Uint8Array(this.cap * 4);
  line = new Uint8Array(this.cap * 4);
  lineW = new Float32Array(this.cap);
  style = new Uint8Array(this.cap);
  labelId = new Int32Array(LOD.MAX_LABELS);
  labelKind = new Uint8Array(LOD.MAX_LABELS);
  labelAlpha = new Float32Array(LOD.MAX_LABELS);
  /** Languages that want a glyph but whose figures are not loaded yet, closest to the center first. */
  wanted: number[] = [];
  /** Where the speaker figures come from. Without a store no glyphs are drawn (the spike). */
  store: SpeakerStore | null = null;
  /** Per node: 1 for scope languages. Raises their label priority. */
  priority: Uint8Array | null = null;
  private hash = 0;
  private stackNode: Int32Array;
  private stackIn: Uint8Array;
  private onPath: Uint8Array;
  private pathFor = -2;

  constructor(private readonly layout: TreeLayout) {
    this.stackNode = new Int32Array(layout.n + 2);
    this.stackIn = new Uint8Array(layout.n + 2);
    this.onPath = new Uint8Array(layout.n + 1);
  }

  private grow(): void {
    const cap = this.cap * 2;
    const g = <T extends Float32Array | Int32Array | Uint8Array>(a: T, k = 1): T => {
      const b = new (a.constructor as new (n: number) => T)(cap * k);
      b.set(a);
      return b;
    };
    this.id = g(this.id);
    this.x = g(this.x);
    this.y = g(this.y);
    this.r = g(this.r);
    this.fill = g(this.fill, 4);
    this.line = g(this.line, 4);
    this.lineW = g(this.lineW);
    this.style = g(this.style);
    this.cap = cap;
  }

  private markPath(focus: number): void {
    if (this.pathFor === focus) return;
    const { parent } = this.layout;
    this.onPath.fill(0);
    for (let v = focus; v >= 0; v = parent[v]!) this.onPath[v] = 1;
    this.pathFor = focus;
  }

  /** Write one instance. */
  private put(
    i: number,
    id: number,
    x: number,
    y: number,
    r: number,
    fill: Rgb,
    fillA: number,
    line: Rgb,
    lineA: number,
    lineW: number,
    style: number,
  ): void {
    while (i >= this.cap) this.grow();
    this.id[i] = id;
    this.x[i] = x;
    this.y[i] = y;
    this.r[i] = r;
    const f = i * 4;
    this.fill[f] = fill[0];
    this.fill[f + 1] = fill[1];
    this.fill[f + 2] = fill[2];
    this.fill[f + 3] = Math.round(fillA * 255);
    this.line[f] = line[0];
    this.line[f + 1] = line[1];
    this.line[f + 2] = line[2];
    this.line[f + 3] = Math.round(lineA * 255);
    this.lineW[i] = lineW;
    this.style[i] = style;
  }

  /** Rebuild for this camera. `epoch` changes when colors or the focus change. Returns true if content changed. */
  build(cam: Camera, size: Size, focus: number, palette: Palette, epoch: number): boolean {
    const L = this.layout;
    const { childStart, childList, x: lx, y: ly, r: lr, depth, family, name, root, level } = L;
    this.markPath(focus);
    const dimAll = focus !== root;
    const halfW = size.w / 2;
    const halfH = size.h / 2;
    const s = cam.scale;
    const store = this.store;
    const glyphPx = L.unitR * s;
    const glyphsOn = store !== null && L.unitR > 0 && glyphPx >= LOD.GLYPH_MIN_PX;
    const prio = this.priority;
    const FONT = LOD.LABEL_FONT_PX;

    let count = 0;
    let nodes = 0;
    let visited = 0;
    let h = (2166136261 ^ epoch) >>> 0;
    if (store) h = Math.imul(h ^ store.revision, 16777619);
    const cands: LabelCandidate[] = [];
    const candKind: number[] = [];
    const candDim: number[] = [];
    const wanted: { v: number; d: number }[] = [];

    let sp = 0;
    // World root is never drawn; start with its children (pushed in reverse for painter's order).
    for (let k = childStart[root + 1]! - 1; k >= childStart[root]!; k--) {
      this.stackNode[sp] = childList[k]!;
      this.stackIn[sp++] = dimAll ? 0 : 1;
    }

    while (sp > 0) {
      sp--;
      const v = this.stackNode[sp]!;
      const inFocus = this.stackIn[sp]!;
      visited++;
      const sx = (lx[v]! - cam.cx) * s + halfW;
      const sy = (ly[v]! - cam.cy) * s + halfH;
      const rs = lr[v]! * s;
      if (rs < LOD.MIN_DRAW_PX) continue;
      if (sx + rs < 0 || sx - rs > size.w || sy + rs < 0 || sy - rs > size.h) continue;

      const opened = opensChildren(L, v, rs);
      const isFocus = v === focus;
      const onPath = this.onPath[v] === 1;
      const nowIn = inFocus === 1 || isFocus;
      const dim = dimAll && !nowIn && !onPath ? LOD.DIM : 1;
      const rgb = palette.mark[family[v]!]!;

      // A language with a loaded (or known absent) figure set gets a glyph in its slot.
      let parts: GlyphPart[] | null = null;
      if (glyphsOn && level[v] === LEVEL_LANGUAGE) {
        const st = store!.state(v);
        if (st === "none") parts = glyphParts(null);
        else if (st === "ready") parts = glyphParts(store!.figures(v));
        else if (st === "pending") {
          const gx = (L.selfX[v]! - cam.cx) * s + halfW;
          const gy = (L.selfY[v]! - cam.cy) * s + halfH;
          if (gx > -glyphPx && gx < size.w + glyphPx && gy > -glyphPx && gy < size.h + glyphPx) {
            wanted.push({ v, d: (gx - halfW) ** 2 + (gy - halfH) ** 2 });
          }
        }
      }
      const withGlyph = parts !== null;

      const i = count++;
      nodes++;
      if (opened) {
        const a = (0.07 + 0.012 * Math.min(depth[v]!, 8)) * (onPath && !isFocus ? 0.6 : 1) * dim;
        this.put(i, v, lx[v]!, ly[v]!, lr[v]!, rgb, a, rgb, (isFocus ? 1 : 0.8) * dim, isFocus ? LOD.LINE_PX * 1.8 : LOD.LINE_PX, STYLE_SOLID);
      } else if (withGlyph) {
        this.put(i, v, lx[v]!, ly[v]!, lr[v]!, rgb, LOD.SLOT_ALPHA * dim, rgb, 0.6 * dim, LOD.LINE_PX, STYLE_SOLID);
      } else {
        this.put(i, v, lx[v]!, ly[v]!, lr[v]!, rgb, LOD.LEAF_ALPHA * dim, rgb, 0, 0, STYLE_SOLID);
      }
      h = Math.imul(h ^ v, 16777619);
      h = Math.imul(h ^ (opened ? 1 : 0) ^ (dim < 1 ? 2 : 0) ^ (withGlyph ? 4 : 0), 16777619);

      if (parts) {
        const R = L.unitR;
        const gx = L.selfX[v]!;
        const gy = L.selfY[v]!;
        // A language with dialects keeps its glyph in the hidden self slot; mark that slot faintly.
        if (childStart[v]! !== childStart[v + 1]!) {
          this.put(count++, -1, gx, gy, R, rgb, LOD.SLOT_ALPHA * 0.7 * dim, rgb, 0, 0, STYLE_SOLID);
        }
        for (const p of parts) {
          const j = count++;
          const pr = p.r * R;
          if (p.role === "disc") {
            this.put(j, -1, gx, gy, pr, rgb, LOD.DISC_ALPHA * dim, rgb, 0, 0, STYLE_SOLID);
          } else if (p.role === "band") {
            const w = (p.width ?? 0) * R * s;
            this.put(j, -1, gx, gy, pr, rgb, 0, rgb, LOD.BAND_ALPHA * dim, w, STYLE_SOLID);
            h = Math.imul(h ^ Math.round(w * 4), 16777619);
          } else if (p.role === "ring") {
            this.put(j, -1, gx, gy, pr, rgb, 0, rgb, 0.95 * dim, LOD.GLYPH_RING_PX, STYLE_SOLID);
          } else if (p.role === "dashed") {
            this.put(j, -1, gx, gy, pr, rgb, 0, rgb, 0.95 * dim, LOD.GLYPH_RING_PX, STYLE_DASHED);
          } else {
            this.put(j, -1, gx, gy, pr, rgb, 0, palette.lineStrong, 0.95 * dim, LOD.NO_DATA_RING_PX, STYLE_DOTTED);
          }
        }
      }

      const len = name[v]!.length;
      const w = len * LOD.LABEL_CHAR_PX + 6;
      const hgt = FONT + 4;
      const pri = onPath ? 2 : prio && prio[v] ? 1 : 0;
      if (!opened) {
        if (rs >= LOD.LABEL_MIN_PX) {
          if (withGlyph) {
            cands.push({ x: sx, y: sy + rs + FONT * 0.8, w, h: hgt, priority: pri, rs, id: v });
            candKind.push(LABEL_KIND_BELOW);
            candDim.push(dim);
          } else if (labelFits(len, rs)) {
            cands.push({ x: sx, y: sy, w, h: hgt, priority: pri, rs, id: v });
            candKind.push(LABEL_KIND_CENTER);
            candDim.push(dim);
          }
        }
      } else {
        // The top edge is free only when the largest child leaves room (a single-child chain would stack labels).
        const roomAtTop = lr[childList[childStart[v]!]!]! < LOD.INTERIOR_ROOM * lr[v]!;
        if (roomAtTop && rs >= LOD.INTERIOR_LABEL_MIN_PX && labelFits(len, rs * 0.9)) {
          cands.push({ x: sx, y: sy - rs + FONT, w, h: hgt, priority: pri, rs, id: v });
          candKind.push(LABEL_KIND_TOP);
          candDim.push(dim);
        }
        const a = childStart[v]!;
        for (let k = childStart[v + 1]! - 1; k >= a; k--) {
          this.stackNode[sp] = childList[k]!;
          this.stackIn[sp++] = nowIn ? 1 : 0;
        }
      }
    }

    // Greedy label pick with collision avoidance, then back to drawing order so the pool is stable.
    const picked = selectLabels(cands, LOD.MAX_LABELS);
    picked.sort((p, q) => cands[p]!.id - cands[q]!.id);
    let nl = 0;
    for (const k of picked) {
      const c = cands[k]!;
      this.labelId[nl] = c.id;
      this.labelKind[nl] = candKind[k]!;
      this.labelAlpha[nl] = candDim[k]!;
      h = Math.imul(h ^ (c.id + 7919 * candKind[k]!), 16777619);
      nl++;
    }

    wanted.sort((a, b) => a.d - b.d);
    this.wanted.length = 0;
    for (let k = 0; k < Math.min(wanted.length, LOD.MAX_WANTED); k++) this.wanted.push(wanted[k]!.v);

    h = Math.imul(h ^ count, 16777619) >>> 0;
    this.count = count;
    this.nodeCount = nodes;
    this.labelCount = nl;
    this.visited = visited;
    const changed = h !== this.hash;
    if (changed) {
      this.hash = h;
      this.version++;
    }
    return changed;
  }

  /** Deepest drawn node containing the world point, or -1. Later entries are deeper (preorder). Glyph parts are skipped. */
  pick(wx: number, wy: number): number {
    for (let i = this.count - 1; i >= 0; i--) {
      const id = this.id[i]!;
      if (id < 0) continue;
      const dx = wx - this.x[i]!;
      const dy = wy - this.y[i]!;
      const r = this.r[i]!;
      if (dx * dx + dy * dy <= r * r) return id;
    }
    return -1;
  }
}
