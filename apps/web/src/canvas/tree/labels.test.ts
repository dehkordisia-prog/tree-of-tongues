// @vitest-environment node
import { describe, expect, it } from "vitest";

import { selectLabels, type LabelCandidate } from "./labels";

const c = (id: number, x: number, y: number, over: Partial<LabelCandidate> = {}): LabelCandidate => ({
  x,
  y,
  w: 80,
  h: 16,
  priority: 0,
  rs: 20,
  id,
  ...over,
});

describe("selectLabels", () => {
  it("drops the lower-priority one of two overlapping labels", () => {
    // The "Southern Persian" and "Khuzestani" case: 40 px apart, 80 px wide.
    const picked = selectLabels([c(1, 100, 100, { rs: 30 }), c(2, 140, 104, { rs: 20 })], 10);
    expect(picked).toEqual([0]);
  });

  it("keeps labels that do not touch", () => {
    expect(selectLabels([c(1, 100, 100), c(2, 300, 100), c(3, 100, 160)], 10).sort()).toEqual([0, 1, 2]);
  });

  it("orders by focused path, then scope, then circle size", () => {
    const cands = [c(1, 100, 100, { rs: 50 }), c(2, 110, 100, { priority: 1, rs: 10 }), c(3, 120, 100, { priority: 2, rs: 5 })];
    expect(selectLabels(cands, 10)).toEqual([2]);
    expect(selectLabels(cands.slice(0, 2), 10)).toEqual([1]);
    expect(selectLabels([c(1, 100, 100, { rs: 10 }), c(2, 110, 100, { rs: 50 })], 10)).toEqual([1]);
  });

  it("respects the cap", () => {
    const many = Array.from({ length: 50 }, (_, i) => c(i, i * 200, 0));
    expect(selectLabels(many, 7)).toHaveLength(7);
  });

  it("is deterministic when everything ties", () => {
    const cands = [c(5, 100, 100), c(3, 100, 100)];
    expect(selectLabels(cands, 10)).toEqual([1]);
  });

  it("a box that straddles a grid cell still collides", () => {
    const picked = selectLabels([c(1, 63, 10, { rs: 30 }), c(2, 66, 10, { rs: 20 })], 10);
    expect(picked).toEqual([0]);
  });
});
