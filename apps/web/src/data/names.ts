// Display labels. Rule (D-004): the scope list's display_name, else the Glottolog name. The English UI
// never shows the search alias as a label; Glottolog's own name for west2369 contains it, so that node has a
// fallback label here until the scope list carries its display_name (orchestrator, 2026-11-10).

export const LABEL_FALLBACKS: Readonly<Record<string, string>> = {
  west2369: "Iranian Persian",
};

export function labelFor(glottocode: string, glottologName: string, labels?: Readonly<Record<string, string>>): string {
  return labels?.[glottocode] ?? LABEL_FALLBACKS[glottocode] ?? glottologName;
}

/** Search aliases: matched, shown only as "Alias: ...", never as a label. Key: glottocode. */
export const SEARCH_ALIASES: Readonly<Record<string, readonly string[]>> = {
  west2369: ["Persian", "Farsi", "fārsi"], // alias list: "Farsi" is a search alias only (D-004)
};
