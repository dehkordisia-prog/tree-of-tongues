// Design tokens for Tree of Tongues. Single source of truth for canvases (PixiJS, deck.gl).
// tokens.css mirrors these values for the DOM; tokens.test.ts fails if the two drift apart.
// Contrast ratios in docs/DESIGN.md are computed from this file by the same test helpers.

import { hexToNumber, hexToRgb } from "./color";

export type ThemeName = "night" | "parchment";
export const THEMES: readonly ThemeName[] = ["night", "parchment"];

/* ---------------------------------------------------------------- UI colors */

export type UiColor =
  | "canvas"
  | "surface"
  | "raised"
  | "line"
  | "lineStrong"
  | "ink"
  | "inkMuted"
  | "link"
  | "accent"
  | "focus"
  | "danger"
  | "confHigh"
  | "confMedium"
  | "confLow"
  | "confContested"
  | "badgeRecording"
  | "badgeReconstruction"
  | "badgeSynthetic";

/** Which UI colors are text (4.5:1) and which are non-text marks (3:1). "line" is decorative only. */
export const UI_ROLE: Record<UiColor, "background" | "text" | "mark" | "decorative"> = {
  canvas: "background",
  surface: "background",
  raised: "background",
  line: "decorative",
  lineStrong: "mark",
  ink: "text",
  inkMuted: "text",
  link: "text",
  accent: "text",
  focus: "mark",
  danger: "text",
  confHigh: "text",
  confMedium: "text",
  confLow: "text",
  confContested: "text",
  badgeRecording: "text",
  badgeReconstruction: "text",
  badgeSynthetic: "text",
};

export const ui: Record<ThemeName, Record<UiColor, string>> = {
  night: {
    canvas: "#0A0F1E",
    surface: "#121A2E",
    raised: "#1A2440",
    line: "#2A3656",
    lineStrong: "#6B79A3",
    ink: "#E8ECF6",
    inkMuted: "#A9B3CC",
    link: "#9CC2FF",
    accent: "#FFD166",
    focus: "#FFD166",
    danger: "#FF8A80",
    confHigh: "#7EE0A1",
    confMedium: "#F2C333",
    confLow: "#A9B3CC",
    confContested: "#FF9EC4",
    badgeRecording: "#7EE0A1",
    badgeReconstruction: "#F2C333",
    badgeSynthetic: "#B9A8FF",
  },
  parchment: {
    canvas: "#F5EEDC",
    surface: "#FBF6EA",
    raised: "#FFFDF7",
    line: "#DCCFB0",
    lineStrong: "#8C7A5B",
    ink: "#22180E",
    inkMuted: "#5A4A36",
    link: "#1F4FA8",
    accent: "#845600",
    focus: "#1A3FB0",
    danger: "#A8261B",
    confHigh: "#1E7A3C",
    confMedium: "#845600",
    confLow: "#5A4A36",
    confContested: "#9C2A7A",
    badgeRecording: "#1E7A3C",
    badgeReconstruction: "#845600",
    badgeSynthetic: "#5B3FB0",
  },
};

/* ----------------------------------------------------------- family colors */

export type FamilyId =
  | "indo-european"
  | "sino-tibetan"
  | "afro-asiatic"
  | "austronesian"
  | "niger-congo"
  | "dravidian"
  | "turkic"
  | "japonic"
  | "koreanic"
  | "kra-dai"
  | "uralic"
  | "other";

/** Second channel for color-blind readers. Every family has a unique fill pattern and a unique marker. */
export type PatternKind =
  | "solid"
  | "hatch-45"
  | "hatch-135"
  | "dots"
  | "horizontal"
  | "vertical"
  | "crosshatch"
  | "grid"
  | "rings"
  | "zigzag"
  | "checker"
  | "outline";

export type MarkerKind =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "triangle-down"
  | "hexagon"
  | "pentagon"
  | "star"
  | "cross"
  | "plus"
  | "bowtie"
  | "ring";

export interface FamilyToken {
  id: FamilyId;
  /** English UI name. Glottolog naming and Glottocode mapping are owned by data-curator. */
  name: string;
  /** Short label, the third channel on dense canvases. */
  abbr: string;
  hueName: string;
  pattern: PatternKind;
  marker: MarkerKind;
  /** mark: fills, strokes, nodes (at least 3:1 on the canvas). ink: text labels (at least 4.5:1). */
  color: Record<ThemeName, { mark: string; ink: string }>;
}

const f = (
  id: FamilyId,
  name: string,
  abbr: string,
  hueName: string,
  pattern: PatternKind,
  marker: MarkerKind,
  night: string,
  parchmentMark: string,
  parchmentInk: string,
): FamilyToken => ({
  id,
  name,
  abbr,
  hueName,
  pattern,
  marker,
  color: { night: { mark: night, ink: night }, parchment: { mark: parchmentMark, ink: parchmentInk } },
});

export const families: readonly FamilyToken[] = [
  f("indo-european", "Indo-European", "IE", "red", "solid", "circle", "#FD5150", "#A21600", "#A21600"),
  f("sino-tibetan", "Sino-Tibetan", "ST", "blue", "hatch-45", "square", "#568DFB", "#2731BE", "#2731BE"),
  f("afro-asiatic", "Afro-Asiatic", "AA", "amber", "hatch-135", "triangle", "#F2C333", "#B67A06", "#916104"),
  f("austronesian", "Austronesian", "AN", "rose", "dots", "diamond", "#FD92C2", "#CC5C84", "#B1446D"),
  f("niger-congo", "Niger-Congo", "NC", "orange", "horizontal", "triangle-down", "#FA871F", "#BE4E09", "#B44803"),
  f("dravidian", "Dravidian", "DR", "sky", "vertical", "hexagon", "#6ECFF8", "#00628A", "#00628A"),
  f("turkic", "Turkic", "TK", "violet", "crosshatch", "pentagon", "#AD9FFF", "#6A4AD0", "#6A4AD0"),
  f("japonic", "Japonic", "JP", "teal", "grid", "star", "#71F6E4", "#278974", "#0A7964"),
  f("koreanic", "Koreanic", "KO", "magenta", "rings", "cross", "#D85AD2", "#A737A4", "#A737A4"),
  f("kra-dai", "Kra-Dai", "KD", "green", "zigzag", "plus", "#ABE98E", "#015C0C", "#015C0C"),
  f("uralic", "Uralic", "UR", "brown", "checker", "bowtie", "#C5A487", "#85624D", "#85624D"),
  f("other", "Other families and isolates", "OT", "neutral", "outline", "ring", "#8D8D8E", "#57595C", "#57595C"),
];

export const familyById: Record<FamilyId, FamilyToken> = Object.fromEntries(
  families.map((fam) => [fam.id, fam]),
) as Record<FamilyId, FamilyToken>;

/** Canvas-ready color: hex for CSS, number for PixiJS, [r, g, b, a] for deck.gl. */
export interface CanvasColor {
  hex: string;
  num: number;
  rgba: [number, number, number, number];
}

export function canvasColor(hex: string, alpha = 255): CanvasColor {
  const [r, g, b] = hexToRgb(hex);
  return { hex, num: hexToNumber(hex), rgba: [r, g, b, alpha] };
}

export function familyColor(id: FamilyId, theme: ThemeName, role: "mark" | "ink" = "mark"): CanvasColor {
  return canvasColor(familyById[id].color[theme][role]);
}

/* ---------------------------------------------------------------- patterns */

/** Geometry for each pattern tile, in CSS pixels at 1x. Shared by SVG <pattern> and canvas tiles. */
export const PATTERN_TILE = 8;
export const PATTERN_STROKE = 1.5;

/** Marker paths in a 24 by 24 box centered on (12, 12). Usable as SVG d, Path2D or Pixi Graphics.svg(). */
export const markerPath: Record<MarkerKind, string> = {
  circle: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z",
  square: "M4 4h16v16H4Z",
  triangle: "M12 2.5L22 20.5H2Z",
  diamond: "M12 1.5L22.5 12L12 22.5L1.5 12Z",
  "triangle-down": "M2 3.5H22L12 21.5Z",
  hexagon: "M12 2L20.7 7V17L12 22L3.3 17V7Z",
  pentagon: "M12 2L21.5 9L17.9 21H6.1L2.5 9Z",
  star: "M12 1.5L14.9 8.6L22.5 9.2L16.7 14.2L18.5 21.6L12 17.6L5.5 21.6L7.3 14.2L1.5 9.2L9.1 8.6Z",
  cross: "M5.6 2.4L12 8.8L18.4 2.4L21.6 5.6L15.2 12L21.6 18.4L18.4 21.6L12 15.2L5.6 21.6L2.4 18.4L8.8 12L2.4 5.6Z",
  plus: "M9.5 2.5H14.5V9.5H21.5V14.5H14.5V21.5H9.5V14.5H2.5V9.5H9.5Z",
  bowtie: "M2.5 4L12 10L21.5 4V20L12 14L2.5 20Z",
  ring: "M12 2.5a9.5 9.5 0 1 0 0 19a9.5 9.5 0 1 0 0-19Zm0 4.5a5 5 0 1 1 0 10a5 5 0 1 1 0-10Z",
};

/* ------------------------------------------------------------------- type */

/** Font stacks are owned by script-typographer (src/design/fonts.css); these are the variable names. */
export const fontVar = { display: "--font-display", ui: "--font-ui", ipa: "--font-ipa" } as const;

/** Sizes in rem. Fluid steps use clamp(min, preferred, max); canvases use the max value. */
export const typeScale = {
  caption: { size: "0.8125rem", px: 13, leading: 1.4, font: "ui" },
  small: { size: "0.875rem", px: 14, leading: 1.45, font: "ui" },
  body: { size: "1rem", px: 16, leading: 1.6, font: "ui" },
  lead: { size: "1.125rem", px: 18, leading: 1.55, font: "ui" },
  "title-sm": { size: "1.25rem", px: 20, leading: 1.35, font: "display" },
  title: { size: "1.5625rem", px: 25, leading: 1.3, font: "display" },
  headline: { size: "clamp(1.75rem, 1.4rem + 1.5vw, 2.25rem)", px: 36, leading: 1.2, font: "display" },
  hero: { size: "clamp(2.25rem, 1.6rem + 3vw, 3.5rem)", px: 56, leading: 1.1, font: "display" },
} as const;
export type TypeStep = keyof typeof typeScale;

/* ---------------------------------------------------- spacing, radii, size */

/** 4 px base. Tailwind's --spacing is 0.25rem, so p-4 is 16 px. These are the steps we use. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64, 24: 96 } as const;
export const radius = { xs: 2, sm: 4, md: 8, lg: 12, xl: 20, pill: 9999 } as const;
/** Minimum touch target (WCAG 2.5.8 asks for 24; we use 44 everywhere). */
export const targetMin = 44;
export const focusRing = { width: 3, offset: 2 } as const;

/* ------------------------------------------------------------------ motion */

/** Durations in ms. UI transitions 200 to 400; camera flights 600 to 1200. */
export const duration = {
  uiFast: 200,
  ui: 280,
  uiSlow: 400,
  flightShort: 600,
  flight: 900,
  flightLong: 1200,
  crossfade: 200,
} as const;

/** Cubic bezier control points, the same in CSS and in Motion. */
export const easing = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  flight: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/** Springs for Motion (stiffness, damping, mass). Both are slightly underdamped: no visible bounce. */
export const spring = {
  /** Children unfold from a node. Damping ratio about 0.88. */
  bloom: { type: "spring", stiffness: 220, damping: 26, mass: 1 },
  /** Panels and sheets come to rest. Damping ratio about 0.91. */
  settle: { type: "spring", stiffness: 120, damping: 20, mass: 1 },
} as const;

/** Delay between siblings in a bloom, capped so a 200-child bloom does not take 5 s. */
export const stagger = { step: 24, maxSteps: 12 } as const;

export type MotionKind = "ui" | "flight" | "bloom";
export type MotionMode = "animate" | "crossfade" | "instant";

export interface MotionPlan {
  mode: MotionMode;
  /** ms; 0 for instant. */
  duration: number;
  ease: readonly [number, number, number, number];
}

/**
 * Reduced-motion policy in one place. Under prefers-reduced-motion:
 * camera flights and blooms become a 200 ms crossfade (the camera jumps, the old and new frames fade);
 * UI transitions keep opacity only. Nothing ever loops.
 */
export function motionFor(kind: MotionKind, reduced: boolean): MotionPlan {
  if (reduced) return { mode: "crossfade", duration: duration.crossfade, ease: easing.standard };
  if (kind === "flight") return { mode: "animate", duration: duration.flight, ease: easing.flight };
  if (kind === "bloom") return { mode: "animate", duration: duration.uiSlow, ease: easing.enter };
  return { mode: "animate", duration: duration.ui, ease: easing.standard };
}

/** Camera flight length scales with distance, clamped to the 600 to 1200 ms band. */
export function flightDuration(zoomLevelsCrossed: number): number {
  const d = duration.flightShort + 150 * Math.max(0, zoomLevelsCrossed);
  return Math.min(duration.flightLong, Math.max(duration.flightShort, d));
}

/* --------------------------------------------------------- runtime theme */

/** Resolved theme for canvases: the data-theme attribute, else the OS preference. */
export function currentTheme(doc: Document | undefined = globalThis.document): ThemeName {
  if (!doc) return "night";
  const attr = doc.documentElement.dataset.theme;
  if (attr === "night" || attr === "parchment") return attr;
  const mq = doc.defaultView?.matchMedia?.("(prefers-color-scheme: light)");
  return mq?.matches ? "parchment" : "night";
}

export function prefersReducedMotion(win: Window | undefined = globalThis.window): boolean {
  if (!win?.matchMedia) return false;
  if (win.document.documentElement.dataset.motion === "reduce") return true;
  return win.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Call cb whenever the resolved theme changes (toggle or OS switch). Returns an unsubscribe. */
export function onThemeChange(cb: (theme: ThemeName) => void, doc: Document = document): () => void {
  let last = currentTheme(doc);
  const check = () => {
    const next = currentTheme(doc);
    if (next !== last) {
      last = next;
      cb(next);
    }
  };
  const mo = new MutationObserver(check);
  mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = doc.defaultView?.matchMedia?.("(prefers-color-scheme: light)");
  mq?.addEventListener("change", check);
  return () => {
    mo.disconnect();
    mq?.removeEventListener("change", check);
  };
}
