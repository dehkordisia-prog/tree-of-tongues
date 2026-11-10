import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { accessOf, formatNames, parseBibtex } from "./bibtex";
import { parseBlocks, parseCitations, parseInline, splitText, stripComments } from "./markdown";
import { buildProfile, ProfileError, slotOf } from "./profile";
import type { Block, Inline } from "./types";

const REPO = path.resolve(import.meta.dirname, "../../../../..");
const read = (p: string) => fs.readFileSync(path.join(REPO, p), "utf8");

// Synthetic fixtures: made-up keys and text, so nothing here reads as data.
const BIB = `
% a comment line with an @ sign in it
@book{alpha2000,
  author = {Doe, Jane and Roe, Richard and {Example Society}},
  title = {A {Made-Up} Book},
  year = {2000},
  pages = {10--12},
  url = {https://example.org/alpha},
  urldate = {2026-01-02},
  note = {Checked: chapter 1. TODO(verify) page 3.}
}

@misc{beta-2001,
  title = "Quoted title",
  year = 2001,
  note = {Supplied by a reviewer. Not opened.}
}

@misc{gamma_cat,
  title = {Gamma},
  note = {Catalog only; not read.}
}
`;

const MD = (body: string, front = "glottocode: test1234\nstatus: draft\nreview:\n  linguist: pending\nsources:\n  - alpha2000") =>
  `---\n${front}\n---\n${body}`;

const first = (b: Block[]): Inline[] => {
  const x = b[0]!;
  if (x.t !== "p") throw new Error(`expected a paragraph, got ${x.t}`);
  return x.c;
};

describe("BibTeX", () => {
  const bib = parseBibtex(BIB);
  it("reads braced, quoted and bare values and drops grouping braces", () => {
    expect([...bib.keys()]).toEqual(["alpha2000", "beta-2001", "gamma_cat"]);
    expect(bib.get("alpha2000")!.fields.title).toBe("A Made-Up Book");
    expect(bib.get("beta-2001")!.fields.title).toBe("Quoted title");
    expect(bib.get("beta-2001")!.fields.year).toBe("2001");
    expect(bib.get("alpha2000")!.type).toBe("book");
  });
  it("formats names and access notes", () => {
    expect(formatNames(bib.get("alpha2000")!.fields.author)).toBe("Jane Doe, Richard Roe and Example Society");
    expect(accessOf(bib.get("alpha2000")!.fields.note)).toBe("opened");
    expect(accessOf(bib.get("beta-2001")!.fields.note)).toBe("not-opened");
    expect(accessOf(bib.get("gamma_cat")!.fields.note)).toBe("catalog");
    expect(accessOf("Supplied by x. Reference verified; not opened.")).toBe("not-opened");
    expect(accessOf("Supplied by x. Catalog; pages TODO.")).toBe("catalog");
    expect(accessOf(undefined)).toBe("unknown");
  });
  it("rejects duplicate keys", () => {
    expect(() => parseBibtex("@misc{a, title={x}}\n@misc{a, title={y}}")).toThrow(/duplicate key a/);
  });
  it("reads the real sources.bib: 148 entries, each with an access status", () => {
    const real = parseBibtex(read("content/sources.bib"));
    expect(real.size).toBe(148);
    const unknown = [...real.values()].filter((e) => accessOf(e.fields.note) === "unknown").map((e) => e.key);
    expect(unknown).toEqual([]);
  });
});

describe("inline Markdown", () => {
  it("reads citations with locators, including a locator that continues after ;", () => {
    expect(parseCitations("@a, s.v. x; s.v. y")).toEqual([{ t: "cite", key: "a", loc: "s.v. x; s.v. y", n: 0 }]);
    expect(parseCitations("@a; @b-c, p. 3")).toEqual([
      { t: "cite", key: "a", loc: null, n: 0 },
      { t: "cite", key: "b-c", loc: "p. 3", n: 0 },
    ]);
  });
  it("reads emphasis, strong, code, links and IPA", () => {
    expect(parseInline("**Bold** and *it* `c` [x](/language/abcd1234) [kil] /æ e/ s/he")).toEqual([
      { t: "strong", c: ["Bold"] },
      " and ",
      { t: "em", c: ["it"] },
      " ",
      { t: "code", v: "c" },
      " ",
      { t: "link", href: "/language/abcd1234", c: ["x"] },
      " ",
      { t: "ipa", v: "[kil]" },
      " ",
      { t: "ipa", v: "/æ e/" },
      " s/he",
    ]);
  });
  it("keeps parentheses inside link targets", () => {
    const [link] = parseInline("[t](https://e.org/a_(b)_c.jpg)");
    expect(link).toEqual({ t: "link", href: "https://e.org/a_(b)_c.jpg", c: ["t"] });
  });
  it("turns TODO(verify) into an Unverified node and never keeps the marker", () => {
    const nodes = parseInline("IPA: TODO(verify): not yet.");
    expect(nodes).toEqual(["IPA: ", { t: "unverified" }, " not yet."]);
    expect(JSON.stringify(nodes)).not.toContain("TODO");
  });
  it("marks Arabic-script runs as one span, with the spaces between words", () => {
    expect(splitText("word فارسی زبان end")).toEqual(["word ", { t: "fa", v: "فارسی زبان" }, " end"]);
    expect(splitText("plain")).toEqual(["plain"]);
  });
});

describe("block Markdown", () => {
  it("drops HTML comments, including multi-line ones", () => {
    expect(stripComments("a<!-- x\ny -->b")).toBe("ab");
    expect(() => stripComments("a <!-- open")).toThrow(/unclosed/);
  });
  it("reads headings, lists with continuation, tables and blockquotes", () => {
    const blocks = parseBlocks(
      [
        "### Small",
        "",
        "1. **One.** First line",
        "   continued.",
        "",
        "2. Two",
        "- a",
        "  - nested",
        "",
        "| H1 | H2 |",
        "| --- | --- |",
        "| [a] | b [@k] |",
        "",
        "> line one",
        "> line two",
        "",
        "Para one",
        "still one.",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.t)).toEqual(["h", "list", "list", "table", "quote", "p"]);
    const ol = blocks[1] as Extract<Block, { t: "list" }>;
    expect(ol.ordered).toBe(true);
    expect(ol.items).toHaveLength(2);
    expect(first(ol.items[0]!)).toEqual([{ t: "strong", c: ["One."] }, " First line continued."]);
    const ul = blocks[2] as Extract<Block, { t: "list" }>;
    expect(ul.items[0]!.map((b) => b.t)).toEqual(["p", "list"]);
    const table = blocks[3] as Extract<Block, { t: "table" }>;
    expect(table.head).toEqual([["H1"], ["H2"]]);
    expect(table.rows[0]![0]).toEqual([{ t: "ipa", v: "[a]" }]);
    const quote = blocks[4] as Extract<Block, { t: "quote" }>;
    expect(first(quote.c)).toEqual(["line one", { t: "br" }, "line two"]);
    expect(first(blocks.slice(5))).toEqual(["Para one still one."]);
  });
});

describe("buildProfile", () => {
  const bib = parseBibtex(BIB);
  const opts = { file: "x.md", glottocode: "test1234" };
  it("numbers citations in reading order and lists each source once", () => {
    const p = buildProfile(
      MD("# T\n\n## Writing\n\nW [@beta-2001].\n\n## Hook\n\nH [@alpha2000, p. 3; @beta-2001].\n\n## Story\n\nS [@alpha2000, p. 4]."),
      bib,
      opts,
    );
    // Hook comes first on Overview, Writing is a later tab: alpha is 1 even though Writing is first in the file.
    expect(p.sources.map((s) => [s.n, s.key, s.locators])).toEqual([
      [1, "alpha2000", ["p. 3", "p. 4"]],
      [2, "beta-2001", []],
    ]);
    expect(p.hook?.title).toBe("Hook");
    expect(p.overview.map((s) => s.title)).toEqual(["Story"]);
    expect(p.tabs.writing).toHaveLength(1);
    expect(p.sources[0]!.access).toBe("opened");
    expect(p.sources[0]!.author).toBe("Jane Doe, Richard Roe and Example Society");
  });
  it("fails on an unknown citation key, never rendering it silently", () => {
    expect(() => buildProfile(MD("## Story\n\nX [@nope]."), bib, opts)).toThrow(ProfileError);
    expect(() => buildProfile(MD("## Story\n\nX [@nope]."), bib, opts)).toThrow(/unknown citation key "nope"/);
  });
  it("fails on an unknown key in the frontmatter sources list", () => {
    expect(() => buildProfile(MD("## Story\n\nX.", "glottocode: test1234\nsources:\n  - ghost"), bib, opts)).toThrow(/"ghost"/);
  });
  it("fails when the frontmatter glottocode does not match the file", () => {
    expect(() => buildProfile(MD("## Story", "glottocode: other1234"), bib, opts)).toThrow(/expected test1234/);
  });
  it("is a draft while a review is pending, or the status is draft", () => {
    expect(buildProfile(MD("## Story"), bib, opts).draft).toBe(true);
    const done = "glottocode: test1234\nstatus: published\nreview:\n  linguist: done";
    expect(buildProfile(MD("## Story", done), bib, opts).draft).toBe(false);
    const pending = "glottocode: test1234\nstatus: published\nreview:\n  owner: pending";
    expect(buildProfile(MD("## Story", pending), bib, opts).draft).toBe(true);
  });
  it("drops the profile's own Sources section and counts Unverified markers", () => {
    const p = buildProfile(MD("## Story\n\nA TODO(verify).\n\n## Sources\n\nSee the bib file."), bib, opts);
    expect(p.unverified).toBe(1);
    expect(JSON.stringify(p)).not.toContain("See the bib file");
    expect(slotOf("Hear it then")).toBe("sounds");
    expect(slotOf("Oddity: something")).toBe("overview");
  });
});

describe("the three profiles in content/languages build", () => {
  const bib = parseBibtex(read("content/sources.bib"));
  for (const g of ["west2369", "nucl1301", "stan1293"]) {
    it(g, () => {
      const file = `content/languages/${g}.md`;
      const p = buildProfile(read(file), bib, { file, glottocode: g });
      const json = JSON.stringify(p);
      expect(json).not.toContain("TODO(verify)");
      expect(json).not.toContain("<!--");
      expect(p.hook).not.toBeNull();
      expect(p.sources.length).toBeGreaterThan(5);
      expect(p.draft).toBe(true);
      // Every citation number points at a listed source.
      const ns = new Set(p.sources.map((s) => s.n));
      for (const m of json.matchAll(/"t":"cite","key":"[^"]+","loc":(?:null|"(?:[^"\\]|\\.)*"),"n":(\d+)/g)) expect(ns.has(Number(m[1]))).toBe(true);
    });
  }
});
