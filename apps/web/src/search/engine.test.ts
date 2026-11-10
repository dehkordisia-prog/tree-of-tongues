import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { normalize, queryIsLongEnough, SearchEngine, withinOne } from "./engine";
import { fromPipeline } from "./source";

// A small fixture in the pipeline's documented shape (pipeline/README.md). Values are copied from
// data/build/search/tier1.json as built on 2026-11-10.
const fixture = {
  schema: 1,
  tier: 1,
  documents: [
    {
      id: "west2369",
      kind: "language",
      name: "Iranian Persian",
      glottolog_name: "Western Farsi", // lint-allow: Glottolog's own name, source data
      aliases: [{ alias: true, name: "Farsi" }],
      alt: ["Persian"],
      localized: [{ lang: "fa", name: "فارسی ایران", script: "Arab" }],
      iso639_3: "pes",
      family: "indo1319",
      parent: "fars1255",
      in_scope: true,
    },
    {
      id: "nucl1301",
      kind: "language",
      name: "Turkish",
      glottolog_name: "Turkish",
      endonyms: [{ lang: "tr", name: "Türkçe", script: "Latn" }],
      iso639_3: "tur",
      family: "turk1311",
      in_scope: true,
    },
    { id: "turk1311", kind: "family", name: "Turkic", glottolog_name: "Turkic", family: "turk1311" },
    { id: "TR", kind: "country", name: "Türkiye" },
  ],
};

function engineFrom(json: unknown) {
  const e = new SearchEngine();
  e.add(fromPipeline(json, {}) ?? []);
  return e;
}

describe("matching", () => {
  it("normalizes case and diacritics", () => {
    expect(normalize("Türkçe")).toBe("turkce");
    expect(withinOne("turkish", "turkis")).toBe(true);
    expect(withinOne("turkish", "trukish")).toBe(false);
  });
  it("needs two Latin letters, or one in another script", () => {
    expect(queryIsLongEnough("t")).toBe(false);
    expect(queryIsLongEnough("tu")).toBe(true);
    expect(queryIsLongEnough("ف")).toBe(true);
  });
});

describe("the pipeline document adapter", () => {
  const e = engineFrom(fixture);
  it("matches an alias but labels the result with its name (D-004)", () => {
    const h = e.search("Farsi")[0]!; // alias query
    expect(h.doc.name).toBe("Iranian Persian");
    expect(h.reason).toEqual({ kind: "alias", text: "Farsi" }); // alias
  });
  it("matches codes exactly", () => {
    const h = e.search("tur")[0]!;
    expect(h.doc.id).toBe("nucl1301");
    expect(h.reason).toEqual({ kind: "iso", code: "tur" });
    expect(e.search("west2369")[0]!.reason.kind).toBe("glottocode");
  });
  it("matches endonyms in any script and without diacritics", () => {
    expect(e.search("Türkçe")[0]!.doc.id).toBe("nucl1301");
    expect(e.search("turkce")[0]!.doc.id).toBe("nucl1301");
    expect(e.search("فارسی")[0]!.doc.id).toBe("west2369");
  });
  it("finds typos from five letters", () => {
    expect(e.search("Turksh")[0]!.doc.id).toBe("nucl1301");
  });
  it("leaves countries out until their route ships, and builds paths from ids", () => {
    expect(e.search("Türkiye").some((h) => h.doc.kind === "country")).toBe(false);
    expect(e.pathOf(e.search("Turkish")[0]!.doc)).toBe("Turkic");
  });
});

// With the real index (absent in CI): spec acceptance 23.
const T1 = path.resolve(import.meta.dirname, "../../../../data/build/search/tier1.json");
describe.skipIf(!fs.existsSync(T1))("the built tier-1 index", () => {
  it("answers the acceptance queries", () => {
    const e = engineFrom(JSON.parse(fs.readFileSync(T1, "utf8")));
    // Wikidata gives this alias to Iranian Persian and to Dari; both must come back, labeled by name.
    const aliasHits = e.search("Farsi").slice(0, 3); // alias query
    expect(aliasHits.map((h) => h.doc.id)).toContain("west2369");
    for (const h of aliasHits) expect(h.doc.name).not.toMatch(/\bfarsi\b/i); // alias rule check
    expect(e.search("tur")[0]!.doc.id).toBe("nucl1301");
    expect(e.search("west2369")[0]!.doc.id).toBe("west2369");
    expect(e.search("Türkçe")[0]!.doc.id).toBe("nucl1301");
    expect(e.search("turkce")[0]!.doc.id).toBe("nucl1301");
    expect(e.search("فارسی").some((h) => h.doc.id === "west2369")).toBe(true);
  });
});
