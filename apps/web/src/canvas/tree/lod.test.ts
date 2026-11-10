// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fitCircle } from "./camera";
import { computeLayout, type TreeFile, type TreeRow } from "./layout";
import { labelFits, LOD, opensChildren, Scene } from "./lod";
import { makePalette } from "./palette";

const row = (code: string, parent: number, level: number, name: string, kids: number): TreeRow => [
  code,
  parent,
  level,
  name,
  kids,
  null,
  null,
  null,
  null,
];

// 0 family -> 1 Alpha (language with 4 dialects 2..5), 6 Beta (language), 7 Gamma (language)
const file: TreeFile = {
  columns: [],
  nodes: [
    row("fam00001", -1, 0, "Family", 3),
    row("lang0001", 0, 1, "Alpha", 4),
    row("dial0001", 1, 2, "Alpha 1", 0),
    row("dial0002", 1, 2, "Alpha 2", 0),
    row("dial0003", 1, 2, "Alpha 3", 0),
    row("dial0004", 1, 2, "Alpha 4", 0),
    row("lang0002", 0, 1, "Beta", 0),
    row("lang0003", 0, 1, "Gamma", 0),
  ],
};
const L = computeLayout(file);
const palette = makePalette("night");
const size = { w: 1000, h: 800 };

describe("thresholds", () => {
  it("opens language children (dialects) later than family children", () => {
    // Family (node 0) has language children, Alpha (node 1) has dialect children.
    expect(opensChildren(L, 0, LOD.OPEN_PX)).toBe(true);
    expect(opensChildren(L, 0, LOD.OPEN_PX - 1)).toBe(false);
    expect(opensChildren(L, 1, LOD.OPEN_PX)).toBe(false);
    expect(opensChildren(L, 1, LOD.OPEN_DIALECT_PX)).toBe(true);
  });

  it("never opens a leaf", () => {
    expect(opensChildren(L, 6, 1e6)).toBe(false);
  });

  it("labels only names that fit the circle", () => {
    expect(labelFits(5, 20)).toBe(true);
    expect(labelFits(30, 20)).toBe(false);
    expect(LOD.LABEL_MIN_PX).toBeGreaterThan(LOD.OPEN_PX);
    expect(LOD.OPEN_DIALECT_PX).toBeGreaterThan(LOD.OPEN_PX);
  });
});

describe("Scene.build", () => {
  // A small camera scale stands in for the whole world: tiny test trees fill the root circle.
  const world = { cx: 0, cy: 0, scale: 0.02 };

  it("draws the family and its languages at world scale, not the dialects", () => {
    const s = new Scene(L);
    s.build(world, size, L.root, palette, 1);
    const ids = Array.from(s.id.slice(0, s.count));
    expect(ids).toContain(0);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it("draws dialects once their language is large on screen", () => {
    const s = new Scene(L);
    const cam = fitCircle(L.x[1]!, L.y[1]!, L.r[1]!, size);
    s.build(cam, size, 1, palette, 1);
    expect(Array.from(s.id.slice(0, s.count))).toContain(2);
  });

  it("skips subtrees outside the viewport", () => {
    const s = new Scene(L);
    s.build({ cx: 1e6, cy: 1e6, scale: 1 }, size, L.root, palette, 1);
    expect(s.count).toBe(0);
  });

  it("dims everything outside the focused node", () => {
    const s = new Scene(L);
    const cam = fitCircle(L.x[0]!, L.y[0]!, L.r[0]!, size);
    s.build(cam, size, 1, palette, 1);
    const alphaOf = (id: number) => {
      const i = Array.from(s.id.slice(0, s.count)).indexOf(id);
      expect(i).toBeGreaterThanOrEqual(0);
      return s.fill[i * 4 + 3]!;
    };
    // Dialect 2 is inside the focus (Alpha); Beta (6) is a sibling and is dimmed.
    expect(alphaOf(2)).toBeGreaterThan(alphaOf(6));
  });

  it("reports a change only when content changes", () => {
    const s = new Scene(L);
    expect(s.build(world, size, L.root, palette, 1)).toBe(true);
    const v = s.version;
    expect(s.build(world, size, L.root, palette, 1)).toBe(false);
    expect(s.version).toBe(v);
    expect(s.build(world, size, L.root, palette, 2)).toBe(true);
  });

  it("caps labels", () => {
    const s = new Scene(L);
    s.build(fitCircle(L.x[1]!, L.y[1]!, L.r[1]!, size), size, 1, palette, 1);
    expect(s.labelCount).toBeLessThanOrEqual(LOD.MAX_LABELS);
  });

  it("picks the deepest drawn node under a point", () => {
    const s = new Scene(L);
    const cam = fitCircle(L.x[1]!, L.y[1]!, L.r[1]!, size);
    s.build(cam, size, 1, palette, 1);
    expect(s.pick(L.x[2]!, L.y[2]!)).toBe(2);
    expect(s.pick(1e6, 1e6)).toBe(-1);
  });
});
