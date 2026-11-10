import { describe, expect, it } from "vitest";

import { familyDeeper, languageDeeper, targetKey, worldDeeper } from "./deeper";
import { EMPTY_INDEX, type ScopeIndex } from "./scopeIndex";

// Synthetic fixture: made-up codes (fam?1111, lang?1111) and names, so nothing here reads as data.
const index: ScopeIndex = {
  built: true,
  labels: {},
  pilots: ["langa111"],
  topFamilies: [
    { g: "fama1111", name: "Family A", languages: 300 },
    { g: "famb1111", name: "Family B", languages: 200 },
    { g: "famc1111", name: "Family C", languages: 100 },
  ],
  families: [
    { g: "fama1111", name: "Family A", parent: null, top: "fama1111", macroareas: ["Eurasia"], languages: 300, dialects: 10 },
    { g: "fama2222", name: "Branch A2", parent: "fama1111", top: "fama1111", macroareas: ["Eurasia"], languages: 20, dialects: 2 },
    { g: "famb1111", name: "Family B", parent: null, top: "famb1111", macroareas: ["Eurasia"], languages: 200, dialects: 5 },
  ],
  langs: [
    { g: "langa111", label: "Lang A1", level: "language", lineage: ["fama1111", "fama2222"], top: "fama1111", macroarea: "Eurasia", terr: [["XA", 90, 1]], dialects: 3, iso: null, decided: true, confidence: "high", names: [], parentName: "Branch A2" },
    { g: "langa222", label: "Lang A2", level: "language", lineage: ["fama1111", "fama2222"], top: "fama1111", macroarea: "Eurasia", terr: [["XB", 50, 0]], dialects: 1, iso: null, decided: true, confidence: "high", names: [], parentName: "Branch A2" },
    { g: "langb111", label: "Lang B1", level: "language", lineage: ["famb1111"], top: "famb1111", macroarea: "Eurasia", terr: [["XA", 8, 0]], dialects: 0, iso: null, decided: true, confidence: "high", names: [], parentName: "Family B" },
  ],
};

const lineage = [
  { glottocode: "fama1111", name: "Family A" },
  { glottocode: "fama2222", name: "Branch A2" },
];

const distinct = (cards: { target: Parameters<typeof targetKey>[0] }[]) => new Set(cards.map((c) => targetKey(c.target))).size;

describe("Go deeper fallback (spec 4.8)", () => {
  it("language: nearest scope language, another family sharing a territory, its top family", () => {
    const cards = languageDeeper(index, { glottocode: "langa111", label: "Lang A1", lineage, macroarea: "Eurasia", territories: [{ iso: "XA", share: 90 }], lens: "tree" });
    expect(cards.map((c) => c.kind).slice(0, 3)).toEqual(["related", "contrast", "surprise"]);
    expect(cards[0]!.target).toEqual({ type: "language", glottocode: "langa222" });
    expect(cards[1]!.target).toEqual({ type: "language", glottocode: "langb111" });
    expect(cards[2]!.target).toEqual({ type: "family", glottocode: "fama1111" });
    expect(distinct(cards)).toBe(cards.length);
  });

  it("always reaches three distinct exits, even without built data", () => {
    for (const cards of [
      languageDeeper(EMPTY_INDEX, { glottocode: "zzzz9999", label: "x", lineage: [], macroarea: null, territories: [], lens: "tree" }),
      familyDeeper(EMPTY_INDEX, { glottocode: "zzzz9999", label: "x", lineage: [], macroareas: [], lens: "map" }),
      // The world view as CI builds it: scope-list families only, no counts and no pilots.
      worldDeeper({ ...EMPTY_INDEX, families: index.families.map((x) => ({ ...x, languages: null, dialects: null })) }, "tree"),
    ]) {
      expect(cards.length).toBeGreaterThanOrEqual(3);
      expect(distinct(cards)).toBe(cards.length);
    }
  });

  it("family: parent, another top-level family in the macroarea, the member with most dialects", () => {
    const cards = familyDeeper(index, { glottocode: "fama2222", label: "Branch A2", lineage: [lineage[0]!], macroareas: ["Eurasia"], lens: "tree" });
    expect(cards[0]!.target).toEqual({ type: "family", glottocode: "fama1111" });
    expect(cards[1]!.target).toEqual({ type: "family", glottocode: "famb1111" });
    expect(cards[2]!.target).toEqual({ type: "language", glottocode: "langa111" });
  });

  it("world: pilots, then the largest top-level families", () => {
    const cards = worldDeeper(index, "tree");
    expect(cards.map((c) => targetKey(c.target))).toEqual(["language:langa111:", "family:fama1111:", "family:famb1111:", "family:famc1111:"]);
  });
});
