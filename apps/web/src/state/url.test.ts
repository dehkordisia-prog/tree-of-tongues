import { describe, expect, it } from "vitest";

import {
  canonicalize,
  DEFAULT_STATE,
  LANGUAGE_TABS,
  FAMILY_TABS,
  LUMP_GROUPS,
  parseShellUrl,
  toShellHref,
  type Selection,
  type UrlState,
} from "./url";

const href = (url: string, dev = false) => {
  const u = new URL(url, "https://x.test");
  return canonicalize(u.pathname, u.search, { dev });
};

describe("spec 2.2 examples are canonical", () => {
  const examples = [
    "/language/west2369",
    "/language/west2369?tab=speakers&lang=fa",
    "/family/turk1311?tz=1.50&tc=0.10,-0.20",
    "/language/west2369?lens=map&map=4.20/32.900/53.300",
    "/macrolanguage/fas?lump=persian",
    "/country/ir",
    "/?lens=map&area=ne-kashmir&dialects=1",
  ];
  for (const e of examples) it(e, () => expect(href(e)).toBe(e));
});

describe("invalid values are dropped", () => {
  it.each([
    ["/?lens=time", "/"],
    ["/family/turk1311?tz=abc", "/family/turk1311"],
    ["/language/stan1290?map=99/200/0", "/language/stan1290"],
    ["/?lump=xyz", "/"],
    ["/?lump=zho,xyz,ara,zho", "/?lump=arabic,chinese"],
    ["/?lump=persian,fas", "/?lump=persian"],
    ["/?lump=punjabi,kurdish", "/?lump=kurdish,punjabi"],
    ["/language/stan1290?year=0", "/language/stan1290"],
    ["/language/stan1290?year=1500", "/language/stan1290"],
    ["/language/stan1290?tab=members", "/language/stan1290"],
    ["/family/indo1319?tab=speakers", "/family/indo1319"],
    ["/?tab=speakers", "/"],
    ["/language/stan1290?lang=xx", "/language/stan1290"],
    ["/language/stan1290?lang=en", "/language/stan1290"],
    ["/language/stan1290?lens=tree", "/language/stan1290"],
    ["/language/stan1290?class=glottolog", "/language/stan1290"],
    ["/language/stan1290?area=ne-kashmir", "/language/stan1290"],
    ["/?area=ne-kashmir", "/"],
    ["/?unknown=1&dialects=0", "/"],
    ["/?tz=0.00&tc=0.00,0.00", "/"],
    ["/?tc=1,2,3", "/"],
  ])("%s -> %s", (input, out) => expect(href(input)).toBe(out));
});

describe("parameter order and rounding", () => {
  it("writes params in the spec order", () => {
    expect(href("/language/stan1290?lang=tr&map=1/2/3&tz=1&dialects=1&lump=fas&tab=where&lens=map")).toBe(
      "/language/stan1290?lens=map&tab=where&lump=persian&dialects=1&tz=1.00&map=1.00/2.000/3.000&lang=tr",
    );
  });
  it("rounds cameras to the spec precision", () => {
    expect(href("/?tz=1.23456&tc=0.0049,0.126")).toBe("/?tz=1.23&tc=0.00,0.13");
    expect(href("/?map=4.2049/32.90049/53.3")).toBe("/?map=4.20/32.900/53.300");
  });
  it("keeps renderer always and bench or stress only in dev", () => {
    expect(href("/?renderer=deck&bench=1&stress=1")).toBe("/?renderer=deck");
    expect(href("/?renderer=deck&bench=1&stress=1", true)).toBe("/?renderer=deck&bench=1&stress=1");
    expect(href("/?renderer=pixi")).toBe("/");
  });
  it("leaves non-shell paths alone", () => {
    expect(href("/design?lang=fa")).toBeNull();
    expect(href("/spike/tree?focus=indo1319")).toBeNull();
    expect(href("/macrolanguage/xyz")).toBeNull();
  });
});

// Deterministic pseudo-random generator, so the 200 states are the same on every run.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("round trip for 200 generated states", () => {
  const r = rng(42);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const states: UrlState[] = [];
  for (let i = 0; i < 200; i++) {
    const sel: Selection = pick<Selection>([
      null,
      { kind: "language", glottocode: "stan1290" },
      { kind: "language", glottocode: "nucl1301" },
      { kind: "family", glottocode: "indo1319" },
      { kind: "macrolanguage", iso: "fas" },
      { kind: "country", iso: "ir" },
    ]);
    const lens = pick(["tree", "map"] as const);
    const tabs =
      sel?.kind === "language"
        ? LANGUAGE_TABS
        : sel?.kind === "family"
          ? FAMILY_TABS
          : sel?.kind === "country"
            ? (["languages", "sources"] as const)
            : sel
              ? (["overview", "speakers", "where", "sources"] as const)
              : (["overview"] as const);
    states.push({
      ...DEFAULT_STATE,
      selection: sel,
      lens,
      tab: pick(tabs),
      lumped: LUMP_GROUPS.filter(() => r() > 0.6),
      area: sel === null && lens === "map" && r() > 0.5 ? "ne-kashmir" : null,
      mapDialects: r() > 0.5,
      treeCamera:
        r() > 0.5
          ? {
              tz: Math.round((r() * 8 - 4) * 100) / 100,
              dx: Math.round((r() - 0.5) * 100) / 100,
              dy: Math.round((r() - 0.5) * 100) / 100,
            }
          : null,
      mapCamera:
        r() > 0.5
          ? {
              zoom: Math.round(r() * 1000) / 100,
              lat: Math.round((r() * 160 - 80) * 1000) / 1000,
              lon: Math.round((r() * 340 - 170) * 1000) / 1000,
            }
          : null,
      locale: pick(["en", "fa", "tr"] as const),
    });
  }
  it("toShellHref(parseShellUrl(href)) is stable and canonical", () => {
    for (const s of states) {
      const h = toShellHref(s);
      const u = new URL(h, "https://x.test");
      const p = parseShellUrl(u.pathname, u.search);
      expect(toShellHref(p.state)).toBe(h);
      expect(h).not.toMatch(
        s.selection?.kind === "country"
          ? /(\?|&)(lens=map|tab=languages|lang=en|class=)/
          : /(\?|&)(lens=tree|tab=overview|lang=en|class=)/,
      );
    }
  });
  it("parse restores every field", () => {
    for (const s of states) {
      const u = new URL(toShellHref(s), "https://x.test");
      const p = parseShellUrl(u.pathname, u.search).state;
      expect(p.selection).toEqual(s.selection);
      expect(p.lens).toBe(s.lens);
      expect(p.locale).toBe(s.locale);
      expect(p.lumped).toEqual([...s.lumped].sort());
      expect(p.mapDialects).toBe(s.mapDialects);
    }
  });
});
