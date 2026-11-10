import { describe, expect, it } from "vitest";

import { BENCH_MS, benchCamera, frameStats, pickBenchTarget } from "./bench";
import { cubicBezier, fitCircle, Flight, MAX_SCALE, minScale, toWorld, zoomAt } from "./camera";
import { computeLayout, type TreeFile, type TreeRow } from "./layout";

const size = { w: 1200, h: 800 };

describe("camera", () => {
  it("keeps the point under the cursor fixed while zooming", () => {
    const cam = { cx: 10, cy: -20, scale: 2 };
    const before = toWorld(cam, size, 300, 200);
    const after = toWorld(zoomAt(cam, size, 300, 200, 1.7), size, 300, 200);
    expect(after[0]).toBeCloseTo(before[0], 6);
    expect(after[1]).toBeCloseTo(before[1], 6);
  });

  it("clamps zoom", () => {
    const z = zoomAt({ cx: 0, cy: 0, scale: 1 }, size, 0, 0, 1e9);
    expect(z.scale).toBe(MAX_SCALE);
    expect(zoomAt({ cx: 0, cy: 0, scale: 1 }, size, 0, 0, 1e-9).scale).toBeCloseTo(minScale(size), 9);
  });

  it("fits a circle inside the viewport", () => {
    const c = fitCircle(5, 5, 100, size);
    expect(100 * c.scale * 2).toBeLessThan(Math.min(size.w, size.h));
  });

  it("has a bezier ease from 0 to 1, monotonic", () => {
    const e = cubicBezier(0.65, 0, 0.35, 1);
    expect(e(0)).toBe(0);
    expect(e(1)).toBe(1);
    expect(e(0.5)).toBeCloseTo(0.5, 3);
    let prev = 0;
    for (let i = 1; i <= 20; i++) {
      const v = e(i / 20);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe("flight", () => {
  const a = { cx: 0, cy: 0, scale: 0.4 };
  const b = { cx: 300, cy: -200, scale: 30 };

  it("runs 600 to 1200 ms and lands on the target", () => {
    for (const levels of [0, 1, 5, 40]) {
      const f = new Flight(a, b, size, levels);
      expect(f.durationMs).toBeGreaterThanOrEqual(600);
      expect(f.durationMs).toBeLessThanOrEqual(1200);
    }
    const f = new Flight(a, b, size, 3);
    const end = f.at(f.durationMs);
    expect(end.scale).toBeCloseTo(b.scale, 6);
    expect(end.cx).toBeCloseTo(b.cx, 6);
    expect(f.at(0).scale).toBeCloseTo(a.scale, 6);
  });

  it("handles a zero-distance flight without NaN", () => {
    const f = new Flight(a, a, size, 0);
    expect(Number.isFinite(f.at(f.durationMs / 2).scale)).toBe(true);
  });
});

describe("bench path", () => {
  const row = (code: string, parent: number, level: number, kids: number): TreeRow => [
    code,
    parent,
    level,
    code,
    kids,
    null,
    null,
    null,
    null,
  ];
  // 300 filler languages make the dialect cluster small next to the world.
  const fillers = Array.from({ length: 300 }, (_, i) => row(`fill${String(i).padStart(4, "0")}`, 0, 1, 0));
  const file: TreeFile = {
    columns: [],
    nodes: [
      row("fam00001", -1, 0, 302),
      row("lang0001", 0, 1, 3),
      row("dial0001", 1, 2, 0),
      row("dial0002", 1, 2, 0),
      row("dial0003", 1, 2, 0),
      row("lang0002", 0, 1, 1),
      row("dial0004", 5, 2, 0),
      ...fillers,
    ],
  };
  const L = computeLayout(file);
  const target = pickBenchTarget(L);

  it("targets the language with the most dialects", () => {
    expect(target).toBe(1);
  });

  it("is deterministic and continuous, going deep and coming back", () => {
    const at = (t: number) => benchCamera(t, L, size, target);
    expect(at(5000)).toEqual(at(5000));
    for (const t of [1000, 7000, 10000, 11500, 17000, 18000]) {
      const lo = at(t - 1);
      const hi = at(t + 1);
      expect(Math.abs(Math.log(hi.scale / lo.scale))).toBeLessThan(0.05);
      expect(Math.hypot(hi.cx - lo.cx, hi.cy - lo.cy)).toBeLessThan(40);
    }
    const start = at(0);
    expect(at(7000).scale).toBeGreaterThan(start.scale * 3);
    expect(at(BENCH_MS).scale).toBeGreaterThan(start.scale);
  });
});

describe("frameStats", () => {
  it("reports 60 fps for steady 16.67 ms frames", () => {
    const stamps = Array.from({ length: 121 }, (_, i) => i * (1000 / 60));
    const s = frameStats(stamps);
    expect(s.frames).toBe(121);
    expect(s.fpsMean).toBeCloseTo(60, 3);
    expect(s.fpsP50).toBeCloseTo(60, 3);
    expect(s.fpsP5).toBeCloseTo(60, 3);
    expect(s.worstFrameMs).toBeCloseTo(1000 / 60, 6);
  });

  it("P5 sees the slow tail", () => {
    const stamps = [0];
    for (let i = 0; i < 100; i++) stamps.push(stamps.at(-1)! + (i % 10 === 0 ? 50 : 16.67));
    const s = frameStats(stamps);
    expect(s.fpsP5).toBeLessThan(25);
    expect(s.fpsP50).toBeGreaterThan(55);
    expect(s.worstFrameMs).toBe(50);
  });

  it("copes with no frames", () => {
    expect(frameStats([]).fpsMean).toBe(0);
  });
});
