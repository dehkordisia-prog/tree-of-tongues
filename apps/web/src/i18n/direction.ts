// Locale to lang and dir. Pure functions, safe on server and client.

export const LOCALES = ["en", "fa", "tr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export type Direction = "ltr" | "rtl";

/** Endonyms for the interface-language links. The English UI says "Persian"; fa is the code. */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  fa: "فارسی",
  tr: "Türkçe",
};

// Primary language subtags written right to left by default (CLDR characterOrder).
const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur", "ps", "sd", "ug", "yi", "ckb", "dv", "ks"]);
// Script subtags that override the language default.
const RTL_SCRIPTS = new Set(["Arab", "Hebr", "Thaa", "Syrc", "Nkoo", "Adlm"]);

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Text direction for any BCP 47 tag, for example "fa", "ur-Arab" or "az-Arab". */
export function directionOf(tag: string): Direction {
  const [language = "", ...rest] = tag.split("-");
  const script = rest.find((part) => part.length === 4);
  if (script)
    return RTL_SCRIPTS.has(script[0]!.toUpperCase() + script.slice(1).toLowerCase()) ? "rtl" : "ltr";
  return RTL_LANGUAGES.has(language.toLowerCase()) ? "rtl" : "ltr";
}

/** Attributes for <html> (and for any multilingual span). */
export function htmlAttributes(locale: Locale): { lang: string; dir: Direction } {
  return { lang: locale, dir: directionOf(locale) };
}

/** Read ?lang=xx from a location.search string. Unknown values return null. */
export function localeFromSearch(search: string): Locale | null {
  const value = new URLSearchParams(search).get("lang");
  return isLocale(value) ? value : null;
}
