import { useCallback } from "react";
import type { ParseKeys, TOptions } from "i18next";
import { useTranslation } from "react-i18next";

import { DEFAULT_LOCALE, directionOf, type Direction } from "./direction";
import { useLocale } from "./locale";

export type Tx = { text: string; lang?: string; dir?: Direction };
type Key = ParseKeys;

/**
 * Like t(), but also says which language the text is in when a key has no translation yet and
 * i18next fell back to English. Spread the lang and dir onto the element so an English string
 * inside a Persian page keeps its own direction (punctuation and margins stay on the right side).
 * Translated strings return no lang or dir: they inherit from <html>.
 */
export function useTx() {
  const { t, i18n } = useTranslation();
  const locale = useLocale();
  return useCallback(
    (key: Key, options?: TOptions): Tx => {
      const text = String(t(key as never, options as never));
      const base = key.replace(/_(one|other|zero|two|few|many)$/, "");
      const translated =
        locale === DEFAULT_LOCALE ||
        i18n.exists(key, { lng: locale, fallbackLng: false }) ||
        i18n.exists(`${base}_other`, { lng: locale, fallbackLng: false });
      return translated ? { text } : { text, lang: DEFAULT_LOCALE, dir: directionOf(DEFAULT_LOCALE) };
    },
    [t, i18n, locale],
  );
}
