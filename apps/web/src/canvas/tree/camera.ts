// One camera for both renderers. World units are layout units (root radius 1000, y down).
// screen = (world - center) * scale + size / 2

import { interpolateZoom } from "d3-interpolate";

import { easing, flightDuration } from "@/design/tokens";

import { WORLD_RADIUS } from "./layout";

export interface Camera {
  cx: number;
  cy: number;
  /** Screen pixels per world unit. */
  scale: number;
}
export interface Size {
  w: number;
  h: number;
}

/** Deepest zoom: a dialect (radius about 3 units) fills roughly 700 px. */
export const MAX_SCALE = 240;

export function fitScale(size: Size, radius: number, pad = 0.86): number {
  return (Math.min(size.w, size.h) / 2 / radius) * pad;
}

export function fitCircle(x: number, y: number, r: number, size: Size, pad = 0.86): Camera {
  return { cx: x, cy: y, scale: clampScale(fitScale(size, Math.max(r, 1e-6), pad), size) };
}

export function minScale(size: Size): number {
  return fitScale(size, WORLD_RADIUS) * 0.7;
}

export function clampScale(scale: number, size: Size): number {
  return Math.min(MAX_SCALE, Math.max(minScale(size), scale));
}

export function toScreen(cam: Camera, size: Size, wx: number, wy: number): [number, number] {
  return [(wx - cam.cx) * cam.scale + size.w / 2, (wy - cam.cy) * cam.scale + size.h / 2];
}

export function toWorld(cam: Camera, size: Size, sx: number, sy: number): [number, number] {
  return [(sx - size.w / 2) / cam.scale + cam.cx, (sy - size.h / 2) / cam.scale + cam.cy];
}

/** Zoom by `factor` keeping the world point under (sx, sy) fixed. */
export function zoomAt(cam: Camera, size: Size, sx: number, sy: number, factor: number): Camera {
  const scale = clampScale(cam.scale * factor, size);
  const [wx, wy] = toWorld(cam, size, sx, sy);
  return { scale, cx: wx - (sx - size.w / 2) / scale, cy: wy - (sy - size.h / 2) / scale };
}

export function panBy(cam: Camera, dxPx: number, dyPx: number): Camera {
  return { ...cam, cx: cam.cx - dxPx / cam.scale, cy: cam.cy - dyPx / cam.scale };
}

/** Keep the world from being dragged out of reach: the center stays inside the root circle. */
export function clampCenter(cam: Camera): Camera {
  const d = Math.hypot(cam.cx, cam.cy);
  if (d <= WORLD_RADIUS) return cam;
  const k = WORLD_RADIUS / d;
  return { ...cam, cx: cam.cx * k, cy: cam.cy * k };
}

export function sameCamera(a: Camera, b: Camera): boolean {
  return a.cx === b.cx && a.cy === b.cy && a.scale === b.scale;
}

/** CSS-style cubic bezier through (0,0), (x1,y1), (x2,y2), (1,1). Returns y for a given x. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-6) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const e = sx(t);
      if (Math.abs(e - x) < 1e-6) break;
      if (e < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const flightEase = cubicBezier(...easing.flight);

/** A van Wijk and Nuij smooth zoom and pan between two cameras. */
export class Flight {
  readonly durationMs: number;
  private readonly interp: (t: number) => [number, number, number];

  constructor(
    readonly from: Camera,
    readonly to: Camera,
    private readonly size: Size,
    levelsCrossed: number,
  ) {
    this.durationMs = flightDuration(levelsCrossed);
    const i = interpolateZoom([from.cx, from.cy, size.w / from.scale], [to.cx, to.cy, size.w / to.scale]);
    this.interp = i as unknown as (t: number) => [number, number, number];
  }

  at(elapsedMs: number): Camera {
    const t = flightEase(elapsedMs / this.durationMs);
    const [cx, cy, w] = this.interp(t);
    return { cx, cy, scale: this.size.w / w };
  }

  done(elapsedMs: number): boolean {
    return elapsedMs >= this.durationMs;
  }
}
