// Circle-pack layout of every Glottolog languoid, computed once (never per frame).
//
// Size rule (shown in the UI): circle AREA is the number of entries below a node.
//   A language counts 1, a dialect counts 0.25, a family with nothing below counts 1.
// A language that has dialects also keeps a hidden slot of 1 for itself, so a language with
// dialects is never drawn smaller than one without. Speaker numbers are NOT used for packing: only
// 364 of 27,177 languoids have an L1 figure. The speaker glyph (glyph.ts) is drawn inside the one-entry
// slot of each language (unitR, selfX, selfY), so the layout never implies a figure.
//
// The same function runs in a Web Worker (layout.worker.ts) and in tests.

import { hierarchy, pack } from "d3-hierarchy";

import { familyIndexOf, OTHER_INDEX } from "./family";

export const WORLD_LABEL = "World";
/** Radius of the root circle in world units. Everything else is relative. */
export const WORLD_RADIUS = 1000;
export const LAYOUT_RULE = {
  language: 1,
  dialect: 0.25,
  emptyFamily: 1,
  languageSelfSlot: 1,
  padding: 0.25,
} as const;
export const SIZE_RULE_TEXT =
  "Circle area is the number of entries below. A language counts 1, a dialect 0.25. Not speakers.";

export type TreeRow = [
  glottocode: string,
  parentIndex: number,
  level: number,
  name: string,
  childCount: number,
  l1Max: number | null,
  l1Source: number | null,
  anyMax: number | null,
  anySource: number | null,
];

export interface TreeFile {
  columns: string[];
  format?: string;
  nodes: TreeRow[];
}

export const LEVEL_FAMILY = 0;
export const LEVEL_LANGUAGE = 1;
export const LEVEL_DIALECT = 2;
export const LEVEL_WORLD = 3;

export interface TreeStructure {
  /** Real languoids. The synthetic World node has index `root` = n. */
  n: number;
  root: number;
  glottocode: string[];
  name: string[];
  parent: Int32Array;
  level: Uint8Array;
  depth: Uint16Array;
  /** Children of i are childList[childStart[i] .. childStart[i + 1]), largest first after layout. */
  childStart: Int32Array;
  childList: Int32Array;
  /** Languages (level 1) in the subtree, counting the node itself. */
  languages: Uint32Array;
  /** Index into FAMILY_ORDER. */
  family: Uint8Array;
  /**
   * Largest non-deprecated speaker figure of kind L1 and of any kind, from tree.json (NaN = none).
   * Rows that reached a node only through attached_via are already left out by the pipeline.
   * Used to decide whether a language has any figure at all; never summed, never averaged.
   */
  l1Max: Float64Array;
  anyMax: Float64Array;
}

export interface TreeLayout extends TreeStructure {
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  /**
   * Radius of the one-entry slot that every language gets (leaf language, or the hidden self slot of
   * a language with dialects). The speaker glyph is drawn inside it. 0 when the tree has no language.
   */
  unitR: number;
  /** Center of that slot, per node (meaningful for languages only). */
  selfX: Float32Array;
  selfY: Float32Array;
  /** Wall time spent packing, ms (excludes JSON parse). */
  packMs: number;
}

interface PackDatum {
  id: number; // -1 = hidden self slot
  w: number;
  kids?: PackDatum[];
}

function now(): number {
  return globalThis.performance?.now() ?? Date.now();
}

/** Pure structure: CSR children, depth, language counts, family. No geometry yet. */
export function buildStructure(file: TreeFile): TreeStructure {
  const rows = file.nodes;
  const n = rows.length;
  const root = n;
  const glottocode = new Array<string>(n + 1);
  const name = new Array<string>(n + 1);
  const parent = new Int32Array(n + 1).fill(-1);
  const level = new Uint8Array(n + 1);
  const counts = new Int32Array(n + 2);

  for (let i = 0; i < n; i++) {
    const row = rows[i]!;
    glottocode[i] = row[0];
    name[i] = row[3];
    level[i] = row[2];
    const p = row[1] < 0 ? root : row[1];
    parent[i] = p;
    counts[p]!++;
  }
  glottocode[root] = "";
  name[root] = WORLD_LABEL;
  level[root] = LEVEL_WORLD;

  const childStart = new Int32Array(n + 2);
  for (let i = 0; i <= root; i++) childStart[i + 1] = childStart[i]! + counts[i]!;
  const fill = childStart.slice(0, n + 1);
  const childList = new Int32Array(n);
  for (let i = 0; i < n; i++) childList[fill[parent[i]!]!++] = i;

  // Parents may come after children in the file, so walk breadth-first from the root.
  const depth = new Uint16Array(n + 1);
  const order = new Int32Array(n + 1);
  let head = 0;
  let tail = 0;
  order[tail++] = root;
  while (head < tail) {
    const v = order[head++]!;
    for (let k = childStart[v]!; k < childStart[v + 1]!; k++) {
      const c = childList[k]!;
      depth[c] = depth[v]! + 1;
      order[tail++] = c;
    }
  }
  const languages = new Uint32Array(n + 1);
  for (let k = tail - 1; k >= 0; k--) {
    const v = order[k]!;
    if (level[v] === LEVEL_LANGUAGE) languages[v]!++;
    const p = parent[v]!;
    if (p >= 0) languages[p] = languages[p]! + languages[v]!;
  }

  const l1Max = new Float64Array(n + 1).fill(NaN);
  const anyMax = new Float64Array(n + 1).fill(NaN);
  for (let i = 0; i < n; i++) {
    const row = rows[i]!;
    if (typeof row[5] === "number") l1Max[i] = row[5];
    if (typeof row[7] === "number") anyMax[i] = row[7];
  }

  const family = new Uint8Array(n + 1).fill(OTHER_INDEX);
  for (let k = childStart[root]!; k < childStart[root + 1]!; k++) {
    const top = childList[k]!;
    family[top] = familyIndexOf(glottocode[top]!, name[top]!);
  }
  for (let k = 1; k < tail; k++) {
    const v = order[k]!;
    if (parent[v] !== root) family[v] = family[parent[v]!]!;
  }

  return { n, root, glottocode, name, parent, level, depth, childStart, childList, languages, family, l1Max, anyMax };
}

export function computeLayout(file: TreeFile): TreeLayout {
  const s = buildStructure(file);
  const t0 = now();
  const { n, root, childStart, childList, level } = s;

  const make = (v: number): PackDatum => {
    const a = childStart[v]!;
    const b = childStart[v + 1]!;
    if (a === b) {
      const w =
        level[v] === LEVEL_DIALECT
          ? LAYOUT_RULE.dialect
          : level[v] === LEVEL_LANGUAGE
            ? LAYOUT_RULE.language
            : LAYOUT_RULE.emptyFamily;
      return { id: v, w };
    }
    const kids: PackDatum[] = [];
    if (level[v] === LEVEL_LANGUAGE) kids.push({ id: -1, w: LAYOUT_RULE.languageSelfSlot });
    for (let k = a; k < b; k++) kids.push(make(childList[k]!));
    return { id: v, w: 0, kids };
  };
  // Recursion depth equals tree depth (26 in the current data), which is safe.
  const rootDatum = make(root);

  const h = hierarchy<PackDatum>(rootDatum, (d) => d.kids)
    .sum((d) => (d.kids ? 0 : d.w))
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || a.data.id - b.data.id);
  const packed = pack<PackDatum>()
    .size([WORLD_RADIUS * 2, WORLD_RADIUS * 2])
    .padding(LAYOUT_RULE.padding)(h);

  const x = new Float32Array(n + 1);
  const y = new Float32Array(n + 1);
  const r = new Float32Array(n + 1);
  const selfX = new Float32Array(n + 1);
  const selfY = new Float32Array(n + 1);
  let unitR = 0;
  // Copy geometry and reorder each CSR child list to the packed order (largest first).
  packed.each((node) => {
    const id = node.data.id;
    if (id < 0) {
      const owner = node.parent?.data.id;
      if (owner !== undefined && owner >= 0) {
        selfX[owner] = node.x - WORLD_RADIUS;
        selfY[owner] = node.y - WORLD_RADIUS;
        if (unitR === 0) unitR = node.r;
      }
      return;
    }
    x[id] = node.x - WORLD_RADIUS;
    y[id] = node.y - WORLD_RADIUS;
    r[id] = node.r;
    if (level[id] === LEVEL_LANGUAGE && !node.children) {
      selfX[id] = x[id]!;
      selfY[id] = y[id]!;
      if (unitR === 0) unitR = node.r;
    }
    if (node.children) {
      let k = childStart[id]!;
      for (const c of node.children) if (c.data.id >= 0) childList[k++] = c.data.id;
    }
  });

  return { ...s, x, y, r, unitR, selfX, selfY, packMs: now() - t0 };
}
