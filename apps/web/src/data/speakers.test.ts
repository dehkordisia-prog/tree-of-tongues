import { describe, expect, it } from "vitest";

import type { SpeakerRow } from "./bundle";
import { summarizeSpeakers } from "./speakers";

const row = (kind: string, value: number, year: number | null, rank = "normal", ref = true): SpeakerRow => ({
  kind,
  value,
  year,
  rank,
  method: null,
  part: null,
  references: ref ? [{ retrieved: null, stated_in: "Q14790", stated_in_label: "Ethnologue", url: null }] : [],
  disagrees_gt_25pct: false,
  source_id: "wikidata",
  locator: `statement/Q1-${kind}-${value}`,
  retrieved_at: "2026-11-10T01:49:10Z",
  confidence: "medium",
});

// Fixture figures (acceptance 17): two L1, one Total, one unstated, one deprecated.
// The values are test numbers, not data.
const rows = [row("L1", 61, 2011), row("L1", 64, 2022), row("total", 80, 2019), row("unknown", 70, 2019), row("L1", 99, 2005, "deprecated")];

describe("speaker summary (spec 5.1, D-005)", () => {
  const s = summarizeSpeakers(rows);
  it("ranges L1 from min to max of the L1 figures only", () => {
    expect([s.groups.l1.min, s.groups.l1.max]).toEqual([61, 64]);
    expect(s.groups.l1.firstYear).toBe(2011);
    expect(s.groups.l1.lastYear).toBe(2022);
  });
  it("keeps the unstated figure out of every other range", () => {
    expect(s.groups.unstated.rows.map((r) => r.value)).toEqual([70]);
    expect([s.groups.total.min, s.groups.total.max]).toEqual([80, 80]);
    expect(s.groups.l1.rows.some((r) => r.value === 70)).toBe(false);
  });
  it("folds deprecated figures away from the ranges", () => {
    expect(s.deprecated.map((r) => r.value)).toEqual([99]);
    expect(s.groups.l1.max).toBe(64);
  });
  it("never produces the mean", () => {
    const values = [s.groups.l1.min, s.groups.l1.max, s.groups.total.min, s.groups.total.max];
    expect(values).not.toContain(62.5);
    expect(values).not.toContain((61 + 64 + 80 + 70) / 4);
  });
  it("orders rows newest first", () => {
    expect(s.groups.l1.rows.map((r) => r.year)).toEqual([2022, 2011]);
  });
  it("flags L1 above Total as mixed sources", () => {
    expect(summarizeSpeakers([row("L1", 90, 2020), row("total", 80, 2010)]).mixed).toBe(true);
    expect(s.mixed).toBe(false);
  });
  it("reports nothing for an empty list", () => {
    const e = summarizeSpeakers([]);
    expect(e.any).toBe(false);
    expect(e.groups.l1.min).toBeNull();
  });
});
