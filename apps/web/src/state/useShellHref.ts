// One helper builds every in-app link (spec 2.6, 3.2): keeps lens, lump and lang; drops cameras,
// tab and area, so a new selection gets a fresh fit at Overview.

import { useCallback } from "react";

import { useShell } from "./shell";
import { toShellHref, type Lens, type Selection, type Tab, DEFAULT_STATE } from "./url";

export interface HrefOptions {
  lens?: Lens;
  tab?: Tab;
}

export function shellHrefFor(
  current: { lens: Lens; lumped: readonly string[]; locale: string },
  sel: Selection,
  opts: HrefOptions = {},
): string {
  return toShellHref({
    ...DEFAULT_STATE,
    selection: sel,
    lens: opts.lens ?? current.lens,
    tab: opts.tab ?? DEFAULT_STATE.tab,
    lumped: current.lumped as UrlLumped,
    locale: current.locale as typeof DEFAULT_STATE.locale,
  });
}

type UrlLumped = typeof DEFAULT_STATE.lumped;

export function useShellHref(): (sel: Selection, opts?: HrefOptions) => string {
  const lens = useShell((s) => s.lens);
  const lumped = useShell((s) => s.lumped);
  const locale = useShell((s) => s.locale);
  return useCallback(
    (sel, opts) => shellHrefFor({ lens, lumped, locale }, sel, opts),
    [lens, lumped, locale],
  );
}
