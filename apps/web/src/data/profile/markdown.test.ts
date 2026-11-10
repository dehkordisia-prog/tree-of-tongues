// Language marks, [text]{lang=xx}: parsing, direction, collisions and nesting.
// Synthetic fixtures: placeholder words, so nothing here reads as data.

import { describe, expect, it } from "vitest";

import { parseBibtex } from "./bibtex";
import { BCP47, markDirection, parseBlocks, parseInline, plainText } from "./markdown";
import { buildProfile, ProfileError } from "./profile";
import type { Block, Inline } from "./types";

const AR = "كتاب"; // four Arabic letters
const AR2 = "باب"; // three Arabic letters
const CYR = "слово"; // Cyrillic letters
const HE = "שלום"; // Hebrew letters
const CUNEI = "\u{103A0}\u{103AD}"; // Old Persian cuneiform signs

const para = (b: Block[]): Inline[] => {
  const x = b[0]!;
  if (x.t !== "p") throw new Error(`expected a paragraph, got ${x.t}`);
  return x.c;
};

describe("language marks: parsing", () => {
  it("reads [text]{lang=xx} into a lang node, with the direction from the text", () => {
    expect(parseInline(`a [${AR}]{lang=ar} b`)).toEqual(["a ", { t: "lang", lang: "ar", dir: "rtl", c: [AR] }, " b"]);
    expect(parseInline(`[${CYR}]{lang=tg}`)).toEqual([{ t: "lang", lang: "tg", dir: "ltr", c: [CYR] }]);
    expect(parseInline(`[${HE}]{lang=he}`)).toEqual([{ t: "lang", lang: "he", dir: "rtl", c: [HE] }]);
  });
  it("takes the direction from the script subtag before the text, and an explicit dir before both", () => {
    expect(parseInline(`[${CYR}]{lang=tg-Cyrl}`)).toEqual([{ t: "lang", lang: "tg-Cyrl", dir: "ltr", c: [CYR] }]);
    expect(parseInline(`[${CUNEI}]{lang=peo-Xpeo}`)).toEqual([{ t: "lang", lang: "peo-Xpeo", dir: "ltr", c: [CUNEI] }]);
    expect(parseInline("[kitab]{lang=ota-Arab}")[0]).toMatchObject({ dir: "rtl" });
    expect(parseInline(`[${AR}]{lang=ar dir=ltr}`)[0]).toMatchObject({ dir: "ltr" });
    expect(parseInline("[x]{ lang=syc  dir=rtl }")[0]).toMatchObject({ lang: "syc", dir: "rtl" });
    expect(markDirection("dv-Thaa", "x")).toBe("rtl");
    expect(markDirection("syr", "ܐܒ")).toBe("rtl");
    expect(markDirection("fa", "123 dina")).toBe("ltr");
  });
  it("wins over the automatic Arabic-script rule, which stays for unmarked runs", () => {
    const nodes = parseInline(`[${AR}]{lang=ar} and ${AR2}`);
    expect(nodes).toEqual([{ t: "lang", lang: "ar", dir: "rtl", c: [AR] }, " and ", { t: "fa", v: AR2 }]);
    // No fa node anywhere inside a mark, even inside emphasis in it.
    expect(JSON.stringify(parseInline(`[*${AR}* ${AR2}]{lang=otk-Arab}`))).not.toContain('"t":"fa"');
  });
  it("accepts well-formed BCP 47 tags and rejects others", () => {
    for (const ok of ["ar", "fa", "tg-Cyrl", "peo-Xpeo", "ota-Arab", "zh-Hant-TW", "en-GB-oxendict", "es-419", "de-CH-1901", "und-fonipa", "sgn-x-local", "en-u-ca-gregory", "zh-yue-HK"])
      expect(BCP47.test(ok), ok).toBe(true);
    for (const bad of ["", "a", "e1", "fa_IR", "ar-", "-ar", "ar--EG", "ar-EGYPT1234", "x", "ar EG", "toolonglang"])
      expect(BCP47.test(bad), bad).toBe(false);
  });
  it("fails on an invalid tag, an unknown key, a bad dir, a missing lang or an empty mark", () => {
    expect(() => parseInline("[x]{lang=fa_IR}")).toThrow(/invalid BCP 47 tag "fa_IR"/);
    expect(() => parseInline("[x]{lang=}")).toThrow(/invalid BCP 47 tag/);
    expect(() => parseInline("[x]{lang=ar class=y}")).toThrow(/unknown attribute "class"/);
    expect(() => parseInline("[x]{lang=ar dir=up}")).toThrow(/dir must be rtl or ltr/);
    expect(() => parseInline("[x]{dir=rtl}")).toThrow(/without lang=/);
    expect(() => parseInline("[ ]{lang=ar}")).toThrow(/empty language mark/);
  });
});

describe("language marks: no collisions", () => {
  it("leaves citations and links alone, and refuses a citation with a mark", () => {
    expect(parseInline("[@a, p. 3]")).toEqual([{ t: "cite", key: "a", loc: "p. 3", n: 0 }]);
    expect(parseInline("[t](/language/abcd1234)")).toEqual([{ t: "link", href: "/language/abcd1234", c: ["t"] }]);
    expect(() => parseInline("[@a]{lang=ar}")).toThrow(/citation cannot carry a language mark/);
  });
  it("keeps brackets and braces that are not a mark as before", () => {
    // IPA in brackets followed by a brace that is not an attribute block.
    expect(parseInline("[kil] {x}")).toEqual([{ t: "ipa", v: "[kil]" }, " {x}"]);
    expect(parseInline("[kil]{x}")).toEqual([{ t: "ipa", v: "[kil]" }, "{x}"]);
    // Escapes give literal text.
    expect(parseInline("\\[x\\]\\{lang=ar\\}")).toEqual(["[x]{lang=ar}"]);
  });
  it("holds citations, links and emphasis inside, and the citation is still numbered", () => {
    const nodes = parseInline(`[*${AR}* [@a] [b](/x)]{lang=ar}`);
    expect(nodes).toEqual([
      {
        t: "lang",
        lang: "ar",
        dir: "rtl",
        c: [{ t: "em", c: [AR] }, " ", { t: "cite", key: "a", loc: null, n: 0 }, " ", { t: "link", href: "/x", c: ["b"] }],
      },
    ]);
    expect(plainText(nodes)).toBe(`${AR}  b`);
    const bib = parseBibtex("@misc{a, title={T}, note={Not opened.}}");
    const p = buildProfile(`---\nglottocode: test1234\n---\n## Story\n\n[${AR} [@a]]{lang=ar}.`, bib, { file: "x.md", glottocode: "test1234" });
    expect(p.sources.map((s) => s.key)).toEqual(["a"]);
    expect(JSON.stringify(p)).toContain('"t":"cite","key":"a","loc":null,"n":1');
  });
});

describe("language marks: inside blocks", () => {
  it("works inside emphasis, strong, links, list items and table cells", () => {
    expect(parseInline(`*[${AR}]{lang=ar}*`)).toEqual([{ t: "em", c: [{ t: "lang", lang: "ar", dir: "rtl", c: [AR] }] }]);
    expect(parseInline(`**x [${CYR}]{lang=tg}**`)).toEqual([{ t: "strong", c: ["x ", { t: "lang", lang: "tg", dir: "ltr", c: [CYR] }] }]);
    expect(parseInline(`[[${CYR}]{lang=tg}](/y)`)).toEqual([{ t: "link", href: "/y", c: [{ t: "lang", lang: "tg", dir: "ltr", c: [CYR] }] }]);
    const blocks = parseBlocks(
      [`- one [${AR}]{lang=ar}`, `  - two [${CYR}]{lang=tg-Cyrl}`, "", "| A | B |", "| --- | --- |", `| [${AR}]{lang=ar} | *[${CYR}]{lang=tg}* [@k] |`].join("\n"),
    );
    const list = blocks[0] as Extract<Block, { t: "list" }>;
    expect(para(list.items[0]!)).toEqual(["one ", { t: "lang", lang: "ar", dir: "rtl", c: [AR] }]);
    const nested = list.items[0]![1] as Extract<Block, { t: "list" }>;
    expect(para(nested.items[0]!)).toEqual(["two ", { t: "lang", lang: "tg-Cyrl", dir: "ltr", c: [CYR] }]);
    const table = blocks[1] as Extract<Block, { t: "table" }>;
    expect(table.rows[0]).toEqual([
      [{ t: "lang", lang: "ar", dir: "rtl", c: [AR] }],
      [{ t: "em", c: [{ t: "lang", lang: "tg", dir: "ltr", c: [CYR] }] }, " ", { t: "cite", key: "k", loc: null, n: 0 }],
    ]);
  });
  it("fails the profile build on an invalid tag", () => {
    const md = "---\nglottocode: test1234\n---\n## Story\n\nSee [x]{lang=not_a_tag}.";
    expect(() => buildProfile(md, new Map(), { file: "x.md", glottocode: "test1234" })).toThrow(ProfileError);
    expect(() => buildProfile(md, new Map(), { file: "x.md", glottocode: "test1234" })).toThrow(/x\.md: invalid BCP 47 tag "not_a_tag"/);
  });
});
