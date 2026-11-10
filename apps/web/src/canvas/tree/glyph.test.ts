// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { SpeakerRow } from "@/data/bundle";

import { figuresFromRows, glyphParts, glyphRadius, GLYPH_MIN_FIGURE, GLYPH_SCALE, SpeakerStore, type GlyphFigures } from "./glyph";

const none: GlyphFigures = { l1: null, l2: null, total: null, unstated: null };
const kind = (min: number, max = min) => ({ min, max, sources: 1, firstYear: 2020, lastYear: 2020 });

const row = (over: Partial<SpeakerRow> & { value: number }): SpeakerRow =>
  ({
    kind: "L1",
    year: 2020,
    rank: "normal",
    method: null,
    part: null,
    references: [{ retrieved: null, stated_in: null, stated_in_label: "Ethnologue", url: null }],
    disagrees_gt_25pct: false,
    source_id: "wikidata",
    locator: "statement/x",
    retrieved_at: "2026-11-10T00:00:00Z",
    confidence: "medium",
    ...over,
  }) as SpeakerRow;

describe("glyphRadius", () => {
  it("grows with the square root of the figure, between the two clamps", () => {
    const a = glyphRadius(10_000_000);
    const b = glyphRadius(40_000_000);
    expect(b / a).toBeCloseTo(2, 5); // area follows the figure: 4x the figure, 2x the radius
    expect(glyphRadius(GLYPH_SCALE.FULL_AT)).toBeCloseTo(GLYPH_SCALE.FILL, 9);
    expect(glyphRadius(GLYPH_SCALE.FULL_AT * 20)).toBe(GLYPH_SCALE.FILL);
    expect(glyphRadius(1)).toBe(GLYPH_SCALE.MIN_R);
    expect(glyphRadius(GLYPH_MIN_FIGURE * 0.99)).toBe(GLYPH_SCALE.MIN_R);
    expect(glyphRadius(GLYPH_MIN_FIGURE * 1.5)).toBeGreaterThan(GLYPH_SCALE.MIN_R);
  });
});

describe("glyphParts", () => {
  it("no figure: one dotted ring of the fixed minimum size", () => {
    for (const f of [null, none]) {
      expect(glyphParts(f)).toEqual([{ role: "dotted", r: GLYPH_SCALE.MIN_R }]);
    }
  });

  it("only a second-language figure is not drawn as a size: the no-data ring", () => {
    expect(glyphParts({ ...none, l2: kind(5_000_000) })).toEqual([{ role: "dotted", r: GLYPH_SCALE.MIN_R }]);
  });

  it("one L1 figure: a disc and no band", () => {
    const parts = glyphParts({ ...none, l1: kind(25_000_000) });
    expect(parts).toEqual([{ role: "disc", r: glyphRadius(25_000_000) }]);
  });

  it("disagreeing L1 figures: a band from the minimum to the maximum around a disc at the minimum", () => {
    const parts = glyphParts({ ...none, l1: kind(71_435_850, 82_231_620) });
    const band = parts.find((p) => p.role === "band")!;
    const disc = parts.find((p) => p.role === "disc")!;
    expect(disc.r).toBeCloseTo(glyphRadius(71_435_850), 9);
    expect(band.r).toBeCloseTo(glyphRadius(82_231_620), 9);
    expect(band.width).toBeCloseTo(band.r - disc.r, 9);
    expect(parts.indexOf(band)).toBeLessThan(parts.indexOf(disc)); // painted first
  });

  it("total gets a ring at its minimum, L1 stays inside as a disc, both apart", () => {
    const parts = glyphParts({ ...none, l1: kind(20_000_000), total: kind(60_000_000) });
    expect(parts.map((p) => p.role)).toEqual(["disc", "ring"]);
    expect(parts[1]!.r).toBeGreaterThan(parts[0]!.r);
  });

  it("kind not stated only: a dashed ring and a band, never a disc", () => {
    const parts = glyphParts({ ...none, unstated: kind(30_000_000, 36_000_000) });
    expect(parts.map((p) => p.role)).toEqual(["band", "dashed"]);
  });

  it("kind not stated never draws when a first-language or total figure exists", () => {
    const parts = glyphParts({ ...none, l1: kind(10_000_000), unstated: kind(70_000_000) });
    expect(parts.map((p) => p.role)).toEqual(["disc"]);
  });

  it("a range under the minimum size or over the cap has no visible band", () => {
    expect(glyphParts({ ...none, l1: kind(1_000, 2_000) }).map((p) => p.role)).toEqual(["disc"]);
    expect(glyphParts({ ...none, l1: kind(2e8, 9e8) }).map((p) => p.role)).toEqual(["disc"]);
  });
});

describe("figuresFromRows", () => {
  it("keeps kinds apart and never averages", () => {
    const f = figuresFromRows([
      row({ value: 71_435_850, year: 2006 }),
      row({ value: 82_231_620, year: 2021 }),
      row({ kind: "total", value: 90_000_000, year: 2019 }),
      row({ kind: "unknown", value: 70_000_000 }),
    ]);
    expect(f.l1).toMatchObject({ min: 71_435_850, max: 82_231_620, firstYear: 2006, lastYear: 2021 });
    expect(f.total).toMatchObject({ min: 90_000_000, max: 90_000_000 });
    expect(f.unstated).toMatchObject({ min: 70_000_000 });
    expect(f.l2).toBeNull();
  });

  it("drops deprecated rows and rows that reached the node only through attached_via", () => {
    const f = figuresFromRows([
      row({ value: 1_000_000, rank: "deprecated" }),
      { ...row({ value: 9_000_000 }), attached_via: "wikidata_iso_match" } as SpeakerRow,
    ]);
    expect(f.l1).toBeNull();
  });
});

describe("SpeakerStore", () => {
  const layout = { glottocode: ["aaaa1111", "bbbb2222"], anyMax: new Float64Array([NaN, 5_000_000]) };

  it("needs no request for a language without a figure", () => {
    let calls = 0;
    const store = new SpeakerStore(layout, async () => {
      calls++;
      return [];
    });
    expect(store.state(0)).toBe("none");
    store.request([0]);
    expect(calls).toBe(0);
  });

  it("loads a language once and reports ready, then notifies", async () => {
    let calls = 0;
    const store = new SpeakerStore(layout, async () => {
      calls++;
      return [row({ value: 5_000_000 })];
    });
    let changed = 0;
    store.onChange = () => changed++;
    expect(store.state(1)).toBe("pending");
    store.request([1]);
    store.request([1]);
    await store.ensure(1);
    expect(store.state(1)).toBe("ready");
    expect(store.figures(1)?.l1?.min).toBe(5_000_000);
    expect(calls).toBe(1);
    expect(changed).toBe(1);
    expect(store.revision).toBe(1);
  });

  it("a failed request is an error state, not a guess", async () => {
    const store = new SpeakerStore(layout, async () => null);
    await store.ensure(1);
    expect(store.state(1)).toBe("error");
    expect(store.figures(1)).toBeNull();
  });
});
