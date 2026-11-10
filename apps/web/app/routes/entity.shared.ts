// Route helpers shared by /language/:glottocode and /family/:glottocode.

import type { ShouldRevalidateFunctionArgs } from "react-router";

import type { EntityData } from "@/data/entity";
import { parseShellUrl } from "@/state/url";

export function lensOf(url: URL) {
  return parseShellUrl(url.pathname, url.search).state.lens;
}

/** Tab, camera and locale changes keep the loaded entity; a new path, or "Try again", loads again. */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  return currentUrl.href === nextUrl.href ? defaultShouldRevalidate : false;
}

export function entityTitle(data: EntityData | undefined, levelWord: string, notFound: string): string {
  if (!data || data.status === "redirect") return "Tree of Tongues";
  if (data.status === "ok") return `${data.label}, ${levelWord} · Tree of Tongues`;
  if (data.status === "not-found") return `${notFound} · Tree of Tongues`;
  return `${data.label ?? data.glottocode}, ${levelWord} · Tree of Tongues`;
}
