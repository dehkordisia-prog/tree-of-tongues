import { describe, expect, it } from "vitest";

import { THEMES } from "@/design/tokens";

import { prepareGeo, type FeatureCollection } from "./data";
import { LAYER_ORDER, buildStyle, choroplethColor, codeFilter } from "./style";

const square = (x: number, y: number) => ({
  type: "Polygon",
  coordinates: [
    [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
      [x, y],
    ],
  ],
});

const countries: FeatureCollection<Record<string, unknown>> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { NAME_EN: "Atland", ADM0_A3: "ATL", ISO_A2_EH: "AT", NOTE_BRK: null },
      geometry: square(0, 0),
    },
    {
      type: "Feature",
      properties: { NAME_EN: "Breakaway", ADM0_A3: "BRK", ISO_A2_EH: "-99", NOTE_BRK: "Self admin.; Claimed by Atland" },
      geometry: square(2, 0),
    },
    {
      type: "Feature",
      properties: { NAME_EN: "Taiwanish", ADM0_A3: "TWN", ISO_A2_EH: "TW", NOTE_BRK: "Self admin.; Claimed by Atland" },
      geometry: square(4, 0),
    },
  ],
};
const disputed: FeatureCollection<Record<string, unknown>> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { NAME: "Atland", NAME_EN: "The Strip", BRK_A3: "B01", NOTE_BRK: "Admin. by Atland; Claimed by Other" },
      geometry: square(0, 2),
    },
    {
      type: "Feature",
      properties: { NAME: "Strip", BRK_A3: "B01", NOTE_BRK: "Admin. by Atland; Claimed by Other" },
      geometry: square(5, 2),
    },
  ],
};

describe("prepareGeo", () => {
  const geo = prepareGeo(countries, disputed);

  it("lets only polygons with their own code receive a fill", () => {
    expect([...geo.drawableCodes].sort()).toEqual(["AT", "TW"]);
  });

  it("lists neutral entities and deduplicated disputed areas, never as countries", () => {
    expect(geo.neutral.map((n) => n.id).sort()).toEqual(["d:B01", "n:BRK"]);
    expect(geo.byCode.has("BRK")).toBe(false);
  });

  it("names a disputed area by its own name, never by the state that administers it", () => {
    const strip = geo.neutral.find((n) => n.id === "d:B01");
    expect(strip?.name).toBe("The Strip");
  });

  it("does not label neutral entities", () => {
    expect(geo.labels.map((l) => l.name)).toEqual(["Atland", "Taiwanish"]);
  });

  it("flags contested entities for a dashed outline", () => {
    const flagged = geo.countries.features.filter((f) => f.properties.tt_contested).map((f) => f.properties.NAME_EN);
    expect(flagged).toEqual(["Breakaway", "Taiwanish"]);
  });
});

describe("buildStyle", () => {
  const geo = prepareGeo(countries, disputed);

  it.each(THEMES)("has no glyphs, no sprite and only inline GeoJSON (%s)", (theme) => {
    const style = buildStyle(theme, geo);
    expect(style.glyphs).toBeUndefined();
    expect(style.sprite).toBeUndefined();
    for (const source of Object.values(style.sources)) {
      expect(source.type).toBe("geojson");
      expect(typeof (source as { data: unknown }).data).toBe("object");
    }
    expect(style.layers.some((l) => l.type === "symbol")).toBe(false);
    expect(JSON.stringify(style)).not.toMatch(/https?:/);
  });

  it("paints hatch above the choropleth, so a fill can never claim a disputed area", () => {
    const ids = buildStyle("night", geo).layers.map((l) => l.id);
    expect(ids).toEqual([...LAYER_ORDER]);
    const at = (id: (typeof LAYER_ORDER)[number]) => ids.indexOf(id);
    for (const hatch of [
      "neutral-mask",
      "neutral-hatch",
      "disputed-mask",
      "disputed-hatch",
      "disputed-outline",
    ] as const) {
      expect(at(hatch)).toBeGreaterThan(at("choropleth"));
    }
    expect(at("disputed-hatch")).toBeGreaterThan(at("disputed-mask"));
    expect(at("neutral-hatch")).toBeGreaterThan(at("neutral-mask"));
  });
});

describe("choropleth expressions", () => {
  it("is transparent with no fills", () => {
    expect(choroplethColor(new Map(), "#FD5150")).toBe("rgba(0, 0, 0, 0)");
  });

  it("groups codes by bin and keys on tt_code only", () => {
    const fills = new Map([
      ["FR", { code: "FR", share: 99, status: "official", bin: 4 }],
      ["DE", { code: "DE", share: 95, status: "official", bin: 4 }],
      ["IT", { code: "IT", share: 2, status: null, bin: 1 }],
    ]);
    const expr = choroplethColor(fills, "#FD5150") as unknown as unknown[];
    expect(expr[0]).toBe("match");
    expect(expr[1]).toEqual(["get", "tt_code"]);
    expect(expr).toContainEqual(["DE", "FR"]);
    expect(expr).toContainEqual(["IT"]);
    expect(expr.at(-1)).toBe("rgba(0, 0, 0, 0)");
  });

  it("filters on an empty list without matching anything", () => {
    expect(codeFilter([])).toEqual(["==", ["get", "tt_code"], "__none__"]);
    expect(codeFilter(["FR", "DE"])).toEqual(["in", ["get", "tt_code"], ["literal", ["DE", "FR"]]]);
  });
});
