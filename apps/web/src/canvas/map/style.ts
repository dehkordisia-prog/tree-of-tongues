// The basemap style, built in code from design tokens. No tiles, no glyphs, no sprites: the style has
// only GeoJSON sources that we pass in as objects and no symbol layers, so MapLibre never asks for a
// glyph or sprite URL. Labels are drawn by deck.gl's TextLayer (see controller.ts).

import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

import { ui, type ThemeName } from "@/design/tokens";
import { hexToRgb } from "@/design/color";

import type { MapGeo } from "./data";
import { BIN_LABELS, type Fill } from "./policy";

export interface BasemapColors {
  ocean: string;
  land: string;
  border: string;
  inkLine: string;
  hatch: string;
  accent: string;
  canvas: string;
}

/** Quiet by design: ocean is the canvas, land sits one step above it, borders are hairlines. */
export function basemapColors(theme: ThemeName): BasemapColors {
  const c = ui[theme];
  return {
    ocean: theme === "night" ? c.canvas : c.line,
    land: theme === "night" ? c.raised : c.raised,
    border: c.lineStrong,
    inkLine: c.ink,
    hatch: c.lineStrong,
    accent: c.accent,
    canvas: c.canvas,
  };
}

export const HATCH_IMAGE = (theme: ThemeName) => `tt-hatch-${theme}`;

/** Alpha per share bin. Opacity is the only channel the fill uses; the panel table carries the numbers. */
export const BIN_ALPHA = [0.18, 0.32, 0.5, 0.7, 0.88] as const;

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const NONE = "rgba(0, 0, 0, 0)";

export function choroplethColor(fills: ReadonlyMap<string, Fill>, markHex: string): ExpressionSpecification | string {
  if (fills.size === 0) return NONE;
  const groups: string[][] = BIN_LABELS.map(() => []);
  for (const fill of fills.values()) groups[fill.bin]!.push(fill.code);
  const args: (string | string[])[] = [];
  groups.forEach((codes, bin) => {
    if (codes.length) args.push(codes.sort(), rgba(markHex, BIN_ALPHA[bin]!));
  });
  return ["match", ["get", "tt_code"], ...args, NONE] as unknown as ExpressionSpecification;
}

export function codeFilter(codes: Iterable<string>): ExpressionSpecification {
  const list = [...codes].sort();
  if (list.length === 0) return ["==", ["get", "tt_code"], "__none__"];
  return ["in", ["get", "tt_code"], ["literal", list]];
}

/**
 * Layer order is the policy: the choropleth sits below the hatch layers, so a disputed or neutral
 * area is always painted over (mask first, then hatch) whatever fill lies beneath it.
 */
export const LAYER_ORDER = [
  "ocean",
  "land",
  "choropleth",
  "official-outline",
  "borders",
  "borders-contested",
  "neutral-mask",
  "neutral-hatch",
  "disputed-mask",
  "disputed-hatch",
  "disputed-outline",
  "selected-outline",
] as const;

export function buildStyle(theme: ThemeName, geo: Pick<MapGeo, "countries" | "disputed">): StyleSpecification {
  const c = basemapColors(theme);
  const hatch = HATCH_IMAGE(theme);
  return {
    version: 8,
    // No glyphs and no sprite on purpose. Adding either would add a URL to fetch.
    sources: {
      countries: { type: "geojson", data: geo.countries as never },
      disputed: { type: "geojson", data: geo.disputed as never },
    },
    layers: [
      { id: "ocean", type: "background", paint: { "background-color": c.ocean } },
      { id: "land", type: "fill", source: "countries", paint: { "fill-color": c.land } },
      { id: "choropleth", type: "fill", source: "countries", paint: { "fill-color": NONE } },
      {
        id: "official-outline",
        type: "line",
        source: "countries",
        filter: codeFilter([]),
        paint: { "line-color": c.inkLine, "line-width": 1.6, "line-opacity": 0.9 },
      },
      {
        id: "borders",
        type: "line",
        source: "countries",
        filter: ["!=", ["get", "tt_contested"], true],
        paint: { "line-color": c.border, "line-width": 0.6, "line-opacity": 0.8 },
      },
      {
        id: "borders-contested",
        type: "line",
        source: "countries",
        filter: ["==", ["get", "tt_contested"], true],
        paint: { "line-color": c.border, "line-width": 1, "line-dasharray": [3, 2] },
      },
      {
        id: "neutral-mask",
        type: "fill",
        source: "countries",
        filter: ["==", ["get", "tt_neutral"], true],
        paint: { "fill-color": c.land },
      },
      {
        id: "neutral-hatch",
        type: "fill",
        source: "countries",
        filter: ["==", ["get", "tt_neutral"], true],
        paint: { "fill-pattern": hatch },
      },
      { id: "disputed-mask", type: "fill", source: "disputed", paint: { "fill-color": c.land } },
      { id: "disputed-hatch", type: "fill", source: "disputed", paint: { "fill-pattern": hatch } },
      {
        id: "disputed-outline",
        type: "line",
        source: "disputed",
        paint: { "line-color": c.border, "line-width": 1, "line-dasharray": [3, 2] },
      },
      {
        id: "selected-outline",
        type: "line",
        source: "countries",
        filter: codeFilter([]),
        paint: { "line-color": c.accent, "line-width": 2.6 },
      },
    ],
  };
}

/** One tile of the neutral hatch, as RGBA pixels for map.addImage. Not a family pattern. */
export function hatchTile(color: string, scale: number): { width: number; height: number; data: Uint8ClampedArray } {
  const size = Math.round(8 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.lineCap = "square";
  ctx.beginPath();
  for (const dx of [-8, 0, 8]) {
    ctx.moveTo(dx, 8);
    ctx.lineTo(dx + 8, 0);
  }
  ctx.stroke();
  const img = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: img.data };
}
