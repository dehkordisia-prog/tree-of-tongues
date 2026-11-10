// i18next setup. English is bundled (it is the source language and the fallback).
// Persian and Turkish are separate chunks that load when a visitor picks them, so they
// cost nothing against the initial JavaScript budget (docs/ARCHITECTURE.md).
//
// ICU MessageFormat (i18next-icu) is deliberately not installed yet: Phase 0 has no plurals
// or gender. i18next's own plural rules use Intl.PluralRules for fa and tr. Revisit before
// the first count-bearing string (see docs/DECISIONS.md).
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, LOCALES, type Locale } from "./direction";
import en from "./en.json";
import { loadRegionNames } from "./regions";

export const i18n = i18next.createInstance();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...LOCALES],
  nonExplicitSupportedLngs: false,
  initAsync: false,
  interpolation: { escapeValue: false }, // React escapes
  returnEmptyString: false,
  react: { useSuspense: false },
});

const loaders: Record<Exclude<Locale, "en">, () => Promise<{ default: object }>> = {
  fa: () => import("./fa.json"),
  tr: () => import("./tr.json"),
};

/** Make sure the resource bundle for a locale is registered. English is always present. */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === "en") return;
  const regions = loadRegionNames(locale);
  if (!i18n.hasResourceBundle(locale, "translation")) {
    const { default: bundle } = await loaders[locale]();
    i18n.addResourceBundle(locale, "translation", bundle, true, true);
  }
  await regions;
}

export { DEFAULT_LOCALE, LOCALES } from "./direction";
export type { Locale } from "./direction";
