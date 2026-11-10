// Benchmark path and statistics. The path is a pure function of elapsed time and the layout, so
// both renderers fly exactly the same 20 seconds.

import { interpolateZoom } from "d3-interpolate";

import { type Camera, fitCircle, flightEase, type Size } from "./camera";
import { LEVEL_LANGUAGE, WORLD_RADIUS, type TreeLayout } from "./layout";
import type { RendererName } from "./renderer";

export const BENCH_MS = 20000;

export interface BenchResult {
  renderer: RendererName;
  nodes: number;
  frames: number;
  durationMs: number;
  fpsMean: number;
  fpsP50: number;
  fpsP5: number;
  worstFrameMs: number;
  firstFrameMs: number;
  layoutMs: number;
  labelsDrawnMax: number;
}

/** The language with the most dialects (lowest index on a tie): the "deep dialect cluster". */
export function pickBenchTarget(L: Pick<TreeLayout, "n" | "level" | "childStart">): number {
  let best = -1;
  let bestKids = -1;
  for (let i = 0; i < L.n; i++) {
    if (L.level[i] !== LEVEL_LANGUAGE) continue;
    const kids = L.childStart[i + 1]! - L.childStart[i]!;
    if (kids > bestKids) {
      best = i;
      bestKids = kids;
    }
  }
  return best;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

function zoomBetween(a: Camera, b: Camera, size: Size, t: number): Camera {
  const i = interpolateZoom([a.cx, a.cy, size.w / a.scale], [b.cx, b.cy, size.w / b.scale]);
  const [cx, cy, w] = i(flightEase(t)) as unknown as [number, number, number];
  return { cx, cy, scale: size.w / w };
}

/**
 * 0 to 1 s hold on the world; 1 to 7 s zoom into the dialect cluster; 7 to 10 s pan around inside it;
 * 10 to 11.5 s hold; 11.5 to 17 s zoom back out; 17 to 18 s zoom to 3 times world scale;
 * 18 to 20 s pan across the world and back to the middle.
 */
export function benchCamera(tMs: number, L: TreeLayout, size: Size, target: number): Camera {
  const world = fitCircle(0, 0, WORLD_RADIUS, size);
  const tx = L.x[target]!;
  const ty = L.y[target]!;
  const tr = L.r[target]!;
  const deep = fitCircle(tx, ty, tr, size, 0.8);
  const wide: Camera = { cx: -450, cy: 0, scale: world.scale * 3 };
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

  if (tMs < 1000) return world;
  if (tMs < 7000) return zoomBetween(world, deep, size, (tMs - 1000) / 6000);
  if (tMs < 10000) {
    const u = (tMs - 7000) / 3000;
    const amp = 0.45 * tr * Math.sin(Math.PI * u);
    return { scale: deep.scale, cx: tx + amp * Math.cos(3 * Math.PI * u), cy: ty + amp * Math.sin(3 * Math.PI * u) };
  }
  if (tMs < 11500) return deep;
  if (tMs < 17000) return zoomBetween(deep, world, size, (tMs - 11500) / 5500);
  if (tMs < 18000) return zoomBetween(world, wide, size, (tMs - 17000) / 1000);
  const u = clamp01((tMs - 18000) / 2000);
  return { scale: wide.scale, cx: lerp(-450, 450, smooth(u)), cy: 220 * Math.sin(Math.PI * u) };
}

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx]!;
}

/** Frame statistics from requestAnimationFrame timestamps (ms). fps per frame = 1000 / delta. */
export function frameStats(timestamps: readonly number[]): Pick<BenchResult, "frames" | "durationMs" | "fpsMean" | "fpsP50" | "fpsP5" | "worstFrameMs"> {
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) deltas.push(timestamps[i]! - timestamps[i - 1]!);
  const durationMs = timestamps.length > 1 ? timestamps[timestamps.length - 1]! - timestamps[0]! : 0;
  const fps = deltas.filter((d) => d > 0).map((d) => 1000 / d).sort((a, b) => a - b);
  return {
    frames: timestamps.length,
    durationMs,
    // Frames per second over the whole run (not the mean of per-frame values).
    fpsMean: durationMs > 0 ? (deltas.length * 1000) / durationMs : 0,
    fpsP50: percentile(fps, 0.5),
    fpsP5: percentile(fps, 0.05),
    worstFrameMs: deltas.length ? Math.max(...deltas) : 0,
  };
}
