// The canvas column: both lenses, each mounted on first use and then kept mounted and paused while
// hidden (spec 1.1). Lenses load through dynamic imports, so no renderer is in the app shell.

import { useEffect, useState, type ComponentType, type KeyboardEvent } from "react";

import { shellStore, useShell } from "@/state/shell";
import type { Lens } from "@/state/url";

import { T, useT } from "./T";
import { INSPECTOR_HEADING_ID } from "./inspector/parts";

type LensComponent = ComponentType<{ active: boolean }>;

const loaders: Record<Lens, () => Promise<{ default: LensComponent }>> = {
  tree: () => import("@/lenses/TreeLens"),
  map: () => import("@/lenses/MapLens"),
};

export const CANVAS_ID = "tt-canvas";

/** Single-key shortcuts work only while a canvas has focus (WCAG 2.1.4, spec 9.4). */
function onCanvasKey(e: KeyboardEvent<HTMLElement>) {
  const el = e.target as HTMLElement;
  const isCanvas =
    el.tagName === "CANVAS" ||
    el.classList.contains("maplibregl-canvas") ||
    el.classList.contains("maplibregl-canvas-container");
  if (!isCanvas || e.altKey || e.ctrlKey || e.metaKey) return;
  const s = shellStore.getState();
  if (e.key === "1") s.setLens("tree");
  else if (e.key === "2") s.setLens("map");
  else if (e.key === "i" || e.key === "I") document.getElementById(INSPECTOR_HEADING_ID)?.focus();
  else if (e.key === "?") s.setHelpOpen(true);
  else return;
  e.preventDefault();
}

export function CanvasHost() {
  const lens = useShell((s) => s.lens);
  const hydrated = useShell((s) => s.hydrated);
  const t = useT();
  const [mods, setMods] = useState<Partial<Record<Lens, LensComponent>>>({});

  useEffect(() => {
    if (!hydrated || mods[lens]) return;
    let alive = true;
    shellStore.getState().markMounted(lens);
    void loaders[lens]().then((m) => {
      if (alive) setMods((x) => ({ ...x, [lens]: m.default }));
    });
    return () => {
      alive = false;
    };
  }, [lens, hydrated, mods]);

  return (
    <section
      id={CANVAS_ID}
      aria-label={t("shell.canvasRegion", { lens: t(`lens.${lens}`) })}
      className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
      tabIndex={-1}
      onKeyDown={onCanvasKey}
    >
      {(["tree", "map"] as const).map((l) => {
        const Mod = mods[l];
        const on = l === lens;
        return (
          <div
            key={l}
            className={`absolute inset-0 transition-opacity duration-(--tt-dur-ui) ${on ? "opacity-100" : "pointer-events-none invisible opacity-0"}`}
            aria-hidden={on ? undefined : true}
            inert={!on}
            data-lens={l}
            data-active={on ? "true" : "false"}
          >
            {Mod ? (
              <Mod active={on} />
            ) : on ? (
              <div role="status" className="absolute inset-0 flex items-center justify-center">
                <T
                  k={l === "tree" ? "loading.tree" : "loading.map"}
                  className="rounded-md bg-surface px-4 py-2 shadow-raised"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
