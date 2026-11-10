// The shell URL contract (docs/specs/app-shell.md, sections 2.1 and 2.2). Pure: no DOM, no React.
//
//   parseShellUrl(pathname, search)  ->  UrlState plus kept developer flags
//   toShellHref(state, flags)        ->  the canonical href (defaults omitted, params in spec order)
//
// Invalid values are dropped; canonicalize() gives the href the address bar should show.

import { isLocale, type Locale } from "@/i18n/direction";

export type Lens = "tree" | "map"; // "time" reserved, Phase 2
export const LENSES: readonly Lens[] = ["tree", "map"];
export type MacroCode = "ara" | "fas" | "zho";
export const MACRO_CODES: readonly MacroCode[] = ["ara", "fas", "zho"];

/**
 * Lumper/Splitter groups (D-023): the ids of `lumper_groups` in content/scope/phase-1-languages.yaml.
 * `?lump=` carries these ids; a unit test keeps this list equal to the scope list. The ISO codes of
 * D-022 (ara, fas, zho) are read as aliases, so older links open the same group.
 */
export const LUMP_GROUPS = [
  "arabic",
  "chinese",
  "filipino",
  "hindustani",
  "kurdish",
  "malay",
  "persian",
  "punjabi",
] as const;
export type LumpGroup = (typeof LUMP_GROUPS)[number];
const LUMP_ALIASES: Readonly<Record<string, LumpGroup>> = { ara: "arabic", fas: "persian", zho: "chinese" };

export function isLumpGroup(v: unknown): v is LumpGroup {
  return typeof v === "string" && (LUMP_GROUPS as readonly string[]).includes(v);
}

export type Selection =
  | { kind: "language"; glottocode: string }
  | { kind: "family"; glottocode: string }
  | { kind: "macrolanguage"; iso: MacroCode }
  | { kind: "country"; iso: string }
  | null;

export type LanguageTab =
  "overview" | "speakers" | "where" | "writing" | "sounds" | "words" | "family" | "sources";
export type FamilyTab = "overview" | "members" | "where" | "sources";
export type MacroTab = "overview" | "speakers" | "where" | "sources";
export type CountryTab = "languages" | "sources";
export type Tab = LanguageTab | FamilyTab | MacroTab | CountryTab;

export const LANGUAGE_TABS: readonly LanguageTab[] = [
  "overview",
  "speakers",
  "where",
  "writing",
  "sounds",
  "words",
  "family",
  "sources",
];
export const FAMILY_TABS: readonly FamilyTab[] = ["overview", "members", "where", "sources"];
export const MACRO_TABS: readonly MacroTab[] = ["overview", "speakers", "where", "sources"];
export const COUNTRY_TABS: readonly CountryTab[] = ["languages", "sources"];

export type TreeCamera = { tz: number; dx: number; dy: number };
export type MapCamera = { zoom: number; lat: number; lon: number };

export interface UrlState {
  selection: Selection;
  lens: Lens;
  tab: Tab;
  lumped: readonly LumpGroup[];
  classification: "glottolog";
  year: null;
  area: string | null;
  mapDialects: boolean;
  treeCamera: TreeCamera | null;
  mapCamera: MapCamera | null;
  locale: Locale;
}

/** Developer flags survive canonicalization. `renderer` is kept in every build (the D-006 benchmark needs it). */
export interface DevFlags {
  renderer?: "deck";
  bench?: "1";
  stress?: "1";
}

export interface ParseOptions {
  /** Keep bench and stress (dev builds only). */
  dev?: boolean;
}

export interface Parsed {
  state: UrlState;
  flags: DevFlags;
  /** False when the path is not a shell route. */
  isShell: boolean;
}

const GLOTTOCODE = /^[a-z0-9]{4}[0-9]{4}$/;
const COUNTRY = /^[a-z]{2}$/;
const AREA = /^[a-z0-9:_-]{1,40}$/i;
const NUM = /^-?\d+(\.\d+)?$/;

export function isGlottocode(s: string | undefined | null): s is string {
  return typeof s === "string" && GLOTTOCODE.test(s);
}

export const round = (n: number, d: number): number => {
  const k = 10 ** d;
  const r = Math.round(n * k) / k;
  return Object.is(r, -0) ? 0 : r;
};

export function tabsFor(sel: Selection): readonly Tab[] {
  if (!sel) return [];
  switch (sel.kind) {
    case "language":
      return LANGUAGE_TABS;
    case "family":
      return FAMILY_TABS;
    case "macrolanguage":
      return MACRO_TABS;
    case "country":
      return COUNTRY_TABS;
  }
}

export function defaultTab(sel: Selection): Tab {
  return sel?.kind === "country" ? "languages" : "overview";
}

export function defaultLens(sel: Selection): Lens {
  return sel?.kind === "country" ? "map" : "tree";
}

export function selectionPath(sel: Selection): string {
  if (!sel) return "/";
  switch (sel.kind) {
    case "language":
      return `/language/${sel.glottocode}`;
    case "family":
      return `/family/${sel.glottocode}`;
    case "macrolanguage":
      return `/macrolanguage/${sel.iso}`;
    case "country":
      return `/country/${sel.iso}`;
  }
}

export function sameSelection(a: Selection, b: Selection): boolean {
  return selectionPath(a) === selectionPath(b);
}

export function parseSelection(pathname: string): { selection: Selection; isShell: boolean } {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { selection: null, isShell: true };
  const m = /^\/(language|family|macrolanguage|country)\/([^/]+)$/.exec(path);
  if (!m) return { selection: null, isShell: false };
  const [, kind, id] = m as unknown as [string, string, string];
  if (kind === "language" || kind === "family") {
    return { selection: { kind, glottocode: id }, isShell: true };
  }
  if (kind === "macrolanguage") {
    return (MACRO_CODES as readonly string[]).includes(id)
      ? { selection: { kind, iso: id as MacroCode }, isShell: true }
      : { selection: null, isShell: false };
  }
  return COUNTRY.test(id)
    ? { selection: { kind: "country", iso: id }, isShell: true }
    : { selection: null, isShell: false };
}

function parseNumber(v: string | null): number | null {
  if (v === null || !NUM.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseTreeCamera(tz: string | null, tc: string | null): TreeCamera | null {
  let z = 0;
  let dx = 0;
  let dy = 0;
  if (tz !== null) {
    const n = parseNumber(tz);
    if (n !== null && Math.abs(n) <= 30) z = round(n, 2);
  }
  if (tc !== null) {
    const parts = tc.split(",");
    const a = parts.length === 2 ? parseNumber(parts[0]!) : null;
    const b = parts.length === 2 ? parseNumber(parts[1]!) : null;
    if (a !== null && b !== null && Math.abs(a) <= 1e4 && Math.abs(b) <= 1e4) {
      dx = round(a, 2);
      dy = round(b, 2);
    }
  }
  return z === 0 && dx === 0 && dy === 0 ? null : { tz: z, dx, dy };
}

export function parseMapCamera(v: string | null): MapCamera | null {
  if (v === null) return null;
  const parts = v.split("/");
  if (parts.length !== 3) return null;
  const [z, lat, lon] = parts.map(parseNumber) as [number | null, number | null, number | null];
  if (z === null || lat === null || lon === null) return null;
  if (z < 0 || z > 22 || lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { zoom: round(z, 2), lat: round(lat, 3), lon: round(lon, 3) };
}

export function formatTreeCamera(c: TreeCamera): { tz?: string; tc?: string } {
  const out: { tz?: string; tc?: string } = {};
  const z = round(c.tz, 2);
  const dx = round(c.dx, 2);
  const dy = round(c.dy, 2);
  if (z !== 0) out.tz = z.toFixed(2);
  if (dx !== 0 || dy !== 0) out.tc = `${dx.toFixed(2)},${dy.toFixed(2)}`;
  return out;
}

export function formatMapCamera(c: MapCamera): string {
  return `${round(c.zoom, 2).toFixed(2)}/${round(c.lat, 3).toFixed(3)}/${round(c.lon, 3).toFixed(3)}`;
}

export const DEFAULT_STATE: UrlState = {
  selection: null,
  lens: "tree",
  tab: "overview",
  lumped: [],
  classification: "glottolog",
  year: null,
  area: null,
  mapDialects: false,
  treeCamera: null,
  mapCamera: null,
  locale: "en",
};

export function parseShellUrl(pathname: string, search: string, opts: ParseOptions = {}): Parsed {
  const { selection, isShell } = parseSelection(pathname);
  const q = new URLSearchParams(search);
  const lensParam = q.get("lens");
  const lens: Lens = (LENSES as readonly string[]).includes(lensParam ?? "")
    ? (lensParam as Lens)
    : defaultLens(selection);
  const tabParam = q.get("tab");
  const tab: Tab = (tabsFor(selection) as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : defaultTab(selection);
  const lumped = [
    ...new Set(
      (q.get("lump") ?? "")
        .split(",")
        .map((c) => LUMP_ALIASES[c] ?? c)
        .filter(isLumpGroup),
    ),
  ].sort();
  const areaParam = q.get("area");
  const area = selection === null && lens === "map" && areaParam && AREA.test(areaParam) ? areaParam : null;
  const lang = q.get("lang");
  const flags: DevFlags = {};
  if (q.get("renderer") === "deck") flags.renderer = "deck";
  if (opts.dev && q.get("bench") === "1") flags.bench = "1";
  if (opts.dev && q.get("stress") === "1") flags.stress = "1";
  return {
    isShell,
    flags,
    state: {
      selection,
      lens,
      tab,
      lumped,
      classification: "glottolog",
      year: null, // Phase 1 strips ?year (Phase 2 adds the time lens).
      area,
      mapDialects: q.get("dialects") === "1",
      treeCamera: parseTreeCamera(q.get("tz"), q.get("tc")),
      mapCamera: parseMapCamera(q.get("map")),
      locale: isLocale(lang) ? lang : "en",
    },
  };
}

/** Canonical href: path, then lens, tab, lump, class, year, area, dialects, tz, tc, map, lang, then dev flags. */
export function toShellHref(state: UrlState, flags: DevFlags = {}): string {
  const parts: [string, string][] = [];
  const sel = state.selection;
  if (state.lens !== defaultLens(sel)) parts.push(["lens", state.lens]);
  if (sel && state.tab !== defaultTab(sel) && (tabsFor(sel) as readonly string[]).includes(state.tab))
    parts.push(["tab", state.tab]);
  if (state.lumped.length) parts.push(["lump", [...new Set(state.lumped)].sort().join(",")]);
  if (state.area && sel === null && state.lens === "map") parts.push(["area", state.area]);
  if (state.mapDialects) parts.push(["dialects", "1"]);
  if (state.treeCamera) {
    const t = formatTreeCamera(state.treeCamera);
    if (t.tz) parts.push(["tz", t.tz]);
    if (t.tc) parts.push(["tc", t.tc]);
  }
  if (state.mapCamera) parts.push(["map", formatMapCamera(state.mapCamera)]);
  if (state.locale !== "en") parts.push(["lang", state.locale]);
  if (flags.renderer) parts.push(["renderer", flags.renderer]);
  if (flags.bench) parts.push(["bench", flags.bench]);
  if (flags.stress) parts.push(["stress", flags.stress]);
  // Commas and slashes stay readable (tc=0.10,-0.20, map=4.20/32.900/53.300).
  const qs = parts
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%2C/g, ",").replace(/%2F/g, "/")}`)
    .join("&");
  return selectionPath(sel) + (qs ? `?${qs}` : "");
}

/** The href the address bar should show for this location, or null for non-shell paths. */
export function canonicalize(pathname: string, search: string, opts: ParseOptions = {}): string | null {
  const p = parseShellUrl(pathname, search, opts);
  return p.isShell ? toShellHref(p.state, p.flags) : null;
}

/* ------------------------------------------------------------- camera defaults (section 3.3) */

export function isDefaultTreeCamera(c: TreeCamera | null): boolean {
  return !c || (Math.abs(c.tz) < 0.05 && Math.abs(c.dx) < 0.02 && Math.abs(c.dy) < 0.02);
}

export function sameMapCamera(a: MapCamera, b: MapCamera): boolean {
  return (
    Math.abs(a.zoom - b.zoom) < 0.05 && Math.abs(a.lat - b.lat) < 0.001 && Math.abs(a.lon - b.lon) < 0.001
  );
}
