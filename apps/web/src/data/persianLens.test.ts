// docs/specs/persian.md section 1 (D-028, D-029, D-033): the Persian lens in the scope list.
// Live tests hold what is true today; it.skip tests are pending until section 1 lands.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseYaml } from "./yamlLite";

const SCOPE = path.resolve(import.meta.dirname, "../../../../content/scope/phase-1-languages.yaml");
type Raw = Record<string, unknown>;
const scope = parseYaml(fs.readFileSync(SCOPE, "utf8")) as Raw;
const persian = ((scope.lumper_groups as Raw) ?? {}).persian as Raw;
const decisions = (scope.owner_decisions as Raw[]) ?? [];

const MEMBERS = ["west2369", "dari1249", "taji1245"];

describe("the Persian lens today", () => {
  it("groups Iranian Persian, Dari and Tajik", () => {
    expect(persian.members).toEqual(MEMBERS);
  });

  it("is labeled as the atlas's own grouping, not as ISO's or Glottolog's", () => {
    expect(String(persian.label)).toMatch(/^Atlas grouping/);
  });

  it("names Farsic as the Glottolog ancestor, never fars1254 (which holds Caucasian Tat)", () => {
    expect(persian.glottolog_ancestor).toBe("fars1255");
  });
});

describe("pending: owner decision recorded (spec 1.5)", () => {
  it.skip("the group and its owner_decisions entries cite D-028 and D-030", () => {
    expect(persian.owner_decision).toBe("D-028");
    const byId = Object.fromEntries(decisions.map((d) => [d.id, d]));
    expect(byId.persian_grouping).toMatchObject({ status: "decided", decision: "D-028" });
    expect(byId.farsic_family_labels).toMatchObject({ status: "decided", decision: "D-030" });
  });
});

describe("pending: three views (spec 1.3)", () => {
  const views = (persian.views ?? {}) as Record<string, Raw>;

  it.skip("lists the atlas, ISO and Glottolog views with members and provenance", () => {
    expect(Object.keys(views).sort()).toEqual(["atlas", "glottolog", "iso"]);
    expect(views.atlas!.members).toEqual(MEMBERS);
    expect(views.iso!.members).toEqual(["west2369", "dari1249"]);
    expect(views.iso!.code).toBe("fas");
    expect(views.glottolog!.nearest_ancestor).toBe("fars1255");
    for (const [k, v] of Object.entries(views)) {
      for (const field of ["source", "locator", "retrieved", "confidence"]) expect(v[field], `${k}.${field}`).toBeTruthy();
      expect(["high", "medium", "low", "contested"], k).toContain(v.confidence);
    }
  });

  it.skip("marks an interim source as interim and names its replacement (D-033)", () => {
    const iso = views.iso!;
    expect(iso.interim).toBe(true);
    expect(String(iso.replace_with)).toMatch(/SIL/);
  });
});

describe("pending: figures attach to the lens (spec 1.4)", () => {
  it.skip("attaches CLDR fa and Wikidata Q9168 to the group, from the scope list", () => {
    expect(persian.attach).toEqual({ cldr: ["fa"], wikidata: ["Q9168"] });
  });
});
