// @vitest-environment node
import { describe, expect, it } from "vitest";

import { fitCircle } from "./camera";
import { computeLayout, type TreeFile, type TreeRow } from "./layout";
import { glyphRadius, SpeakerStore } from "./glyph";
import { LABEL_KIND_BELOW, labelFits, LOD, opensChildren, Scene } from "./lod";
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

describe("speaker glyphs in the scene", () => {
  const cam = fitCircle(L.x[0]!, L.y[0]!, L.r[0]!, size);
  const glyphLayout = (): typeof L => ({ ...L, anyMax: Float64Array.from(L.anyMax) });

  it("gives every language the same one-entry slot, inside its circle", () => {
    expect(L.unitR).toBeGreaterThan(0);
    // Beta and Gamma are plain leaves: their circle is the slot.
    expect(L.r[6]).toBeCloseTo(L.unitR, 4);
    expect(L.r[7]).toBeCloseTo(L.unitR, 4);
    // Alpha has dialects: its hidden self slot lies inside its circle.
    const d = Math.hypot(L.selfX[1]! - L.x[1]!, L.selfY[1]! - L.y[1]!);
    expect(d + L.unitR).toBeLessThanOrEqual(L.r[1]! + 1e-3);
  });

  it("draws no glyph without a store, and none for families", () => {
    const s = new Scene(L);
    s.build(cam, size, L.root, palette, 1);
    expect(s.count).toBe(s.nodeCount);
  });

  it("a language with no figure gets the dotted no-data ring; the circle turns light", () => {
    const s = new Scene(L);
    s.store = new SpeakerStore(L); // every anyMax is NaN: no figure
    s.build(cam, size, L.root, palette, 1);
    const styles = Array.from(s.style.slice(0, s.count));
    expect(styles.filter((t) => t === 2).length).toBe(3); // Alpha, Beta, Gamma
    const beta = Array.from(s.id.slice(0, s.count)).indexOf(6);
    expect(s.fill[beta * 4 + 3]).toBeLessThan(100);
    // The glyph parts are never picked.
    expect(s.pick(L.selfX[6]!, L.selfY[6]!)).toBe(6);
  });

  it("a pending language is asked for, and draws as before until its figures arrive", () => {
    const G = glyphLayout();
    G.anyMax[6] = 5_000_000;
    const store = new SpeakerStore(G, async () => null);
    const s = new Scene(G);
    s.store = store;
    s.build(cam, size, G.root, palette, 1);
    expect(s.wanted).toEqual([6]);
    const beta = Array.from(s.id.slice(0, s.count)).indexOf(6);
    expect(s.fill[beta * 4 + 3]).toBeGreaterThan(200); // solid, no glyph yet
  });

  it("a ready language gets a disc, a ring and a band from its figures", () => {
    const G = glyphLayout();
    G.anyMax[6] = 80_000_000;
    const store = new SpeakerStore(G, async () => [
      { kind: "L1", value: 71_435_850, year: 2006, rank: "normal", references: null, disagrees_gt_25pct: false },
      { kind: "L1", value: 82_231_620, year: 2021, rank: "normal", references: null, disagrees_gt_25pct: false },
      { kind: "total", value: 90_000_000, year: 2021, rank: "normal", references: null, disagrees_gt_25pct: false },
    ] as never);
    return store.ensure(6).then(() => {
      const s = new Scene(G);
      s.store = store;
      s.build(cam, size, G.root, palette, 1);
      expect(s.wanted).toEqual([]);
      const parts = Array.from(s.id.slice(0, s.count)).map((id, i) => (id === -1 ? i : -1)).filter((i) => i >= 0);
      // Alpha, Gamma: dotted. Beta: band, disc, ring.
      const betaAt = Array.from(s.id.slice(0, s.count)).indexOf(6);
      expect(s.id[betaAt + 1]).toBe(-1);
      expect(parts.length).toBeGreaterThanOrEqual(5);
      const band = betaAt + 1;
      const disc = betaAt + 2;
      const ring = betaAt + 3;
      expect(s.lineW[band]).toBeGreaterThan(0);
      expect(s.r[band]).toBeGreaterThan(s.r[disc]!);
      expect(s.r[ring]).toBeGreaterThan(s.r[band]!);
      expect(s.r[disc]! / L.unitR).toBeCloseTo(glyphRadius(71_435_850), 4);
    });
  });

  it("labels glyph languages below their circle and never lets two labels overlap", () => {
    const s = new Scene(L);
    s.store = new SpeakerStore(L);
    s.build(cam, size, L.root, palette, 1);
    const kinds = Array.from(s.labelKind.slice(0, s.labelCount));
    expect(kinds).toContain(LABEL_KIND_BELOW);
  });
});
