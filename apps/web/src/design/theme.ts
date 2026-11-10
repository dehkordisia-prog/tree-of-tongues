// Theme preference: "system" follows prefers-color-scheme; "night" and "parchment" are manual.
// Stored in localStorage (wrapped in try/catch: private modes and sandboxed frames throw).

import type { ThemeName } from "./tokens";

export type ThemePref = "system" | ThemeName;
export const THEME_STORAGE_KEY = "tt-theme";
const EVENT = "tt-theme-change";

function isPref(v: unknown): v is ThemePref {
  return v === "system" || v === "night" || v === "parchment";
}

export function readThemePref(): ThemePref {
  try {
    const v = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return isPref(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function applyThemePref(pref: ThemePref, root: HTMLElement = document.documentElement): void {
  if (pref === "system") delete root.dataset.theme;
  else root.dataset.theme = pref;
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the choice lasts for this page view only.
  }
  applyThemePref(pref);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeThemePref(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyThemePref(readThemePref());
      cb();
    }
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Inline script for <head> in app/root.tsx. Runs before first paint, so a stored manual theme
 * never flashes the other one. Keep it in sync with THEME_STORAGE_KEY.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="night"||t==="parchment")document.documentElement.dataset.theme=t}catch(e){}`;
