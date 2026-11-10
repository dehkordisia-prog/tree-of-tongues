import { describe, expect, it } from "vitest";

import type { LanguagePoints } from "./data";
import { buildSearchIndex, displayName, normalize, searchNames } from "./search";

const points = {
  count: 4,
  glottocodes: ["stan1293", "west2369", "stan1295", "dial0001"],
  names: ["English", "Western Farsi", "German", "Fiji English"], // Glottolog name; alias test data
  levels: new Uint8Array([1, 1, 1, 2]),
} as unknown as LanguagePoints;

describe("search", () => {
  const entries = buildSearchIndex(points);

  it("normalizes marks and case", () => {
    expect(normalize("Türkçe")).toBe("turkce");
    expect(normalize("fārsi")).toBe("farsi"); // alias folding
  });

  it("ranks exact, then prefix, then word prefix; languages before dialects", () => {
    const hits = searchNames(entries, points.levels, "english");
    expect(hits.map((h) => h.index)).toEqual([0, 3]);
  });

  it("finds Persian by its aliases and shows the English UI name", () => {
    expect(displayName("west2369", "Western Farsi")).toBe("Persian"); // alias lookups
    for (const q of ["persian", "farsi", "fārsi"]) { // alias lookups
      expect(searchNames(entries, points.levels, q).map((h) => h.index)).toContain(1);
    }
  });

  it("needs two letters", () => {
    expect(searchNames(entries, points.levels, "e")).toEqual([]);
  });
});
