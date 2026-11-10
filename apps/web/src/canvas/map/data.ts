// Data loading for the map spike. Everything comes from /data/ on this origin (Vite dev plugin or
// scripts/serve.mjs). Nothing is fetched from a third party. When /data is missing the loaders throw
// DataMissingError and the page shows the "not built yet" state; tests pass without data.

import { OTHER_INDEX, familyIndexByGlottocode, type TreeFile } from "./families";
import { slimCountryProps, type SlimCountry, type TerritoryRow } from "./policy";

export const DATA_URLS = {
  countries: "/data/geo/countries_50m.geojson",
  disputed: "/data/geo/disputed_areas_50m.geojson",
  languages: "/data/geo/languages.geojson",
  tree: "/data/tree.json",
  territoryIndex: "/data/derived/territory_index.json",
  bundle: (glottocode: string) => `/data/bundles/${glottocode}.json`,
} as const;

export class DataMissingError extends Error {
  constructor(public readonly url: string) {
    super(`Data missing: ${url}`);
    this.name = "DataMissingError";
  }
}

/** A dev server answers unknown paths with its HTML page and status 200, so check the content type too. */
export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new DataMissingError(url);
  }
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) throw new DataMissingError(url);
  try {
    return (await res.json()) as T;
  } catch {
    throw new DataMissingError(url);
  }
}

/* --------------------------------------------------------------- geometry */

export type Position = [number, number];
interface Geometry {
  type: string;
  coordinates: unknown;
}
export interface Feature<P> {
  type: "Feature";
  properties: P;
  geometry: Geometry;
}
export interface FeatureCollection<P> {
  type: "FeatureCollection";
  features: Feature<P>[];
}

function ringsOf(g: Geometry): Position[][][] {
  if (g.type === "Polygon") return [g.coordinates as Position[][]];
  if (g.type === "MultiPolygon") return g.coordinates as Position[][][];
  return [];
}

/** Signed shoelace area and centroid of an outer ring, in degrees. */
function ringStats(ring: Position[]): { area: number; cx: number; cy: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, n = ring.length - 1; i < n; i++) {
    const [x0, y0] = ring[i]!;
    const [x1, y1] = ring[i + 1]!;
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (a === 0) return { area: 0, cx: ring[0]?.[0] ?? 0, cy: ring[0]?.[1] ?? 0 };
  return { area: a / 2, cx: cx / (6 * (a / 2)), cy: cy / (6 * (a / 2)) };
}

export interface Shape {
  /** Label anchor: centroid of the largest outer ring. */
  anchor: Position;
  /** Size rank key: area of the largest ring, scaled by cos(latitude). */
  size: number;
  /** [west, south, east, north] of the largest ring. Avoids world-wide boxes for states that cross 180. */
  bbox: [number, number, number, number];
}

export function shapeOf(g: Geometry): Shape | null {
  let best: { area: number; cx: number; cy: number; ring: Position[] } | null = null;
  for (const polygon of ringsOf(g)) {
    const outer = polygon[0];
    if (!outer || outer.length < 4) continue;
    const s = ringStats(outer);
    if (!best || Math.abs(s.area) > Math.abs(best.area)) best = { ...s, ring: outer };
  }
  if (!best) return null;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const [x, y] of best.ring) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return {
    anchor: [best.cx, best.cy],
    size: Math.abs(best.area) * Math.cos((best.cy * Math.PI) / 180),
    bbox: [w, s, e, n],
  };
}

/* -------------------------------------------------------------- countries */

export interface CountryInfo {
  code: string;
  name: string;
  contested: boolean;
  note: string | null;
  shape: Shape | null;
}

export interface DisputedInfo {
  id: string;
  name: string;
  note: string | null;
  shape: Shape | null;
}

export interface MapGeo {
  countries: FeatureCollection<SlimCountry>;
  disputed: FeatureCollection<{ NAME: string; BRK_A3: string; NOTE_BRK: string | null }>;
  /** Countries that can be filled, by their own code. */
  byCode: Map<string, CountryInfo>;
  /** Entities hatched and never filled, plus the disputed-area polygons, deduplicated by id. */
  neutral: DisputedInfo[];
  drawableCodes: Set<string>;
  /** Label candidates, largest first. */
  labels: { name: string; position: Position; rank: number }[];
}

type RawProps = Record<string, unknown>;

export function prepareGeo(
  rawCountries: FeatureCollection<RawProps>,
  rawDisputed: FeatureCollection<RawProps>,
): MapGeo {
  const byCode = new Map<string, CountryInfo>();
  const neutral: DisputedInfo[] = [];
  const labelRows: { name: string; position: Position; size: number }[] = [];

  const countries: FeatureCollection<SlimCountry> = {
    type: "FeatureCollection",
    features: rawCountries.features.map((f) => {
      const props = slimCountryProps(f.properties);
      const shape = shapeOf(f.geometry);
      if (props.tt_code) {
        const prev = byCode.get(props.tt_code);
        // Two polygons sharing a code: keep the larger for fly-to and labels.
        if (!prev || (shape && (!prev.shape || shape.size > prev.shape.size))) {
          byCode.set(props.tt_code, {
            code: props.tt_code,
            name: props.NAME_EN,
            contested: props.tt_contested,
            note: props.NOTE_BRK,
            shape,
          });
        }
      } else if (props.tt_neutral) {
        neutral.push({ id: `n:${props.ADM0_A3}`, name: props.NAME_EN, note: props.NOTE_BRK, shape });
      }
      if (shape && props.NAME_EN && !props.tt_neutral) {
        labelRows.push({ name: props.NAME_EN, position: shape.anchor, size: shape.size });
      }
      return { type: "Feature", properties: props, geometry: f.geometry };
    }),
  };

  const seen = new Set<string>();
  const disputed: MapGeo["disputed"] = {
    type: "FeatureCollection",
    features: rawDisputed.features.map((f) => {
      const p = f.properties;
      const props = {
        // NAME_EN names the area. NAME is the administering state, which would read as ownership.
        NAME: String(p["NAME_EN"] ?? p["NAME"] ?? ""),
        BRK_A3: String(p["BRK_A3"] ?? ""),
        NOTE_BRK: typeof p["NOTE_BRK"] === "string" ? (p["NOTE_BRK"] as string) : null,
      };
      const id = `d:${props.BRK_A3}`;
      if (!seen.has(id)) {
        seen.add(id);
        neutral.push({ id, name: props.NAME, note: props.NOTE_BRK, shape: shapeOf(f.geometry) });
      }
      return { type: "Feature", properties: props, geometry: f.geometry };
    }),
  };

  labelRows.sort((a, b) => b.size - a.size);
  return {
    countries,
    disputed,
    byCode,
    neutral,
    drawableCodes: new Set(byCode.keys()),
    labels: labelRows.map((l, rank) => ({ name: l.name, position: l.position, rank })),
  };
}

/* ----------------------------------------------------------- language points */

export interface LanguagePoints {
  count: number;
  glottocodes: string[];
  names: string[];
  /** 0 family, 1 language, 2 dialect. */
  levels: Uint8Array;
  /** Longitude, latitude pairs. */
  lonlat: Float32Array;
  /** Index into FAMILY_ORDER. */
  family: Uint8Array;
  index: Map<string, number>;
}

const LEVEL = { family: 0, language: 1, dialect: 2 } as const;

export function parseLanguagePoints(
  fc: FeatureCollection<{ glottocode: string; level: string; name: string }>,
  familyOf: Map<string, number> | null,
): LanguagePoints {
  const n = fc.features.length;
  const glottocodes: string[] = [];
  const names: string[] = [];
  const levels = new Uint8Array(n);
  const lonlat = new Float32Array(n * 2);
  const family = new Uint8Array(n);
  const index = new Map<string, number>();
  let k = 0;
  for (const f of fc.features) {
    if (f.geometry.type !== "Point") continue;
    const [lon, lat] = f.geometry.coordinates as Position;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const p = f.properties;
    glottocodes.push(p.glottocode);
    names.push(p.name);
    levels[k] = LEVEL[p.level as keyof typeof LEVEL] ?? 1;
    lonlat[2 * k] = lon;
    lonlat[2 * k + 1] = lat;
    family[k] = familyOf?.get(p.glottocode) ?? OTHER_INDEX;
    index.set(p.glottocode, k);
    k++;
  }
  return {
    count: k,
    glottocodes,
    names,
    levels: levels.slice(0, k),
    lonlat: lonlat.slice(0, 2 * k),
    family: family.slice(0, k),
    index,
  };
}

/* --------------------------------------------------------------- bundles */

export interface TerritoryBlock {
  confidence: string;
  items: (TerritoryRow & { cldr_code?: string; year: number | null })[];
  locator_template: string;
  notes: string | null;
  retrieved_at: string;
  source_id: string;
}

export interface Bundle {
  glottocode: string;
  languoid: { name: string; level: string; iso639_3: string | null; latitude: number | null; longitude: number | null };
  lineage: { glottocode: string; name: string; level: string }[];
  territories: TerritoryBlock[];
  sources?: Record<string, { license: string; version: string; attribution: string; url: string }>;
}

export interface TerritoryIndex {
  provenance: { source_id: string; locator_template: string; retrieved_at: string; confidence: string; notes: string | null } | null;
  territories: Record<string, [string, number, string | null][]>;
}

export interface LoadedData {
  geo: MapGeo;
  points: LanguagePoints;
  /** Null when tree.json is missing: points are then all drawn as "other". */
  hasFamilies: boolean;
  /** Null when the stopgap index is missing. */
  territoryIndex: TerritoryIndex | null;
  /** Data load and parse time, ms. */
  loadMs: number;
}

/** Required: countries, disputed areas, language points. Optional: tree (colors), territory index. */
export async function loadAll(signal?: AbortSignal): Promise<LoadedData> {
  const t0 = performance.now();
  const optional = async <T>(url: string): Promise<T | null> => {
    try {
      return await fetchJson<T>(url, signal);
    } catch (error) {
      if (error instanceof DataMissingError) return null;
      throw error;
    }
  };
  const [countries, disputed, languages, tree, territoryIndex] = await Promise.all([
    fetchJson<FeatureCollection<RawProps>>(DATA_URLS.countries, signal),
    fetchJson<FeatureCollection<RawProps>>(DATA_URLS.disputed, signal),
    fetchJson<FeatureCollection<{ glottocode: string; level: string; name: string }>>(DATA_URLS.languages, signal),
    optional<TreeFile>(DATA_URLS.tree),
    optional<TerritoryIndex>(DATA_URLS.territoryIndex),
  ]);
  const geo = prepareGeo(countries, disputed);
  const points = parseLanguagePoints(languages, tree ? familyIndexByGlottocode(tree) : null);
  return { geo, points, hasFamilies: tree !== null, territoryIndex, loadMs: performance.now() - t0 };
}
