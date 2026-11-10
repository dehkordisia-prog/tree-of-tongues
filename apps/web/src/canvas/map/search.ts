// A small name search over languages.geojson. No dependency: 26 thousand short strings scan in a
// few milliseconds. MiniSearch arrives with the real search in Phase 1.

import type { LanguagePoints } from "./data";

/** Lowercase, strip combining marks, so an alias with a macron matches its plain spelling and "Türkçe" finds "turkce". */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/** Names the English UI shows instead of the Glottolog name (D-004). Key: Glottocode. */
export const DISPLAY_NAME: Readonly<Record<string, string>> = {
  west2369: "Persian",
};

/** Search aliases only; never shown as a name. Key: Glottocode. */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  west2369: ["Persian", "Farsi", "fārsi", "فارسی"], // alias list: "Farsi" is a search alias only
};

export function displayName(glottocode: string, glottologName: string): string {
  return DISPLAY_NAME[glottocode] ?? glottologName;
}

export interface SearchEntry {
  index: number;
  text: string;
}

export function buildSearchIndex(points: LanguagePoints): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (let i = 0; i < points.count; i++) {
    if (points.levels[i] === 0) continue;
    const code = points.glottocodes[i]!;
    entries.push({ index: i, text: normalize(displayName(code, points.names[i]!)) });
    for (const alias of SEARCH_ALIASES[code] ?? []) entries.push({ index: i, text: normalize(alias) });
  }
  return entries;
}

export interface SearchHit {
  index: number;
  score: number;
}

/** Exact, then prefix, then word prefix, then substring. Languages before dialects. Max `limit` hits. */
export function searchNames(
  entries: readonly SearchEntry[],
  levels: Uint8Array,
  query: string,
  limit = 8,
): SearchHit[] {
  const q = normalize(query);
  if (q.length < 2) return [];
  const best = new Map<number, number>();
  for (const e of entries) {
    const at = e.text.indexOf(q);
    if (at < 0) continue;
    let score = 3;
    if (e.text === q) score = 0;
    else if (at === 0) score = 1;
    else if (e.text[at - 1] === " " || e.text[at - 1] === "-") score = 2;
    score += levels[e.index] === 2 ? 0.5 : 0;
    const prev = best.get(e.index);
    if (prev === undefined || score < prev) best.set(e.index, score);
  }
  return [...best.entries()]
    .map(([index, score]) => ({ index, score }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, limit);
}
