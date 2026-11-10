// @vitest-environment node
import { describe, expect, it } from "vitest";

import { describeSpeakers, formatFigureRange } from "./describe";
import type { GlyphFigures } from "./glyph";

const none: GlyphFigures = { l1: null, l2: null, total: null, unstated: null };

describe("formatFigureRange", () => {
  it("shares the unit when both ends have it", () => {
    expect(formatFigureRange(71_435_850, 82_231_620)).toBe("71.4 to 82.2 million");
  });
  it("shows one figure when the ends round the same", () => {
    expect(formatFigureRange(16_000_000, 16_000_000)).toBe("16 million");
  });
  it("keeps both units when they differ", () => {
    expect(formatFigureRange(900_000, 1_200_000)).toBe("900 thousand to 1.2 million");
  });
});

describe("describeSpeakers", () => {
  it("reads the Turkish example from data", () => {
    const f: GlyphFigures = { ...none, l1: { min: 71_435_850, max: 82_231_620, sources: 5, firstYear: 2006, lastYear: 2021 } };
    expect(describeSpeakers(f)).toBe("First-language speakers: 71.4 to 82.2 million, 5 sources, 2006 to 2021.");
  });
  it("one source, one year, singular", () => {
    const f: GlyphFigures = { ...none, l1: { min: 16_000_000, max: 16_000_000, sources: 1, firstYear: 2019, lastYear: 2019 } };
    expect(describeSpeakers(f)).toBe("First-language speakers: 16 million, 1 source, 2019.");
  });
  it("omits the years when no source gives one", () => {
    const f: GlyphFigures = { ...none, total: { min: 3_000_000, max: 3_000_000, sources: 2, firstYear: null, lastYear: null } };
    expect(describeSpeakers(f)).toBe("Total speakers: 3 million, 2 sources.");
  });
  it("keeps kinds apart, L1 first, and names the unstated kind", () => {
    const f: GlyphFigures = {
      l1: { min: 10_000_000, max: 10_000_000, sources: 1, firstYear: 2010, lastYear: 2010 },
      l2: { min: 5_000_000, max: 6_000_000, sources: 2, firstYear: 2011, lastYear: 2012 },
      total: null,
      unstated: { min: 70_000_000, max: 70_000_000, sources: 1, firstYear: 2019, lastYear: 2019 },
    };
    const text = describeSpeakers(f);
    expect(text.indexOf("First-language")).toBeLessThan(text.indexOf("kind not stated"));
    expect(text).toContain("Speakers, kind not stated: 70 million, 1 source, 2019.");
    expect(text).toContain("Second-language speakers: 5 to 6 million, 2 sources, 2011 to 2012.");
  });
  it("says so when there is no figure", () => {
    expect(describeSpeakers(null)).toBe("No speaker figure yet.");
    expect(describeSpeakers(none)).toBe("No speaker figure yet.");
  });
});
