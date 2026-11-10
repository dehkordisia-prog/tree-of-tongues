// docs/specs/persian.md section 3 (D-031, D-004) and section 1.6 (D-028, D-029).
// Live tests pin behavior that exists today. Tests marked it.skip are pending: remove the mark when the
// spec section they name lands.

import { describe, expect, it } from "vitest";

import { SearchEngine } from "./engine";
import { fromPipeline } from "./source";

// Pipeline-shaped documents (pipeline/README.md). Names and codes are Glottolog 5.3 and the scope list;
// display labels follow docs/reviews/farsic-labels.md (provisional, D-030).
const docs = {
  schema: 1,
  tier: 1,
  documents: [
    {
      id: "west2369",
      kind: "language",
      name: "Iranian Persian",
      glottolog_name: "Western Farsi", // lint-allow: Glottolog's own name, source data
      aliases: [
        { alias: true, name: "Farsi" }, // lint-allow: search alias under test (D-031)
        { alias: true, name: "fārsi" },
      ],
      alt: ["Persian"],
      localized: [{ lang: "fa", name: "فارسی ایران", script: "Arab" }],
      iso639_3: "pes",
      family: "indo1319",
      parent: "fars1255",
      in_scope: true,
    },
    {
      id: "fars1255",
      kind: "family",
      name: "Persian group",
      glottolog_name: "Farsic",
      family: "indo1319",
      parent: "fars1254",
      in_scope: true,
    },
    {
      id: "east2745",
      kind: "family",
      name: "Eastern Persian group",
      glottolog_name: "Eastern Farsic",
      family: "indo1319",
      parent: "fars1255",
    },
    {
      id: "sout2645",
      kind: "language",
      name: "Fars Dialects",
      glottolog_name: "Fars Dialects",
      iso639_3: "fay",
      family: "indo1319",
      parent: "mode1259",
    },
    { id: "indo1319", kind: "family", name: "Indo-European", glottolog_name: "Indo-European", family: "indo1319" },
  ],
};

// The Persian group document, in the shape section 1.4 asks the pipeline for.
const groupDoc = {
  id: "persian",
  kind: "group",
  name: "Persian",
  aliases: [
    { alias: true, name: "Farsi" }, // lint-allow: search alias under test (D-031)
    { alias: true, name: "fārsi" },
  ],
  members: ["west2369", "dari1249", "taji1245"],
  in_scope: true,
};

function engine(extra: unknown[] = []) {
  const e = new SearchEngine();
  e.add(fromPipeline({ ...docs, documents: [...docs.documents, ...extra] }, {}) ?? []);
  return e;
}

const ALIAS = /\bfarsi\b/i; // the D-004 alias, as a word

describe("Alias: Farsi appears only when the alias matched (D-031)", () => { // lint-allow: alias under test
  const e = engine();

  it("shows the alias line for an alias query", () => {
    const h = e.search("Farsi").find((x) => x.doc.id === "west2369")!; // lint-allow: alias query
    expect(h.reason).toEqual({ kind: "alias", text: "Farsi" }); // lint-allow: alias under test
  });

  it("finds the romanized endonym spelling too", () => {
    const h = e.search("fārsi")[0]!;
    expect(h.doc.id).toBe("west2369");
    expect(h.reason.kind).toBe("alias");
  });

  it.each([
    ["Iranian Persian", "name"],
    ["pes", "iso"],
    ["west2369", "glottocode"],
    ["فارسی ایران", "otherName"],
  ])("does not show the alias line when %s matched", (query, kind) => {
    const h = e.search(query).find((x) => x.doc.id === "west2369")!;
    expect(h.reason.kind).toBe(kind);
  });

  it("never names, paths or labels a result with the alias", () => {
    for (const q of ["Farsi", "fars", "farsic", "western", "persian", "eastern farsic"]) { // lint-allow: queries under test
      for (const h of e.search(q)) {
        expect(h.doc.name, q).not.toMatch(ALIAS);
        expect(e.pathOf(h.doc) ?? "", q).not.toMatch(ALIAS);
      }
    }
  });

  it("does not put the alias on Fars Dialects (linguist-reviewer follow-up)", () => {
    const h = e.search("Farsi").find((x) => x.doc.id === "sout2645"); // lint-allow: alias under test
    if (h) expect(h.reason.kind).not.toBe("alias");
  });

  it("shows display labels for the Farsic families, never Glottolog's name as the label (D-030)", () => {
    expect(e.search("Farsic").find((x) => x.doc.id === "fars1255")!.doc.name).toBe("Persian group");
    expect(e.search("Eastern Farsic").find((x) => x.doc.id === "east2745")!.doc.name).toBe(
      "Eastern Persian group",
    );
  });
});

describe("pending: docs/specs/persian.md section 3", () => {
  const e = engine();

  it.skip("labels a matched Glottolog name as such, not as an alias (P)", () => {
    const h = e.search("Western Farsi")[0]!; // lint-allow: Glottolog's own name under test
    expect(h.doc.id).toBe("west2369");
    expect(h.reason).toEqual({ kind: "glottolog", text: "Western Farsi" }); // lint-allow: Glottolog's name
  });

  it.skip("labels a matched family Glottolog name as such (section 2)", () => {
    const h = e.search("Farsic").find((x) => x.doc.id === "fars1255")!;
    expect(h.reason).toEqual({ kind: "glottolog", text: "Farsic" });
  });
});

describe("pending: docs/specs/persian.md section 1.6 (the Persian group in search)", () => {
  const e = engine([groupDoc]);

  it.skip("finds the group by its name", () => {
    const h = e.search("Persian").find((x) => x.doc.id === "persian")!;
    expect(h.doc.name).toBe("Persian");
    expect(h.reason).toEqual({ kind: "name" });
  });

  it.skip("finds both the group and Iranian Persian by the alias, each with the alias line", () => {
    const hits = e.search("Farsi"); // lint-allow: alias under test
    for (const id of ["persian", "west2369"]) {
      const h = hits.find((x) => x.doc.id === id)!;
      expect(h.reason).toEqual({ kind: "alias", text: "Farsi" }); // lint-allow: alias under test
    }
  });

  it.skip("still finds Iranian Persian by the query Persian", () => {
    expect(e.search("Persian").some((x) => x.doc.id === "west2369")).toBe(true);
  });
});
