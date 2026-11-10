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
//   - at most MAX_LABELS labels, largest circles first

import type { Camera, Size } from "./camera";
import { LEVEL_DIALECT, type TreeLayout } from "./layout";

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
}

export const LABEL_KIND_CENTER = 0;
export const LABEL_KIND_TOP = 1;

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
  count = 0;
  labelCount = 0;
  /** Increases whenever the drawn content differs from the previous build. */
  version = 0;
  /** Number of nodes the traversal visited (drawn or culled at the frontier). */
  visited = 0;
  cap = 32768;
  id = new Int32Array(this.cap);
  x = new Float32Array(this.cap);
  y = new Float32Array(this.cap);
  r = new Float32Array(this.cap);
  fill = new Uint8Array(this.cap * 4);
  line = new Uint8Array(this.cap * 4);
  lineW = new Float32Array(this.cap);
  labelId = new Int32Array(LOD.MAX_LABELS);
  labelKind = new Uint8Array(LOD.MAX_LABELS);
  labelAlpha = new Float32Array(LOD.MAX_LABELS);
  private hash = 0;
  private stackNode: Int32Array;
  private stackIn: Uint8Array;
  private onPath: Uint8Array;
  private pathFor = -2;
  private labelCand: number[] = [];

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
    this.cap = cap;
  }

  private markPath(focus: number): void {
    if (this.pathFor === focus) return;
    const { parent } = this.layout;
    this.onPath.fill(0);
    for (let v = focus; v >= 0; v = parent[v]!) this.onPath[v] = 1;
    this.pathFor = focus;
  }

  /** Rebuild for this camera. `epoch` changes when colors or the focus change. Returns true if content changed. */
  build(cam: Camera, size: Size, focus: number, palette: Palette, epoch: number): boolean {
    const L = this.layout;
    const { childStart, childList, x: lx, y: ly, r: lr, depth, family, name, root } = L;
    this.markPath(focus);
    const dimAll = focus !== root;
    const halfW = size.w / 2;
    const halfH = size.h / 2;
    const s = cam.scale;

    let count = 0;
    let visited = 0;
    let h = (2166136261 ^ epoch) >>> 0;
    this.labelCand.length = 0;
    const cand = this.labelCand;

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

      if (count >= this.cap) this.grow();
      const opened = opensChildren(L, v, rs);
      const isFocus = v === focus;
      const onPath = this.onPath[v] === 1;
      const nowIn = inFocus === 1 || isFocus;
      const dim = dimAll && !nowIn && !onPath ? LOD.DIM : 1;
      const rgb = palette.mark[family[v]!]!;

      const i = count++;
      this.id[i] = v;
      this.x[i] = lx[v]!;
      this.y[i] = ly[v]!;
      this.r[i] = lr[v]!;
      const f = i * 4;
      if (opened) {
        const a = (0.07 + 0.012 * Math.min(depth[v]!, 8)) * (onPath && !isFocus ? 0.6 : 1) * dim;
        this.fill[f] = rgb[0];
        this.fill[f + 1] = rgb[1];
        this.fill[f + 2] = rgb[2];
        this.fill[f + 3] = Math.round(a * 255);
        this.line[f] = rgb[0];
        this.line[f + 1] = rgb[1];
        this.line[f + 2] = rgb[2];
        this.line[f + 3] = Math.round((isFocus ? 1 : 0.8) * dim * 255);
        this.lineW[i] = isFocus ? LOD.LINE_PX * 1.8 : LOD.LINE_PX;
      } else {
        this.fill[f] = rgb[0];
        this.fill[f + 1] = rgb[1];
        this.fill[f + 2] = rgb[2];
        this.fill[f + 3] = Math.round(LOD.LEAF_ALPHA * dim * 255);
        this.line[f + 3] = 0;
        this.lineW[i] = 0;
      }
      h = Math.imul(h ^ v, 16777619);
      h = Math.imul(h ^ (opened ? 1 : 0) ^ (dim < 1 ? 2 : 0), 16777619);

      const len = name[v]!.length;
      if (!opened) {
        if (rs >= LOD.LABEL_MIN_PX && labelFits(len, rs)) cand.push(rs, v, LABEL_KIND_CENTER, dim);
      } else {
        // The top edge is free only when the largest child leaves room (a single-child chain would stack labels).
        const roomAtTop = lr[childList[childStart[v]!]!]! < LOD.INTERIOR_ROOM * lr[v]!;
        if (roomAtTop && rs >= LOD.INTERIOR_LABEL_MIN_PX && labelFits(len, rs * 0.9)) cand.push(rs, v, LABEL_KIND_TOP, dim);
        const a = childStart[v]!;
        for (let k = childStart[v + 1]! - 1; k >= a; k--) {
          this.stackNode[sp] = childList[k]!;
          this.stackIn[sp++] = nowIn ? 1 : 0;
        }
      }
    }

    // Largest circles win the label budget.
    const nCand = cand.length / 4;
    let order: number[];
    if (nCand > LOD.MAX_LABELS) {
      order = Array.from({ length: nCand }, (_, k) => k).sort((p, q) => cand[q * 4]! - cand[p * 4]! || cand[p * 4 + 1]! - cand[q * 4 + 1]!);
      order.length = LOD.MAX_LABELS;
      order.sort((p, q) => p - q);
    } else {
      order = Array.from({ length: nCand }, (_, k) => k);
    }
    let nl = 0;
    for (const k of order) {
      this.labelId[nl] = cand[k * 4 + 1]!;
      this.labelKind[nl] = cand[k * 4 + 2]!;
      this.labelAlpha[nl] = cand[k * 4 + 3]!;
      h = Math.imul(h ^ (cand[k * 4 + 1]! + 7919 * cand[k * 4 + 2]!), 16777619);
      nl++;
    }

    h = Math.imul(h ^ count, 16777619) >>> 0;
    this.count = count;
    this.labelCount = nl;
    this.visited = visited;
    const changed = h !== this.hash;
    if (changed) {
      this.hash = h;
      this.version++;
    }
    return changed;
  }

  /** Deepest drawn node containing the world point, or -1. Later entries are deeper (preorder). */
  pick(wx: number, wy: number): number {
    for (let i = this.count - 1; i >= 0; i--) {
      const dx = wx - this.x[i]!;
      const dy = wy - this.y[i]!;
      const r = this.r[i]!;
      if (dx * dx + dy * dy <= r * r) return this.id[i]!;
    }
    return -1;
  }
}
