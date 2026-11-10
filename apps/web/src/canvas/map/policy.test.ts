import { describe, expect, it } from "vitest";

import {
  fillCode,
  hasOfficialOutline,
  isContestedEntity,
  isNeutralEntity,
  joinChoropleth,
  shareBin,
  slimCountryProps,
  statusLabel,
  viewpointKey,
} from "./policy";

const row = (iso3166: string, population_share: number, official_status: string | null = null) => ({
  iso3166,
  population_share,
  official_status,
});

describe("fillCode", () => {
  it("accepts only two capital letters", () => {
    expect(fillCode({ ISO_A2_EH: "FR" })).toBe("FR");
    expect(fillCode({ ISO_A2_EH: "-99" })).toBeNull();
    expect(fillCode({ ISO_A2_EH: "fr" })).toBeNull();
    expect(fillCode({})).toBeNull();
  });
});

describe("contested and neutral entities", () => {
  it("follows the notes in Natural Earth and adds no opinion", () => {
    expect(isContestedEntity({ NOTE_BRK: "Self admin.; Claimed by Somalia" })).toBe(true);
    expect(isContestedEntity({ NOTE_BRK: "Admin. by U.K.; Claimed by Argentina" })).toBe(true);
    expect(isContestedEntity({ NOTE_BRK: "Partial self-admin." })).toBe(true);
    expect(isContestedEntity({ NOTE_BRK: "Multiple claims held in abeyance by treaty" })).toBe(true);
    expect(isContestedEntity({ NOTE_BRK: "Assoc. with N.Z." })).toBe(false);
    expect(isContestedEntity({ NOTE_BRK: null })).toBe(false);
  });

  it("hatches a contested entity with no code of its own, and never fills it", () => {
    const somaliland = {
      NAME_EN: "Somaliland",
      ADM0_A3: "SOL",
      ISO_A2_EH: "-99",
      NOTE_BRK: "Self admin.; Claimed by Somalia",
    };
    expect(isNeutralEntity(somaliland)).toBe(true);
    const slim = slimCountryProps(somaliland);
    expect(slim.tt_neutral).toBe(true);
    expect(slim.tt_code).toBe("");
  });

  it("fills a contested entity from its own code only", () => {
    const taiwan = { NAME_EN: "Taiwan", ADM0_A3: "TWN", ISO_A2_EH: "TW", NOTE_BRK: "Self admin.; Claimed by China" };
    expect(isNeutralEntity(taiwan)).toBe(false);
    expect(slimCountryProps(taiwan)).toMatchObject({ tt_code: "TW", tt_contested: true, tt_neutral: false });
  });
});

describe("joinChoropleth", () => {
  const drawable = new Set(["FR", "DE", "TW"]);

  it("never fills a code that has no polygon of its own", () => {
    // UA is not drawable here, as if its only polygon were a disputed area.
    const join = joinChoropleth([row("FR", 88, "official"), row("UA", 5), row("AC", 99)], drawable);
    expect([...join.fills.keys()]).toEqual(["FR"]);
    expect(join.unmatched.map((r) => r.iso3166)).toEqual(["UA", "AC"]);
  });

  it("never fills a disputed area: its feature has no code, so no row can reach it", () => {
    const codes = new Set(
      [
        { ISO_A2_EH: "-99", NOTE_BRK: "Admin. by Russia; Claimed by Ukraine" },
        { ISO_A2_EH: "-99", NOTE_BRK: "Self admin.; Claimed by Cyprus" },
        { ISO_A2_EH: "DE" },
      ]
        .map(fillCode)
        .filter((c): c is string => c !== null),
    );
    const join = joinChoropleth([row("DE", 90), row("-99", 50)], codes);
    expect([...join.fills.keys()]).toEqual(["DE"]);
    expect(join.unmatched).toHaveLength(1);
  });

  it("keeps the first row of a repeated code and does not merge or average", () => {
    const join = joinChoropleth([row("FR", 10), row("FR", 90)], drawable);
    expect(join.fills.get("FR")?.share).toBe(10);
    expect(join.unmatched).toHaveLength(1);
  });

  it("carries status and bin through", () => {
    const join = joinChoropleth([row("DE", 95, "official")], drawable);
    expect(join.fills.get("DE")).toEqual({ code: "DE", share: 95, status: "official", bin: 4 });
  });

  it("returns nothing for a language with no rows", () => {
    const join = joinChoropleth([], drawable);
    expect(join.fills.size).toBe(0);
    expect(join.unmatched).toEqual([]);
  });
});

describe("shareBin", () => {
  it("bins on the lower bound", () => {
    expect([0, 0.9, 1, 9.9, 10, 49.9, 50, 89.9, 90, 100].map(shareBin)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe("status", () => {
  it("outlines official and de facto official only", () => {
    expect(hasOfficialOutline("official")).toBe(true);
    expect(hasOfficialOutline("de_facto_official")).toBe(true);
    expect(hasOfficialOutline("official_regional")).toBe(false);
    expect(hasOfficialOutline(null)).toBe(false);
  });
  it("labels unknown status plainly", () => {
    expect(statusLabel(null)).toBe("No official status recorded");
    expect(statusLabel("official_regional")).toBe("Official in a region");
  });
});

describe("viewpointKey", () => {
  it("defaults to the neutral column and builds labeled alternatives", () => {
    expect(viewpointKey(null)).toBe("ADM0_A3");
    expect(viewpointKey("IN")).toBe("ADM0_A3_IN");
    expect(() => viewpointKey("india")).toThrow();
  });
});
