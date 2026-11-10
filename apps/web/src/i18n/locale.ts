// The active locale as a tiny external store.
//
// Hydration: the prerendered HTML is English. useSyncExternalStore renders the server
// snapshot ("en") during hydration, then re-renders with the client snapshot, so a visit
// to /design?lang=fa hydrates without a mismatch and then switches. Phase 1 folds this
// into the global Zustand store (SPEC: the URL stays the source of truth).
import { useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, type Locale } from "./direction";
import { i18n, loadLocale } from "./index";

let current: Locale = DEFAULT_LOCALE;
let latestRequest: Locale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLocale(): Locale {
  return current;
}

/** React hook. Always "en" on the server and during hydration. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, () => DEFAULT_LOCALE);
}

/** Load the bundle, switch i18next, then publish. Strings and <html lang dir> change together. */
export async function setLocale(next: Locale): Promise<void> {
  latestRequest = next;
  await loadLocale(next);
  if (latestRequest !== next) return; // a newer request won
  await i18n.changeLanguage(next);
  if (latestRequest !== next || current === next) return;
  current = next;
  listeners.forEach((listener) => listener());
}
