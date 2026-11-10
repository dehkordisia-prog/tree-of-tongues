// docs/specs/persian.md section 4 (D-032): Persian digit shapes inside Persian Nastaliq text.
// Checks fonts.css as text; the rendered result is checked in tests/e2e/nastaliq-digits.spec.ts.
// it.skip tests are pending until section 4.2 lands.

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const CSS = fs.readFileSync(path.resolve(import.meta.dirname, "fonts.css"), "utf8");
const NASKH_SRC = "/fonts/noto-naskh-arabic/noto-naskh-arabic-arabic-wght-normal.woff2";

function fontFaces(css: string): string[] {
  return [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!);
}
function customProperty(css: string, name: string): string | null {
  const m = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return m ? m[1]!.replace(/\s+/g, " ").trim() : null;
}
function firstFamily(stack: string | null): string | null {
  return stack ? stack.split(",")[0]!.trim().replace(/^"|"$/g, "") : null;
}

describe("Nastaliq stack for Urdu stays as it is", () => {
  it("starts with Noto Nastaliq Urdu, so Urdu keeps Urdu digit shapes", () => {
    expect(firstFamily(customProperty(CSS, "--font-arabic-nastaliq"))).toBe("Noto Nastaliq Urdu");
  });
});

describe("pending: Persian digits in Persian Nastaliq (spec 4.2)", () => {
  it.skip("declares a digits-only face from the Naskh file", () => {
    const face = fontFaces(CSS).find((f) => /font-family:\s*"Tongues Persian Digits"/.test(f));
    expect(face).toBeDefined();
    expect(face).toContain(NASKH_SRC);
    const range = face!.match(/unicode-range:\s*([^;]+);/)![1]!.replace(/\s+/g, "");
    expect(range).toBe("U+06F0-06F9"); // Persian digits only: no Western or Arabic-Indic digits, no letters
  });

  it.skip("puts the digits face first in a Persian-only Nastaliq stack", () => {
    const stack = customProperty(CSS, "--font-arabic-nastaliq-fa");
    expect(firstFamily(stack)).toBe("Tongues Persian Digits");
    expect(stack).toContain('"Noto Nastaliq Urdu"');
  });

  it.skip("applies that stack only to Persian Nastaliq text", () => {
    expect(CSS).toMatch(/\.script-nastaliq:lang\(fa\)\s*\{[^}]*var\(--font-arabic-nastaliq-fa\)/);
    expect(customProperty(CSS, "--font-arabic-nastaliq")).not.toContain("Tongues Persian Digits");
  });
});
