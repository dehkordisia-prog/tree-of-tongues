import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  const mo = new MutationObserver(cb);
  mq.addEventListener("change", cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-motion"] });
  return () => {
    mq.removeEventListener("change", cb);
    mo.disconnect();
  };
}

function snapshot(): boolean {
  return document.documentElement.dataset.motion === "reduce" || window.matchMedia(QUERY).matches;
}

/**
 * True when the user asks for reduced motion (OS setting, or data-motion="reduce" on <html>).
 * Hydration-safe: prerendered HTML assumes full motion, then React switches after hydration.
 * Prefer this over motion/react's useReducedMotion, which reads the media query during hydration.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
