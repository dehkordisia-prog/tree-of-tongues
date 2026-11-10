// Family fill patterns, the second channel after color (docs/DESIGN.md, "Family palette").
// One geometry, two renderers: SVG <pattern> (FamilySwatch.tsx) and canvas tiles (PixiJS, deck.gl).

import { PATTERN_STROKE, PATTERN_TILE, type PatternKind } from "./tokens";

export type PatternPrimitive =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number }
  | { type: "polyline"; points: readonly (readonly [number, number])[] }
  | { type: "dot"; cx: number; cy: number; r: number }
  | { type: "ring"; cx: number; cy: number; r: number }
  | { type: "rect"; x: number; y: number; w: number; h: number };

export interface PatternGeometry {
  /** Alpha of the flat mark-colored fill under the primitives. 1 = solid, 0 = hollow. */
  fillAlpha: number;
  primitives: readonly PatternPrimitive[];
  /** Hollow patterns (outline) rely on a heavier border instead. */
  borderWidth: number;
}

const T = PATTERN_TILE;
const h = T / 2;

const slash: PatternPrimitive[] = [
  { type: "line", x1: 0, y1: T, x2: T, y2: 0 },
  { type: "line", x1: -h, y1: h, x2: h, y2: -h },
  { type: "line", x1: h, y1: T + h, x2: T + h, y2: h },
];
const backslash: PatternPrimitive[] = [
  { type: "line", x1: 0, y1: 0, x2: T, y2: T },
  { type: "line", x1: -h, y1: h, x2: h, y2: T + h },
  { type: "line", x1: h, y1: -h, x2: T + h, y2: h },
];
const horizontal: PatternPrimitive[] = [{ type: "line", x1: 0, y1: h, x2: T, y2: h }];
const vertical: PatternPrimitive[] = [{ type: "line", x1: h, y1: 0, x2: h, y2: T }];

const TINT = 0.2;

export const patternGeometry: Record<PatternKind, PatternGeometry> = {
  solid: { fillAlpha: 1, primitives: [], borderWidth: 1 },
  "hatch-45": { fillAlpha: TINT, primitives: slash, borderWidth: 1 },
  "hatch-135": { fillAlpha: TINT, primitives: backslash, borderWidth: 1 },
  dots: { fillAlpha: TINT, primitives: [{ type: "dot", cx: h, cy: h, r: 1.75 }], borderWidth: 1 },
  horizontal: { fillAlpha: TINT, primitives: horizontal, borderWidth: 1 },
  vertical: { fillAlpha: TINT, primitives: vertical, borderWidth: 1 },
  crosshatch: { fillAlpha: TINT, primitives: [...slash, ...backslash], borderWidth: 1 },
  grid: { fillAlpha: TINT, primitives: [...horizontal, ...vertical], borderWidth: 1 },
  rings: { fillAlpha: TINT, primitives: [{ type: "ring", cx: h, cy: h, r: 2.25 }], borderWidth: 1 },
  zigzag: {
    fillAlpha: TINT,
    primitives: [
      {
        type: "polyline",
        points: [
          [0, T * 0.7],
          [h, T * 0.3],
          [T, T * 0.7],
        ],
      },
    ],
    borderWidth: 1,
  },
  checker: {
    fillAlpha: TINT,
    primitives: [
      { type: "rect", x: 0, y: 0, w: h, h: h },
      { type: "rect", x: h, y: h, w: h, h: h },
    ],
    borderWidth: 1,
  },
  outline: { fillAlpha: 0, primitives: [], borderWidth: 2.5 },
};

/** Human-readable description for screen readers and legends. */
export const patternLabel: Record<PatternKind, string> = {
  solid: "solid fill",
  "hatch-45": "diagonal lines, rising",
  "hatch-135": "diagonal lines, falling",
  dots: "dots",
  horizontal: "horizontal lines",
  vertical: "vertical lines",
  crosshatch: "crosshatch",
  grid: "grid",
  rings: "small rings",
  zigzag: "zigzag",
  checker: "checkerboard",
  outline: "outline only",
};

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draw one tile into a 2D context at the given scale. The tile repeats seamlessly. */
export function drawPatternTile(ctx: Ctx2D, kind: PatternKind, color: string, scale = 1): void {
  const g = patternGeometry[kind];
  ctx.save();
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, T, T);
  if (g.fillAlpha > 0) {
    ctx.globalAlpha = g.fillAlpha;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, T, T);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = PATTERN_STROKE;
  ctx.lineCap = "square";
  for (const p of g.primitives) {
    ctx.beginPath();
    if (p.type === "line") {
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
    } else if (p.type === "polyline") {
      p.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    } else if (p.type === "dot") {
      ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === "ring") {
      ctx.lineWidth = 1.2;
      ctx.arc(p.cx, p.cy, p.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = PATTERN_STROKE;
    } else {
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
  }
  ctx.restore();
}

/**
 * A canvas holding one tile, for PixiJS (Texture.from(canvas) as a fill pattern) or for
 * building a deck.gl fillPatternAtlas. Pass devicePixelRatio as scale for crisp lines.
 */
export function createPatternCanvas(kind: PatternKind, color: string, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(T * scale);
  canvas.height = Math.ceil(T * scale);
  const ctx = canvas.getContext("2d");
  if (ctx) drawPatternTile(ctx, kind, color, scale);
  return canvas;
}
