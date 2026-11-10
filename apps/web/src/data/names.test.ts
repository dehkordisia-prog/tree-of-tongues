// docs/specs/persian.md section 2 (D-030, D-004, D-029). Labels proposed in docs/reviews/farsic-labels.md;
// provisional until the owner approves them. Tests marked it.skip are pending until the labels land.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { labelFor } from "./names";
import { parseYaml } from "./yamlLite";

const SCOPE = path.resolve(import.meta.dirname, "../../../../content/scope/phase-1-languages.yaml");
type Raw = Record<string, unknown>;
const scope = parseYaml(fs.readFileSync(SCOPE, "utf8")) as Raw;
const families = (scope.families as Raw[]) ?? [];
const family = (g: string) => families.find((f) => f.glottocode === g);

const ALIAS = /\bfarsi/i; // the D-004 alias, also inside Glottolog names such as Farsic

const LABELS: Record<string, string> = {
  fars1254: "Persian and Caucasian Tat",
  fars1255: "Persian group",
  east2745: "Eastern Persian group",
};

describe("display labels (D-004, D-029)", () => {
  it("shows west2369 as Iranian Persian, never as Glottolog's name", () => {
    expect(labelFor("west2369", "Western Farsi")).toBe("Iranian Persian"); // lint-allow: Glottolog's name
  });

  it("lets the scope list's label win over the fallback", () => {
    expect(labelFor("west2369", "x", { west2369: "Scope label" })).toBe("Scope label");
  });

  it("keeps Fars Dialects and Tajikic as Glottolog names them (review: no change)", () => {
    expect(labelFor("sout2645", "Fars Dialects")).toBe("Fars Dialects");
    expect(labelFor("taji1250", "Tajikic")).toBe("Tajikic");
  });
});

describe("pending: Farsic family labels (spec section 2)", () => {
  it.skip("the scope list carries the three display labels with their decision", () => {
    for (const [g, label] of Object.entries(LABELS)) {
      const f = family(g)!;
      expect(f, g).toBeDefined();
      expect(f.display_name, g).toBe(label);
      expect(f.display_name_decision, g).toBe("D-030");
    }
  });

  it.skip("no family display label carries the alias, and fars1254 names Caucasian Tat", () => {
    for (const f of families) {
      const label = (f.display_name ?? f.name) as string;
      expect(label, String(f.glottocode)).not.toMatch(ALIAS);
    }
    expect(family("fars1254")!.display_name).toMatch(/Caucasian Tat/);
  });

  it.skip("no node is labeled plain Persian, which D-029 keeps for the group", () => {
    for (const f of families) expect(f.display_name ?? f.name, String(f.glottocode)).not.toBe("Persian");
  });

  it.skip("labelFor resolves the scope labels for the three nodes", () => {
    const labels = Object.fromEntries(
      families.filter((f) => f.display_name).map((f) => [f.glottocode as string, f.display_name as string]),
    );
    expect(labelFor("fars1254", "Farsic-Caucasian Tat", labels)).toBe(LABELS.fars1254);
    expect(labelFor("fars1255", "Farsic", labels)).toBe(LABELS.fars1255);
    expect(labelFor("east2745", "Eastern Farsic", labels)).toBe(LABELS.east2745);
  });
});
