// @vitest-environment node
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { contrast, deltaOk, hexToNumber, simulateCvd, type Cvd } from "./color";
import { patternGeometry } from "./patterns";
import {
  canvasColor,
  duration,
  families,
  flightDuration,
  markerPath,
  motionFor,
  spring,
  THEMES,
  ui,
  UI_ROLE,
  type UiColor,
} from "./tokens";

const css = fs.readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

describe("color math", () => {
  it("matches WCAG reference values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(hexToNumber("#FD5150")).toBe(0xfd5150);
  });

  it("leaves greys unchanged under color vision simulation", () => {
    for (const kind of ["protanopia", "deuteranopia", "tritanopia"] as Cvd[]) {
      expect(deltaOk(simulateCvd("#808080", kind), "#808080")).toBeLessThan(0.01);
    }
  });
});

describe("contrast, WCAG 2.2 AA", () => {
  for (const theme of THEMES) {
    const t = ui[theme];
    const backgrounds = [t.canvas, t.surface, t.raised];

    it(`${theme}: text colors reach 4.5:1 and marks 3:1 on canvas, surface and raised`, () => {
      for (const key of Object.keys(t) as UiColor[]) {
        const role = UI_ROLE[key];
        if (role === "background" || role === "decorative") continue;
        const min = role === "text" ? 4.5 : 3;
        for (const bg of backgrounds) expect(contrast(t[key], bg), `${theme} ${key} on ${bg}`).toBeGreaterThanOrEqual(min);
      }
    });

    it(`${theme}: family marks reach 3:1 and inks 4.5:1 on canvas, surface and raised`, () => {
      for (const fam of families) {
        for (const bg of backgrounds) {
          expect(contrast(fam.color[theme].mark, bg), `${fam.id} mark`).toBeGreaterThanOrEqual(3);
          expect(contrast(fam.color[theme].ink, bg), `${fam.id} ink`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  }
});

describe("family palette", () => {
  it("has the eleven SPEC families plus one neutral", () => {
    expect(families.map((f) => f.id)).toEqual([
      "indo-european",
      "sino-tibetan",
      "afro-asiatic",
      "austronesian",
      "niger-congo",
      "dravidian",
      "turkic",
      "japonic",
      "koreanic",
      "kra-dai",
      "uralic",
      "other",
    ]);
  });

  it("gives every family a unique pattern, marker and label", () => {
    for (const key of ["pattern", "marker", "abbr"] as const) {
      expect(new Set(families.map((f) => f[key])).size).toBe(families.length);
    }
    for (const f of families) {
      expect(patternGeometry[f.pattern]).toBeDefined();
      expect(markerPath[f.marker]).toMatch(/^M/);
    }
  });

  // Floors measured when the palette was tuned (docs/DESIGN.md). They guard against regressions;
  // below about 0.08 the pattern and label, not hue, carry the difference.
  const floors = { night: 0.07, parchment: 0.05 } as const;
  for (const theme of THEMES) {
    it(`${theme}: no two families collapse under simulated color vision deficiency`, () => {
      for (const kind of ["typical", "protanopia", "deuteranopia", "tritanopia"] as const) {
        const sim = (hex: string) => (kind === "typical" ? hex : simulateCvd(hex, kind));
        for (let i = 0; i < families.length; i++) {
          for (let j = i + 1; j < families.length; j++) {
            const a = families[i]!;
            const b = families[j]!;
            const d = deltaOk(sim(a.color[theme].mark), sim(b.color[theme].mark));
            expect(d, `${theme} ${kind} ${a.id}/${b.id}`).toBeGreaterThanOrEqual(floors[theme]);
          }
        }
      }
    });
  }

  it("exposes canvas-ready colors", () => {
    expect(canvasColor("#0A0F1E", 128)).toEqual({ hex: "#0A0F1E", num: 0x0a0f1e, rgba: [10, 15, 30, 128] });
  });
});

describe("tokens.css mirrors tokens.ts", () => {
  const value = (name: string) => {
    const m = css.match(new RegExp(`${name}:\\s*light-dark\\((#[0-9A-Fa-f]{6}),\\s*(#[0-9A-Fa-f]{6})\\)`));
    return m ? { parchment: m[1]!.toUpperCase(), night: m[2]!.toUpperCase() } : undefined;
  };

  it("UI colors", () => {
    for (const key of Object.keys(ui.night) as UiColor[]) {
      expect(value(`--tt-${kebab(key)}`), key).toEqual({ parchment: ui.parchment[key], night: ui.night[key] });
    }
  });

  it("family colors", () => {
    for (const f of families) {
      expect(value(`--tt-fam-${f.id}`), f.id).toEqual({ parchment: f.color.parchment.mark, night: f.color.night.mark });
      expect(value(`--tt-fam-${f.id}-ink`), f.id).toEqual({ parchment: f.color.parchment.ink, night: f.color.night.ink });
    }
  });

  it("durations", () => {
    for (const [key, ms] of Object.entries(duration)) {
      expect(css, key).toContain(`--tt-dur-${kebab(key)}: ${ms}ms;`);
    }
  });

  it("uses no physical direction properties", () => {
    expect(css).not.toMatch(/\b(margin|padding|border)-(left|right)\b|\b(left|right):/);
  });
});

describe("motion", () => {
  it("keeps UI transitions in 200 to 400 ms and flights in 600 to 1200 ms", () => {
    for (const ms of [duration.uiFast, duration.ui, duration.uiSlow]) {
      expect(ms).toBeGreaterThanOrEqual(200);
      expect(ms).toBeLessThanOrEqual(400);
    }
    for (const levels of [0, 1, 3, 10, 100]) {
      expect(flightDuration(levels)).toBeGreaterThanOrEqual(600);
      expect(flightDuration(levels)).toBeLessThanOrEqual(1200);
    }
  });

  it("collapses everything to a crossfade under reduced motion", () => {
    for (const kind of ["ui", "flight", "bloom"] as const) {
      expect(motionFor(kind, true)).toMatchObject({ mode: "crossfade", duration: duration.crossfade });
      expect(motionFor(kind, false).mode).toBe("animate");
    }
  });

  it("uses springs without visible overshoot", () => {
    for (const s of Object.values(spring)) {
      const ratio = s.damping / (2 * Math.sqrt(s.stiffness * s.mass));
      expect(ratio).toBeGreaterThan(0.8);
      expect(ratio).toBeLessThanOrEqual(1);
    }
  });
});
