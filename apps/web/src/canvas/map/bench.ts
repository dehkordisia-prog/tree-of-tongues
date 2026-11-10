// Benchmark hook, the same contract as the tree spike. With ?bench=1 the page exposes
//   window.__bench = { ready: Promise<void>, run(): Promise<BenchResult> }
// `ready` resolves after the first frame with all layers loaded. `run()` plays a fixed 20 second camera
// path and resolves with frame statistics from requestAnimationFrame timestamps. This file holds no
// MapLibre or deck.gl code, so the stub can install before the heavy chunk loads.

export interface BenchResult {
  renderer: "maplibre+deck";
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

export interface BenchImpl {
  /** Move the camera. Must be synchronous and must not animate. */
  setCamera(c: Camera): void;
  nodes: number;
  layoutMs: number;
  firstFrameMs: number;
  labelsDrawn(): number;
}

export interface Camera {
  lng: number;
  lat: number;
  zoom: number;
}

export interface BenchHost {
  ready: Promise<void>;
  run(): Promise<BenchResult>;
}

declare global {
  interface Window {
    __bench?: BenchHost;
  }
}

/* ------------------------------------------------------------ camera path */

export const PATH_MS = 20_000;

interface Leg {
  until: number;
  from: Camera;
  to: Camera;
  /** Extra zoom-out in the middle of a long flight, in zoom levels. */
  dip: number;
}

const WORLD: Camera = { lng: 10, lat: 20, zoom: 1.3 };
const EUROPE: Camera = { lng: 10, lat: 49, zoom: 4.6 };
const PNG_IN: Camera = { lng: 143.5, lat: -6, zoom: 6.6 };
const PNG_OUT: Camera = { lng: 147.5, lat: -7.2, zoom: 6.6 };

/** World, fly to Europe, fly to Papua New Guinea (dense cluster), pan, back out to the world. */
export const LEGS: readonly Leg[] = [
  { until: 4_000, from: WORLD, to: EUROPE, dip: 0 },
  { until: 8_000, from: EUROPE, to: PNG_IN, dip: 1.5 },
  { until: 14_000, from: PNG_IN, to: PNG_OUT, dip: 0 },
  { until: 20_000, from: PNG_OUT, to: WORLD, dip: 0.5 },
];

const smooth = (x: number) => x * x * (3 - 2 * x);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Pure and deterministic: the camera at a given time, with no dependence on frame rate. */
export function cameraAt(ms: number): Camera {
  const t = Math.min(Math.max(ms, 0), PATH_MS);
  let start = 0;
  for (const leg of LEGS) {
    if (t <= leg.until) {
      const u = smooth((t - start) / (leg.until - start));
      return {
        lng: lerp(leg.from.lng, leg.to.lng, u),
        lat: lerp(leg.from.lat, leg.to.lat, u),
        zoom: lerp(leg.from.zoom, leg.to.zoom, u) - leg.dip * Math.sin(Math.PI * u),
      };
    }
    start = leg.until;
  }
  return LEGS[LEGS.length - 1]!.to;
}

/* ------------------------------------------------------------------ stats */

export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i]!;
}

/** fps per frame is 1000 / delta; P5 is the 5th percentile of those values (the slow tail). */
export function frameStats(timestamps: readonly number[]): {
  frames: number;
  durationMs: number;
  fpsMean: number;
  fpsP50: number;
  fpsP5: number;
  worstFrameMs: number;
} {
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) deltas.push(timestamps[i]! - timestamps[i - 1]!);
  const fps = deltas.filter((d) => d > 0).map((d) => 1000 / d).sort((a, b) => a - b);
  const durationMs = timestamps.length > 1 ? timestamps[timestamps.length - 1]! - timestamps[0]! : 0;
  return {
    frames: timestamps.length,
    durationMs,
    fpsMean: durationMs > 0 ? (1000 * (timestamps.length - 1)) / durationMs : 0,
    fpsP50: percentile(fps, 0.5),
    fpsP5: percentile(fps, 0.05),
    worstFrameMs: deltas.length ? Math.max(...deltas) : 0,
  };
}

/* ------------------------------------------------------------------- host */

export function wantsBench(search: string): boolean {
  return new URLSearchParams(search).get("bench") === "1";
}

let attach: ((impl: BenchImpl) => void) | null = null;

/**
 * Install window.__bench right away (called from the route, before the map chunk loads).
 * The map component then calls attachBench() once its layers are in place.
 */
export function installBenchStub(): void {
  if (window.__bench) return;
  let impl: BenchImpl | null = null;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => (resolveReady = resolve));
  attach = (i) => {
    impl = i;
    resolveReady();
  };
  window.__bench = {
    ready,
    async run() {
      await ready;
      return runPath(impl!);
    },
  };
}

export function attachBench(impl: BenchImpl): void {
  attach?.(impl);
}

function runPath(impl: BenchImpl): Promise<BenchResult> {
  return new Promise((resolve) => {
    const stamps: number[] = [];
    let origin = -1;
    let labelsMax = 0;
    const step = (ts: number) => {
      if (origin < 0) origin = ts;
      const elapsed = ts - origin;
      stamps.push(ts);
      impl.setCamera(cameraAt(elapsed));
      labelsMax = Math.max(labelsMax, impl.labelsDrawn());
      if (elapsed >= PATH_MS) {
        resolve({
          renderer: "maplibre+deck",
          nodes: impl.nodes,
          ...frameStats(stamps),
          firstFrameMs: impl.firstFrameMs,
          layoutMs: impl.layoutMs,
          labelsDrawnMax: labelsMax,
        });
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
