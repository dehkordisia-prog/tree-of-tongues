// The tree spike body: canvas, breadcrumb, list of what is inside the focus, live region.
// Loaded lazily from the route so no renderer lands in the app shell bundle.

import { useEffect, useId, useRef, useState } from "react";

import { useResolvedTheme } from "@/design/ThemeToggle";
import { usePrefersReducedMotion } from "@/design/useReducedMotion";

import { installBenchHook } from "./benchHook";
import { TreeController, type UiState } from "./controller";
import { LOD, setLodMode } from "./lod";
import { SIZE_RULE_TEXT, type TreeLayout } from "./layout";
import { loadTree, type LoadResult } from "./loadTree";
import { makePalette } from "./palette";
import type { RendererName, TreeRenderer } from "./renderer";

const FONT_FAMILY = '"Tongues Sans", system-ui, sans-serif';
const NF = new Intl.NumberFormat("en");

export interface TreeViewProps {
  renderer: RendererName;
  /** ?bench=1: install window.__bench. */
  bench: boolean;
  /** ?stress=1: draw every languoid at the world view. */
  stress: boolean;
  /** Glottocode from ?focus=. */
  initialFocus: string | null;
  otherRendererHref: string;
}

type Phase = { kind: "loading" } | { kind: "missing" } | { kind: "error"; message: string } | { kind: "ready" };

const RENDERER_LABEL: Record<RendererName, string> = { pixi: "PixiJS", deck: "deck.gl" };

async function createRenderer(name: RendererName): Promise<TreeRenderer> {
  if (name === "deck") {
    const m = await import("./deckRenderer");
    return new m.DeckRenderer();
  }
  const m = await import("./pixiRenderer");
  return new m.PixiRenderer();
}

function writeFocusParam(layout: TreeLayout, focus: number) {
  const url = new URL(window.location.href);
  if (focus === layout.root) url.searchParams.delete("focus");
  else url.searchParams.set("focus", layout.glottocode[focus]!);
  window.history.replaceState(window.history.state, "", url);
}

export default function TreeView({ renderer, bench, stress, initialFocus, otherRendererHref }: TreeViewProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [loaded, setLoaded] = useState<Extract<LoadResult, { ok: true }> | null>(null);
  const [ui, setUi] = useState<UiState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [stats, setStats] = useState({ circles: 0, labels: 0, buildMs: 0, submitMs: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<TreeController | null>(null);
  const reduced = usePrefersReducedMotion();
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);
  const theme = useResolvedTheme();
  const themeRef = useRef(theme);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  const loadStart = useRef(0);
  const helpId = useId();
  const listId = useId();

  // 1. Fetch and lay out in a worker.
  useEffect(() => {
    const hook = bench ? installBenchHook() : null;
    let cancelled = false;
    loadStart.current = performance.now();
    loadTree().then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        setPhase({ kind: "missing" });
        hook?.rejectReady("tree.json is not available");
        return;
      }
      setLoaded(res);
    });
    return () => {
      cancelled = true;
    };
  }, [bench]);

  // 2. Start the renderer and controller once the layout exists.
  useEffect(() => {
    if (!loaded) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ring = ringRef.current;
    if (!canvas || !wrap || !ring) return;
    const hook = bench ? installBenchHook() : null;
    let cancelled = false;
    let controller: TreeController | null = null;
    let rend: TreeRenderer | null = null;
    let ro: ResizeObserver | null = null;
    let statsTimer = 0;
    const layout = loaded.layout;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    };

    (async () => {
      try {
        const chars = new Set<string>();
        for (const nm of layout.name) for (const ch of nm) chars.add(ch);
        await document.fonts.load(`500 ${LOD.LABEL_FONT_PX}px "Tongues Sans"`, Array.from(chars).join(""));
        setLodMode(stress ? "stress" : "normal");
        const r = await createRenderer(renderer);
        if (cancelled) return;
        rend = r;
        const size = measure();
        const dpr = window.devicePixelRatio || 1;
        const palette = makePalette(themeRef.current);
        await r.init({ canvas, layout, size, dpr, palette, fontFamily: FONT_FAMILY });
        if (cancelled) {
          r.destroy();
          return;
        }
        const focusIndex = initialFocus ? layout.glottocode.indexOf(initialFocus) : -1;
        controller = new TreeController({
          canvas,
          cursorRing: ring,
          layout,
          renderer: r,
          palette,
          size,
          reducedMotion: () => reducedRef.current,
          onState: (s) => {
            setUi(s);
            writeFocusParam(layout, s.focus);
          },
          onAnnounce: setAnnouncement,
          initialFocus: focusIndex >= 0 ? focusIndex : undefined,
        });
        controllerRef.current = controller;
        ro = new ResizeObserver(() => {
          const s = measure();
          r.resize(s, window.devicePixelRatio || 1);
          controller?.resize(s);
        });
        ro.observe(wrap);
        statsTimer = window.setInterval(() => {
          if (controller) setStats({ ...controller.stats });
        }, 500);
        setPhase({ kind: "ready" });
        await r.firstFrame;
        const firstFrameMs = performance.now() - loadStart.current;
        if (hook) {
          hook.setRunner(() => {
            const c = controller;
            if (!c) return Promise.reject(new Error("tree is not running"));
            return c.runBench({ renderer, layoutMs: loaded.timings.layoutMs, firstFrameMs });
          });
          hook.resolveReady();
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setPhase({ kind: "error", message });
        hook?.rejectReady(message);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(statsTimer);
      ro?.disconnect();
      controller?.destroy();
      controllerRef.current = null;
      rend?.destroy();
    };
    // The renderer, data and hook are fixed for the life of this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, renderer]);

  // 3. Theme changes recolor the canvas.
  useEffect(() => {
    controllerRef.current?.setPalette(makePalette(theme));
  }, [theme]);

  const layout = loaded?.layout ?? null;
  const focusName = layout && ui ? layout.name[ui.focus]! : "";

  if (phase.kind === "missing") {
    return (
      <div role="status" className="mt-6 rounded-lg border border-line bg-surface p-6">
        <p className="text-lead">Data not built yet. Run <code>uv run pipeline build</code>.</p>
        <p className="mt-2 text-ink-muted">
          The tree reads <code>/data/tree.json</code>, which the pipeline writes to <code>data/build</code>. Nothing is drawn without it.
        </p>
      </div>
    );
  }
  if (phase.kind === "error") {
    return (
      <div role="alert" className="mt-6 rounded-lg border border-danger bg-surface p-6">
        <p className="text-lead">The {RENDERER_LABEL[renderer]} renderer could not start.</p>
        <p className="mt-2 text-ink-muted">{phase.message}</p>
        <p className="mt-2">
          <a href={otherRendererHref}>Try the {RENDERER_LABEL[renderer === "pixi" ? "deck" : "pixi"]} renderer</a>
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-small text-ink-muted">
        Renderer: <strong className="text-ink">{RENDERER_LABEL[renderer]}</strong>.{" "}
        <a href={otherRendererHref}>Switch to {RENDERER_LABEL[renderer === "pixi" ? "deck" : "pixi"]}</a>. {SIZE_RULE_TEXT}
      </p>

      <nav aria-label="Focused path" className="mt-3">
        <ol className="flex flex-wrap items-center gap-x-1">
          {ui && layout
            ? ui.path.map((v, i) => {
                const last = i === ui.path.length - 1;
                return (
                  <li key={v} className="flex items-center gap-x-1">
                    {i > 0 && <span aria-hidden="true" className="text-ink-muted">/</span>}
                    <button
                      type="button"
                      aria-current={last ? "location" : undefined}
                      onClick={() => controllerRef.current?.focusNode(v)}
                      className={`min-h-target rounded-sm px-2 text-start underline decoration-1 underline-offset-4 ${last ? "font-semibold text-ink" : "text-link"}`}
                    >
                      {layout.name[v]}
                    </button>
                  </li>
                );
              })
            : <li className="min-h-target px-2 leading-[44px] text-ink-muted">Loading the tree...</li>}
        </ol>
      </nav>

      <div ref={wrapRef} className="relative mt-2 h-[calc(100dvh-16rem)] min-h-[420px] overflow-hidden rounded-lg border border-line bg-canvas">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="Language family tree, a zoomable canvas of circles"
          aria-describedby={helpId}
          className="block h-full w-full cursor-grab touch-none focus-visible:[outline-offset:-3px]"
        />
        <div
          ref={ringRef}
          aria-hidden="true"
          className="pointer-events-none absolute start-0 top-0 hidden rounded-full border-[3px] border-focus"
        />
        {ui && layout && (
          <details className="absolute end-2 top-2 max-h-[70%] w-56 overflow-auto rounded-md border border-line bg-surface text-small shadow-overlay">
            <summary className="min-h-target cursor-pointer px-3 leading-[44px]">
              Inside {focusName} ({NF.format(ui.kidsTotal)})
            </summary>
            <nav aria-label={`Inside ${focusName}`}>
              <ul id={listId}>
                {ui.kids.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => controllerRef.current?.focusNode(k)}
                      className="min-h-target w-full px-3 text-start text-link underline decoration-1 underline-offset-4"
                    >
                      {layout.name[k]}
                      <span className="text-ink-muted"> ({layout.level[k] === 0 ? "family" : layout.level[k] === 1 ? "language" : "dialect"})</span>
                    </button>
                  </li>
                ))}
              </ul>
              {ui.kidsTotal > ui.kids.length && (
                <p className="px-3 pb-3 text-ink-muted">
                  and {NF.format(ui.kidsTotal - ui.kids.length)} more. Zoom in to reach them.
                </p>
              )}
              {ui.kidsTotal === 0 && <p className="px-3 pb-3 text-ink-muted">Nothing deeper in this tree.</p>}
            </nav>
          </details>
        )}
      </div>

      <p id={helpId} className="mt-2 text-small text-ink-muted">
        Drag to pan, scroll or pinch to zoom, click a circle to fly to it. Keyboard: arrow keys move among siblings,
        Enter zooms in, Escape zooms out, Home shows the whole tree, plus and minus zoom.
      </p>
      <p className="mt-1 text-small text-ink-muted" data-testid="tree-stats">
        {layout ? `${NF.format(layout.n)} languoids loaded${stress ? " (stress: semantic zoom off)" : ""}. ` : ""}
        {stats.circles > 0 ? `${NF.format(stats.circles)} circles and ${stats.labels} labels drawn.` : ""}
        {stats.circles > 0 ? ` Main thread per frame: scene ${stats.buildMs.toFixed(1)} ms, draw ${stats.submitMs.toFixed(1)} ms.` : ""}
        {loaded ? ` Layout ${loaded.timings.layoutMs.toFixed(0)} ms in a worker.` : ""}
      </p>
      {loaded && loaded.mismatches.length > 0 && (
        <p className="mt-1 text-small text-danger" role="note">
          Family colors: {loaded.mismatches.length} expected Glottolog families were not found or were renamed
          ({loaded.mismatches.map((m) => m.glottocode).join(", ")}). They use the neutral color.
        </p>
      )}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}
