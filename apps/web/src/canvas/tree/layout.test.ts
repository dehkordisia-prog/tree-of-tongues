// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FAMILY_ORDER, familyIndexOf, familyMismatches } from "./family";
import { computeLayout, LAYOUT_RULE, type TreeFile, type TreeRow } from "./layout";

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

// Index: 0 fam (indo1319), 1 langA (2 dialects), 2 dialect, 3 dialect, 4 langB, 5 isolate (root language)
const tiny: TreeFile = {
  columns: [],
  nodes: [
    row("indo1319", -1, 0, "Indo-European", 2),
    row("lang0001", 0, 1, "Alpha", 2),
    row("dial0001", 1, 2, "Alpha North", 0),
    row("dial0002", 1, 2, "Alpha South", 0),
    row("lang0002", 0, 1, "Beta", 0),
    row("isol0001", -1, 1, "Lone", 0),
  ],
};

describe("computeLayout", () => {
  const L = computeLayout(tiny);

  it("adds a World root after the real nodes and counts languages", () => {
    expect(L.root).toBe(6);
    expect(L.languages[0]).toBe(2);
    expect(L.languages[L.root]).toBe(3);
  });

  it("keeps every child inside its parent", () => {
    for (let i = 0; i < L.n; i++) {
      const p = L.parent[i]!;
      const d = Math.hypot(L.x[i]! - L.x[p]!, L.y[i]! - L.y[p]!);
      expect(d + L.r[i]!).toBeLessThanOrEqual(L.r[p]! + 1e-3);
    }
  });

  it("sizes by the documented rule: a language outweighs a dialect", () => {
    expect(LAYOUT_RULE.language).toBeGreaterThan(LAYOUT_RULE.dialect);
    expect(L.r[4]!).toBeGreaterThan(L.r[2]!);
    expect(L.r[1]!).toBeGreaterThanOrEqual(L.r[4]! - 1e-3);
  });

  it("orders children largest first", () => {
    const kids = Array.from(L.childList.slice(L.childStart[0], L.childStart[1]));
    expect(kids[0]).toBe(1);
  });

  it("colors descendants like their top-level family", () => {
    expect(FAMILY_ORDER[L.family[2]!]).toBe("indo-european");
    expect(FAMILY_ORDER[L.family[5]!]).toBe("other");
  });
});

describe("family mapping", () => {
  it("applies a token only when the Glottolog name matches", () => {
    expect(FAMILY_ORDER[familyIndexOf("indo1319", "Indo-European")]).toBe("indo-european");
    expect(FAMILY_ORDER[familyIndexOf("indo1319", "Something else")]).toBe("other");
    expect(FAMILY_ORDER[familyIndexOf("atla1278", "Atlantic-Congo")]).toBe("niger-congo");
    expect(FAMILY_ORDER[familyIndexOf("zzzz9999", "Anything")]).toBe("other");
  });

  it("reports missing and renamed families", () => {
    const report = familyMismatches([{ glottocode: "indo1319", name: "Indo-European (renamed)" }]);
    expect(report.find((m) => m.glottocode === "indo1319")?.found).toBe("Indo-European (renamed)");
    expect(report.find((m) => m.glottocode === "sino1245")?.found).toBeNull();
  });
});

// Real data is gitignored and absent in CI.
const dataPath = path.resolve(import.meta.dirname, "../../../../../data/build/tree.json");
// describe.skipIf still runs this callback while collecting, so the file is read lazily.
describe.skipIf(!fs.existsSync(dataPath))("with data/build/tree.json", () => {
  let cached: TreeFile | null = null;
  const load = () => (cached ??= JSON.parse(fs.readFileSync(dataPath, "utf8")) as TreeFile);

  it("maps all 11 named families without mismatches", () => {
    const file = load();
    const nodes = file.nodes.map((r) => ({ glottocode: r[0], name: r[3] }));
    expect(familyMismatches(nodes)).toEqual([]);
  });

  it("packs every languoid and reports the timing", () => {
    const file = load();
    const L = computeLayout(file);
    console.info(`pack ${L.n} nodes in ${L.packMs.toFixed(0)} ms, world r=${L.r[L.root]}`);
    expect(L.n).toBe(file.nodes.length);
    let bad = 0;
    for (let i = 0; i < L.n; i++) {
      const p = L.parent[i]!;
      if (Math.hypot(L.x[i]! - L.x[p]!, L.y[i]! - L.y[p]!) + L.r[i]! > L.r[p]! + 0.05) bad++;
    }
    expect(bad).toBe(0);
  });
});
