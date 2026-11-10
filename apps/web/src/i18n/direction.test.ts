import { describe, expect, it } from "vitest";

import { directionOf, htmlAttributes, localeFromSearch } from "./direction";
import en from "./en.json";
import fa from "./fa.json";
import tr from "./tr.json";

describe("direction", () => {
  it("maps locales to lang and dir", () => {
    expect(htmlAttributes("en")).toEqual({ lang: "en", dir: "ltr" });
    expect(htmlAttributes("fa")).toEqual({ lang: "fa", dir: "rtl" });
    expect(htmlAttributes("tr")).toEqual({ lang: "tr", dir: "ltr" });
  });

  it("lets a script subtag override the language", () => {
    expect(directionOf("ur")).toBe("rtl");
    expect(directionOf("az-Arab")).toBe("rtl");
    expect(directionOf("az-Latn")).toBe("ltr");
    expect(directionOf("pa-Arab")).toBe("rtl");
  });

  it("reads ?lang= and ignores unknown values", () => {
    expect(localeFromSearch("?lang=fa")).toBe("fa");
    expect(localeFromSearch("?x=1&lang=tr")).toBe("tr");
    expect(localeFromSearch("?lang=xx")).toBeNull();
    expect(localeFromSearch("")).toBeNull();
  });
});

describe("Turkish casing", () => {
  it("maps i to dotted capital I only with the tr locale", () => {
    expect("istanbul".toLocaleUpperCase("tr")).toBe("İSTANBUL");
    expect("istanbul".toUpperCase()).toBe("ISTANBUL");
    expect("DİYARBAKIR".toLocaleLowerCase("tr")).toBe("diyarbakır");
  });
});

describe("translation files", () => {
  it("flag Persian and Turkish as awaiting owner review", () => {
    expect(fa._meta.status).toBe("awaiting owner review (Siavash)");
    expect(tr._meta.status).toBe("awaiting owner review (Siavash)");
  });

  it("only translate keys that exist in the English source", () => {
    const flat = (o: object, p = ""): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
    const source = new Set(flat(en));
    for (const file of [fa, tr]) {
      for (const key of flat(file).filter((k) => !k.startsWith("_meta"))) expect(source.has(key)).toBe(true);
    }
  });

  it("write Persian with ZWNJ, Persian digits and no Latin digits", () => {
    const text = JSON.stringify(fa);
    expect(text).toContain("زبان‌های");
    expect(text).not.toMatch(/\d/);
    expect(text).toContain("۰");
  });
});
