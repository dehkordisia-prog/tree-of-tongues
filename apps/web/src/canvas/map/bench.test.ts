import { describe, expect, it } from "vitest";

import { LEGS, PATH_MS, cameraAt, frameStats, percentile, wantsBench } from "./bench";

describe("cameraAt", () => {
  it("is deterministic and starts and ends on the world view", () => {
    expect(cameraAt(1234)).toEqual(cameraAt(1234));
    expect(cameraAt(0)).toEqual(cameraAt(-50));
    expect(cameraAt(PATH_MS)).toEqual(cameraAt(PATH_MS + 5000));
    expect(cameraAt(0).zoom).toBeCloseTo(cameraAt(PATH_MS).zoom, 5);
  });

  it("lasts 20 seconds and passes Europe and Papua New Guinea", () => {
    expect(LEGS.at(-1)!.until).toBe(20_000);
    const europe = cameraAt(4_000);
    expect(europe.lat).toBeGreaterThan(40);
    expect(europe.lng).toBeGreaterThan(0);
    const png = cameraAt(8_000);
    expect(png.lat).toBeLessThan(0);
    expect(png.lng).toBeGreaterThan(140);
    expect(png.zoom).toBeGreaterThan(6);
  });

  it("never leaves a sane zoom range", () => {
    for (let t = 0; t <= PATH_MS; t += 250) {
      const z = cameraAt(t).zoom;
      expect(z).toBeGreaterThan(0);
      expect(z).toBeLessThan(11);
    }
  });
});

describe("frameStats", () => {
  it("computes fps from timestamp deltas", () => {
    const stamps = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
    const s = frameStats(stamps);
    expect(s.frames).toBe(61);
    expect(s.fpsMean).toBeCloseTo(60, 5);
    expect(s.fpsP50).toBeCloseTo(60, 5);
    expect(s.worstFrameMs).toBeCloseTo(1000 / 60, 5);
  });

  it("puts a slow tail into P5 and the worst frame", () => {
    const stamps = [0];
    for (let i = 1; i <= 100; i++) stamps.push(stamps[i - 1]! + (i % 10 === 0 ? 100 : 16));
    const s = frameStats(stamps);
    expect(s.fpsP5).toBeCloseTo(10, 5);
    expect(s.worstFrameMs).toBe(100);
    expect(s.fpsP50).toBeCloseTo(62.5, 5);
  });

  it("handles empty input", () => {
    expect(frameStats([]).fpsMean).toBe(0);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("wantsBench", () => {
  it("reads bench=1 from the query string", () => {
    expect(wantsBench("?bench=1")).toBe(true);
    expect(wantsBench("?bench=0")).toBe(false);
    expect(wantsBench("")).toBe(false);
  });
});
