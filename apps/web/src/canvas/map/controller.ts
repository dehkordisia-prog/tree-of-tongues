// MapLibre GL + deck.gl, kept out of React. This module is imported only through a dynamic import,
// so neither library lands in the app-shell bundle.
//
// Layers:
//   MapLibre (style.ts): ocean, land, choropleth, outlines, hatch for disputed and neutral areas.
//   deck.gl (interleaved with MapLibre): language points (ScatterplotLayer, binary attributes),
//   a ring around the selected point, and country names (TextLayer, drawn from a generated font atlas,
//   so there are no glyph URLs).
//
// Zero third-party requests: the style has GeoJSON sources passed in as objects, no tiles, no glyphs,
// no sprite; deck.gl's TextLayer builds its atlas on a canvas; MapLibre's attribution control is off
// (attribution is real page text); no RTL text plugin is requested.

import { ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { Map as MapLibreMap, setWorkerUrl, type IControl, type Map as MlMap } from "maplibre-gl";
// MapLibre finds its worker next to its own module by default. Vite moves that module, so give the
// worker file explicitly: Vite serves it in dev and emits it as a hashed asset in the build.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";

import { canvasColor, familyColor, flightDuration, ui, type FamilyId, type ThemeName } from "@/design/tokens";

import type { BenchImpl, Camera } from "./bench";
import type { LanguagePoints, MapGeo } from "./data";
import { FAMILY_ORDER } from "./families";
import { hasOfficialOutline, type Fill } from "./policy";
import { BIN_ALPHA, HATCH_IMAGE, basemapColors, buildStyle, choroplethColor, codeFilter, hatchTile, rgba } from "./style";

export type Hit =
  | { kind: "language"; index: number }
  | { kind: "country"; code: string }
  | { kind: "neutral"; id: string };

export interface ControllerOptions {
  container: HTMLElement;
  theme: ThemeName;
  geo: MapGeo;
  points: LanguagePoints;
  showDialects: boolean;
  reducedMotion: boolean;
  mapTitle: string;
  onHit(hit: Hit | null): void;
}

/** How many country names to draw at a zoom level, largest countries first. No collision culling in Phase 0. */
export function labelCountAt(zoom: number): number {
  if (zoom < 2.2) return 0;
  if (zoom < 3.2) return 22;
  if (zoom < 4.2) return 55;
  if (zoom < 5.2) return 110;
  return 260;
}

function addHatch(map: MlMap, theme: ThemeName): void {
  const scale = window.devicePixelRatio >= 1.5 ? 2 : 1;
  map.addImage(HATCH_IMAGE(theme), hatchTile(basemapColors(theme).hatch, scale), { pixelRatio: scale });
}

const FONT = '"Tongues Sans", system-ui, sans-serif';

export class MapController {
  readonly map: MlMap;
  private readonly overlay: MapboxOverlay;
  private theme: ThemeName;
  private showDialects: boolean;
  private familyFilter: number | null = null;
  private dim = false;
  private selected: number | null = null;
  private visible = new Uint32Array(0);
  private positions = new Float32Array(0);
  private colors = new Uint8Array(0);
  private labelCount = 0;
  /** Every character in every country name: a fixed set builds the font atlas once, up front. */
  private readonly labelChars: string[];
  private fillMark: FamilyId | null = null;
  private destroyed = false;
  private readonly opts: ControllerOptions;

  private constructor(map: MlMap, opts: ControllerOptions) {
    this.map = map;
    this.opts = opts;
    this.theme = opts.theme;
    this.labelChars = [...new Set(opts.geo.labels.map((l) => l.name).join(""))];
    this.showDialects = opts.showDialects;
    this.overlay = new MapboxOverlay({ interleaved: true, layers: [] });
    map.addControl(this.overlay as unknown as IControl);
  }

  static async create(opts: ControllerOptions): Promise<MapController> {
    setWorkerUrl(workerUrl);
    const map = new MapLibreMap({
      container: opts.container,
      style: buildStyle(opts.theme, opts.geo),
      center: [15, 25],
      zoom: Math.max(0, Math.log2(Math.max(opts.container.clientWidth, 1) / 512) - 0.1),
      minZoom: 0,
      maxZoom: 11,
      maxPitch: 0,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
      fadeDuration: 0,
      locale: { "Map.Title": opts.mapTitle },
    });
    // MapLibre 6 keeps its transform on an internal camera object; deck.gl 9.4.1 (@deck.gl/mapbox)
    // still reads map.transform. Without this alias every interleaved frame throws.
    if (!("transform" in map)) {
      Object.defineProperty(map, "transform", {
        configurable: true,
        get: () => (map as unknown as { _camera: { transform: unknown } })._camera.transform,
      });
    }
    // The hatch images are generated on first request, so the style never asks for a missing image.
    map.setMissingStyleImageResolver((id) => {
      for (const theme of ["night", "parchment"] as const) {
        if (id === HATCH_IMAGE(theme) && !map.hasImage(id)) addHatch(map, theme);
      }
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    const controller = new MapController(map, opts);
    await new Promise<void>((resolve, reject) => {
      map.once("load", () => resolve());
      map.once("error", (e) => reject(e.error));
    });
    controller.addImages();
    controller.applyTheme(opts.theme);
    controller.rebuildPoints();
    controller.bindEvents();
    controller.render();
    return controller;
  }

  /* ------------------------------------------------------------- images */

  private addImages(): void {
    for (const theme of ["night", "parchment"] as const) {
      if (!this.map.hasImage(HATCH_IMAGE(theme))) addHatch(this.map, theme);
    }
  }

  /* ----------------------------------------------------------- events */

  private bindEvents(): void {
    const { map } = this;
    map.on("click", (e) => {
      const hit = this.hitAt(e.point.x, e.point.y);
      this.opts.onHit(hit);
    });
    map.on("mousemove", (e) => {
      const over = this.overlay.pickObject({ x: e.point.x, y: e.point.y, radius: 5, layerIds: ["languages"] });
      map.getCanvas().style.cursor = over ? "pointer" : "";
    });
    map.on("zoom", () => this.updateLabels());
    this.updateLabels();
  }

  private hitAt(x: number, y: number): Hit | null {
    const picked = this.overlay.pickObject({ x, y, radius: 6, layerIds: ["languages"] });
    if (picked && typeof picked.index === "number" && picked.index >= 0) {
      const index = this.visible[picked.index];
      if (index !== undefined) return { kind: "language", index };
    }
    const neutral = this.map.queryRenderedFeatures([x, y], { layers: ["disputed-hatch", "neutral-hatch"] })[0];
    if (neutral) {
      const p = neutral.properties as { BRK_A3?: string; ADM0_A3?: string };
      return { kind: "neutral", id: neutral.layer.id === "disputed-hatch" ? `d:${p.BRK_A3}` : `n:${p.ADM0_A3}` };
    }
    const country = this.map.queryRenderedFeatures([x, y], { layers: ["land"] })[0];
    const code = (country?.properties as { tt_code?: string } | undefined)?.tt_code;
    return code ? { kind: "country", code } : null;
  }

  /* ------------------------------------------------------------ theme */

  applyTheme(theme: ThemeName): void {
    this.theme = theme;
    const c = basemapColors(theme);
    const { map } = this;
    map.setPaintProperty("ocean", "background-color", c.ocean);
    map.setPaintProperty("land", "fill-color", c.land);
    map.setPaintProperty("neutral-mask", "fill-color", c.land);
    map.setPaintProperty("disputed-mask", "fill-color", c.land);
    map.setPaintProperty("neutral-hatch", "fill-pattern", HATCH_IMAGE(theme));
    map.setPaintProperty("disputed-hatch", "fill-pattern", HATCH_IMAGE(theme));
    for (const id of ["borders", "borders-contested", "disputed-outline"]) map.setPaintProperty(id, "line-color", c.border);
    map.setPaintProperty("official-outline", "line-color", c.inkLine);
    map.setPaintProperty("selected-outline", "line-color", c.accent);
    this.applyChoroplethColor();
    this.rebuildColors();
    this.render();
  }

  /* ------------------------------------------------------- choropleth */

  private fills: ReadonlyMap<string, Fill> = new Map();

  setChoropleth(fills: ReadonlyMap<string, Fill>, family: number | null): void {
    this.fills = fills;
    this.fillMark = family === null ? null : FAMILY_ORDER[family] ?? null;
    this.applyChoroplethColor();
    const official = [...fills.values()].filter((f) => hasOfficialOutline(f.status)).map((f) => f.code);
    this.map.setFilter("official-outline", codeFilter(official));
  }

  private applyChoroplethColor(): void {
    const mark = familyColor(this.fillMark ?? "other", this.theme).hex;
    this.map.setPaintProperty("choropleth", "fill-color", choroplethColor(this.fills, mark));
  }

  setSelectedCountry(code: string | null): void {
    this.map.setFilter("selected-outline", codeFilter(code ? [code] : []));
  }

  /** Legend swatch colors for the bins, in the current theme. */
  binColors(): string[] {
    const mark = familyColor(this.fillMark ?? "other", this.theme).hex;
    return BIN_ALPHA.map((a) => rgba(mark, a));
  }

  /* ------------------------------------------------------------ points */

  setShowDialects(on: boolean): void {
    this.showDialects = on;
    this.rebuildPoints();
    this.render();
  }

  setFamilyFilter(family: number | null): void {
    this.familyFilter = family;
    this.rebuildColors();
    this.render();
  }

  /** Dim data layers when the time slider is away from the present: no data for that period. */
  setDim(dim: boolean): void {
    this.dim = dim;
    this.map.setPaintProperty("choropleth", "fill-opacity", dim ? 0.15 : 1);
    this.map.setPaintProperty("official-outline", "line-opacity", dim ? 0.15 : 0.9);
    this.rebuildColors();
    this.render();
  }

  setSelectedPoint(index: number | null): void {
    this.selected = index;
    this.render();
  }

  get pointCount(): number {
    return this.opts.points.count;
  }

  get drawnCount(): number {
    return this.visible.length;
  }

  private rebuildPoints(): void {
    const { points } = this.opts;
    let m = 0;
    const keep = new Uint32Array(points.count);
    for (let i = 0; i < points.count; i++) {
      const level = points.levels[i]!;
      if (level === 1 || (level === 2 && this.showDialects)) keep[m++] = i;
    }
    this.visible = keep.slice(0, m);
    this.positions = new Float32Array(m * 2);
    for (let k = 0; k < m; k++) {
      const i = this.visible[k]!;
      this.positions[2 * k] = points.lonlat[2 * i]!;
      this.positions[2 * k + 1] = points.lonlat[2 * i + 1]!;
    }
    this.colors = new Uint8Array(m * 4);
    this.rebuildColors();
  }

  private rebuildColors(): void {
    const { points } = this.opts;
    const palette = FAMILY_ORDER.map((id) => familyColor(id, this.theme).rgba);
    const base = this.dim ? 40 : 210;
    const faint = this.dim ? 12 : 26;
    for (let k = 0; k < this.visible.length; k++) {
      const f = points.family[this.visible[k]!]!;
      const [r, g, b] = palette[f]!;
      const on = this.familyFilter === null || this.familyFilter === f;
      this.colors[4 * k] = r;
      this.colors[4 * k + 1] = g;
      this.colors[4 * k + 2] = b;
      this.colors[4 * k + 3] = on ? base : faint;
    }
    // New array identity tells deck.gl the attribute changed.
    this.colors = new Uint8Array(this.colors);
  }

  /* ------------------------------------------------------------ labels */

  private updateLabels(): void {
    const count = Math.min(labelCountAt(this.map.getZoom()), this.opts.geo.labels.length);
    if (count !== this.labelCount) {
      this.labelCount = count;
      this.render();
    }
  }

  get labelsDrawn(): number {
    return this.labelCount;
  }

  /* ------------------------------------------------------------ render */

  private render(): void {
    if (this.destroyed) return;
    const c = ui[this.theme];
    const ink = canvasColor(c.ink).rgba;
    const halo = canvasColor(basemapColors(this.theme).canvas, 230).rgba;
    const selected = this.selected === null ? [] : [this.selected];
    const { points, geo } = this.opts;
    const labels = geo.labels.slice(0, this.labelCount);
    const data = {
      length: this.visible.length,
      attributes: {
        getPosition: { value: this.positions, size: 2 },
        getFillColor: { value: this.colors, size: 4, normalized: true },
      },
    };
    this.overlay.setProps({
      layers: [
        new ScatterplotLayer({
          id: "languages",
          data: data as never,
          positionFormat: "XY",
          pickable: true,
          radiusUnits: "meters",
          getRadius: 9000,
          radiusMinPixels: 1.6,
          radiusMaxPixels: 4.5,
          stroked: false,
          updateTriggers: { getFillColor: [this.colors] },
        }),
        new ScatterplotLayer({
          id: "selected-point",
          data: selected,
          getPosition: (i: number) => [points.lonlat[2 * i]!, points.lonlat[2 * i + 1]!],
          radiusUnits: "pixels",
          getRadius: 9,
          filled: false,
          stroked: true,
          lineWidthUnits: "pixels",
          getLineWidth: 2.5,
          getLineColor: canvasColor(c.focus).rgba,
          pickable: false,
        }),
        new TextLayer({
          id: "country-labels",
          data: labels,
          getText: (d) => d.name,
          getPosition: (d) => d.position,
          getSize: 12,
          sizeUnits: "pixels",
          getColor: this.dim ? [ink[0], ink[1], ink[2], 90] : ink,
          fontFamily: FONT,
          fontWeight: 500,
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: halo,
          background: false,
          characterSet: this.labelChars,
          pickable: false,
        }),
      ],
    });
  }

  /* ------------------------------------------------------------- camera */

  focusPoint(index: number): void {
    const { points } = this.opts;
    const target = { center: [points.lonlat[2 * index]!, points.lonlat[2 * index + 1]!] as [number, number], zoom: Math.max(this.map.getZoom(), 4.5) };
    this.move(() => this.map.easeTo({ ...target, duration: flightDuration(2) }), () => this.map.jumpTo(target));
  }

  focusBox(bbox: [number, number, number, number]): void {
    const [w, s, e, n] = bbox;
    const opts = { padding: 48, maxZoom: 6 };
    this.move(
      () => this.map.fitBounds([[w, s], [e, n]], { ...opts, duration: flightDuration(2) }),
      () => this.map.fitBounds([[w, s], [e, n]], { ...opts, duration: 0 }),
    );
  }

  private move(animate: () => void, jump: () => void): void {
    if (this.opts.reducedMotion) jump();
    else animate();
  }

  setReducedMotion(on: boolean): void {
    this.opts.reducedMotion = on;
  }

  setCamera(c: Camera): void {
    this.map.jumpTo({ center: [c.lng, c.lat], zoom: c.zoom });
  }

  /**
   * Resolves after every source has loaded and two frames have drawn. Gives up waiting for the
   * idle event after 15 s, so a slow software renderer cannot leave the page "loading" forever.
   */
  async settled(): Promise<void> {
    if (!this.map.areTilesLoaded() || this.map.isMoving()) {
      await Promise.race([
        new Promise<void>((r) => this.map.once("idle", () => r())),
        new Promise<void>((r) => setTimeout(r, 15_000)),
      ]);
    }
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  }

  benchImpl(loadMs: number, firstFrameMs: () => number): BenchImpl {
    return {
      nodes: this.opts.points.count,
      layoutMs: loadMs,
      get firstFrameMs() {
        return firstFrameMs();
      },
      setCamera: (c) => this.setCamera(c),
      labelsDrawn: () => this.labelCount,
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.overlay.finalize();
    this.map.remove();
  }
}
