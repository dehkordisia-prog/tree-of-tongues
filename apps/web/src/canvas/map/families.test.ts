import { describe, expect, it } from "vitest";

import { FAMILY_ORDER, OTHER_INDEX, ROOT_TO_FAMILY, familyIndexByGlottocode } from "./families";

// Tuples: [glottocode, parent_index, level, name]
const tree = {
  nodes: [
    ["indo1319", -1, 0, "Indo-European"],
    ["germ1287", 0, 0, "Germanic"],
    ["stan1293", 1, 1, "English"],
    ["mand1469", -1, 0, "Mande"],
    ["bamb1269", 3, 1, "Bambara"],
    ["atla1278", -1, 0, "Atlantic-Congo"],
    ["yoru1245", 5, 1, "Yoruba"],
    ["basq1248", -1, 0, "Basque"],
  ],
} as const;

describe("familyIndexByGlottocode", () => {
  const index = familyIndexByGlottocode(tree);
  const family = (code: string) => FAMILY_ORDER[index.get(code)!];

  it("colors by the top-level Glottolog family", () => {
    expect(family("stan1293")).toBe("indo-european");
    expect(family("germ1287")).toBe("indo-european");
    expect(family("yoru1245")).toBe("niger-congo");
  });

  it("keeps Mande and isolates in other", () => {
    expect(index.get("bamb1269")).toBe(OTHER_INDEX);
    expect(index.get("basq1248")).toBe(OTHER_INDEX);
  });

  it("maps only known token families", () => {
    for (const id of Object.values(ROOT_TO_FAMILY)) expect(FAMILY_ORDER).toContain(id);
  });
});
