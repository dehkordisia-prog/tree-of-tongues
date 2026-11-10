import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { prerenderTargets, readScope, scopeLabel } from "./scope";
import { parseYaml } from "./yamlLite";
import { LUMP_GROUPS } from "@/state/url";

const SCOPE = path.resolve(import.meta.dirname, "../../../../content/scope/phase-1-languages.yaml");

describe("yamlLite", () => {
  it("reads mappings, sequences, quotes, comments and folded scalars", () => {
    const doc = parseYaml(
      [
        "# c",
        "a: 1",
        "b: 'it''s' # trailing",
        "c:",
        "- x: null",
        "  y: two words",
        "    continued here",
        "- plain",
        "d: []",
        "e:",
        '  f: "q: x"',
        "  g: |",
        "    line 1",
        "    line 2",
      ].join("\n"),
    );
    expect(doc).toEqual({ a: 1, b: "it's", c: [{ x: null, y: "two words continued here" }, "plain"], d: [], e: { f: "q: x", g: "line 1\nline 2\n" } });
  });
});

describe("scope list loader", () => {
  const scope = readScope(parseYaml(fs.readFileSync(SCOPE, "utf8")));
  it("reads 100 entries and the families", () => {
    expect(scope.languages).toHaveLength(100);
    expect(scope.families.length).toBeGreaterThan(50);
  });
  it("never labels west2369 with the Glottolog name that carries the search alias (D-004)", () => {
    const e = scope.languages.find((x) => x.glottocode === "west2369");
    if (e) expect(scopeLabel(e)).not.toMatch(/farsi/i); // alias rule check
  });
  it("prerenders every own glottocode, candidates of unresolved entries, and the families", () => {
    const targets = prerenderTargets(scope);
    const paths = new Set(targets.map((t) => t.path));
    for (const e of scope.languages) {
      if (e.glottocode && !e.page) expect(paths.has(`/${e.level === "family" ? "family" : "language"}/${e.glottocode}`)).toBe(true);
      if (!e.glottocode) for (const c of e.candidates) expect(paths.has(`/${c.level === "family" ? "family" : "language"}/${c.glottocode}`)).toBe(true);
    }
    for (const f of scope.families) expect(paths.has(`/family/${f.glottocode}`)).toBe(true);
    expect(paths.size).toBe(targets.length);
  });
  it("reads the lumper groups when the scope list has them", () => {
    for (const g of scope.lumperGroups) expect(g.members.length).toBeGreaterThan(0);
    const persian = scope.lumperGroups.find((g) => g.id === "persian");
    expect(persian?.ownerDecision).toBe("pending");
    expect(persian?.ancestor).toBe("fars1255");
    expect(persian?.members).toContain("west2369");
  });
  it("lump ids in the URL match the scope list groups (D-023)", () => {
    expect([...LUMP_GROUPS].sort()).toEqual(scope.lumperGroups.map((g) => g.id).sort());
  });
  it("every lumper_group named by an entry exists", () => {
    const ids = new Set(scope.lumperGroups.map((g) => g.id));
    for (const e of scope.languages) if (e.lumperGroup && e.lumperGroup !== "none") expect(ids.has(e.lumperGroup)).toBe(true);
  });
});
