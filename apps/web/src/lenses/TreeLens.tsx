// The Tree lens in the shell: the spike's controller and renderers (PixiJS per D-021; deck.gl with
// ?renderer=deck for the D-006 benchmark), driven by the shell store. Loaded lazily.
//
// In the shell the tree focus is the selection (spec 3.4). A click or a key on the canvas selects
// (push); a selection from anywhere else flies the tree. Settled cameras go to the URL, relative
// to the selection (spec 2.2): tz = log2(scale / fit scale), dx, dy = center offset / radius.

import { useEffect, useId, useRef, useState } from "react";

import type { Camera } from "@/canvas/tree/camera";
import { TreeController, type UiState } from "@/canvas/tree/controller";
import { describeNode } from "@/canvas/tree/describe";
import { SpeakerStore } from "@/canvas/tree/glyph";
import { TreeLegend, useLegend } from "@/canvas/tree/Legend";
import { LEVEL_FAMILY, LEVEL_LANGUAGE, WORLD_RADIUS, type TreeLayout } from "@/canvas/tree/layout";
import { loadTree } from "@/canvas/tree/loadTree";
import { LOD, setLodMode } from "@/canvas/tree/lod";
import { makePalette } from "@/canvas/tree/palette";
import type { RendererName, TreeRenderer } from "@/canvas/tree/renderer";
import { loadScopeIndex } from "@/data/scopeIndex";
import { labelFor } from "@/data/names";
import { useResolvedTheme } from "@/design/ThemeToggle";
import { usePrefersReducedMotion } from "@/design/useReducedMotion";
import { Icon, T, useT } from "@/shell/T";
import { shellStore, useShell } from "@/state/shell";
import { round, type Selection, type TreeCamera } from "@/state/url";

const FONT_FAMILY = '"Tongues Sans", system-ui, sans-serif';

async function createRenderer(name: RendererName): Promise<TreeRenderer> {
  if (name === "deck") return new (await import("@/canvas/tree/deckRenderer")).DeckRenderer();
  return new (await import("@/canvas/tree/pixiRenderer")).PixiRenderer();
}

type Phase = "loading" | "missing" | "error" | "ready";

function nodeOf(layout: TreeLayout, sel: Selection, byCode: Map<string, number>): number {
  if (!sel) return layout.root;
  if (sel.kind === "language" || sel.kind === "family") return byCode.get(sel.glottocode) ?? -1;
  return layout.root;
}

function circleOf(layout: TreeLayout, v: number): { x: number; y: number; r: number } {
  if (v === layout.root) return { x: 0, y: 0, r: WORLD_RADIUS };
  return { x: layout.x[v]!, y: layout.y[v]!, r: layout.r[v]! };
}

export function toRelative(layout: TreeLayout, v: number, cam: Camera, fit: Camera): TreeCamera {
  const c = circleOf(layout, v);
  return {
    tz: round(Math.log2(cam.scale / fit.scale), 2),
    dx: round((cam.cx - c.x) / c.r, 2),
    dy: round((cam.cy - c.y) / c.r, 2),
  };
}

export function fromRelative(layout: TreeLayout, v: number, rel: TreeCamera, fit: Camera): Camera {
  const c = circleOf(layout, v);
  return { scale: fit.scale * 2 ** rel.tz, cx: c.x + rel.dx * c.r, cy: c.y + rel.dy * c.r };
}

export default function TreeLens({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [layout, setLayout] = useState<TreeLayout | null>(null);
  const [ui, setUi] = useState<UiState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ctl = useRef<TreeController | null>(null);
  const byCode = useRef(new Map<string, number>());
  /** 1 for the scope languages: their labels win collisions. */
  const scopeMark = useRef<Uint8Array | null>(null);
  const [legendOpen, toggleLegend] = useLegend();
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
  const helpId = useId();
  const t = useT();
  const renderer: RendererName = useShell((s) => (s.flags.renderer === "deck" ? "deck" : "pixi"));
  const selection = useShell((s) => s.selection);
  const restore = useShell((s) => s.cameraRestore);
  const lastRestore = useRef(-1);
  /** The node the tree last asked for or was told to show; a canvas move selects when it differs. */
  const wanted = useRef(-2);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // 1. Load and lay out (worker), then relabel nodes the atlas names differently (D-004).
  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadTree(), loadScopeIndex()]).then(([res, index]) => {
      if (cancelled) return;
      if (!res.ok) {
        setPhase("missing");
        return;
      }
      const L = res.layout;
      for (let i = 0; i < L.n; i++) {
        L.name[i] = labelFor(L.glottocode[i]!, L.name[i]!, index.labels);
        byCode.current.set(L.glottocode[i]!, i);
      }
      const mark = new Uint8Array(L.n + 1);
      for (const lang of index.langs) {
        const i = byCode.current.get(lang.g);
        if (i !== undefined && lang.decided) mark[i] = 1;
      }
      scopeMark.current = mark;
      setLayout(L);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Renderer and controller.
  useEffect(() => {
    if (!layout) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const ring = ringRef.current;
    if (!canvas || !wrap || !ring) return;
    let cancelled = false;
    let controller: TreeController | null = null;
    let rend: TreeRenderer | null = null;
    let ro: ResizeObserver | null = null;
    const measure = () => {
      const r = wrap.getBoundingClientRect();
      return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    };
    void (async () => {
      try {
        const chars = new Set<string>();
        for (const nm of layout.name) for (const ch of nm) chars.add(ch);
        await document.fonts.load(`500 ${LOD.LABEL_FONT_PX}px "Tongues Sans"`, Array.from(chars).join(""));
        setLodMode(shellStore.getState().flags.stress ? "stress" : "normal");
        const r = await createRenderer(renderer);
        if (cancelled) return;
        rend = r;
        const size = measure();
        const palette = makePalette(themeRef.current);
        await r.init({
          canvas,
          layout,
          size,
          dpr: window.devicePixelRatio || 1,
          palette,
          fontFamily: FONT_FAMILY,
        });
        if (cancelled) {
          r.destroy();
          return;
        }
        const st = shellStore.getState();
        const start = nodeOf(layout, st.selection, byCode.current);
        const focus = start >= 0 ? start : layout.root;
        controller = new TreeController({
          canvas,
          cursorRing: ring,
          layout,
          renderer: r,
          palette,
          size,
          reducedMotion: () => reducedRef.current,
          initialFocus: focus,
          speakers: new SpeakerStore(layout),
          priority: scopeMark.current ?? undefined,
          onState: (s) => {
            setUi(s);
            const cur = shellStore.getState();
            const fromStore = nodeOf(layout, cur.selection, byCode.current);
            const want = wanted.current === -2 ? (fromStore < 0 ? layout.root : fromStore) : wanted.current;
            if (s.focus !== want) {
              wanted.current = s.focus;
              const sel: Selection =
                s.focus === layout.root
                  ? null
                  : {
                      kind: layout.level[s.focus] === LEVEL_FAMILY ? "family" : "language",
                      glottocode: layout.glottocode[s.focus]!,
                    };
              cur.select(sel, { source: "canvas" });
            }
          },
          onAnnounce: (m) => shellStore.getState().announce(m),
          onFlight: (running) => shellStore.getState().setFlight("tree", running),
          onSettled: (cam) => {
            if (!activeRef.current || !controller) return;
            const v = controller.focus;
            shellStore
              .getState()
              .commitCamera("tree", toRelative(layout, v, cam, controller.targetCamera(v)));
          },
        });
        if (st.treeCamera) {
          controller.goTo(fromRelative(layout, focus, st.treeCamera, controller.targetCamera(focus)), false);
        }
        ctl.current = controller;
        controller.setPaused(!activeRef.current);
        ro = new ResizeObserver(() => {
          const s = measure();
          if (s.w < 2 || s.h < 2) return;
          r.resize(s, window.devicePixelRatio || 1);
          controller?.resize(s);
        });
        ro.observe(wrap);
        setPhase("ready");
        lastRestore.current = st.cameraRestore;
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      ro?.disconnect();
      controller?.destroy();
      ctl.current = null;
      rend?.destroy();
    };
    // The renderer and layout are fixed for the life of this lens.
  }, [layout, renderer]);

  // 3. Pause while hidden (spec 1.1); recolor on theme change.
  useEffect(() => ctl.current?.setPaused(!active), [active, phase]);
  useEffect(() => ctl.current?.setPalette(makePalette(theme)), [theme]);

  // 4. Store selection -> tree focus. Back and forward restore the URL camera.
  useEffect(() => {
    const c = ctl.current;
    if (!c || !layout) return;
    const v = nodeOf(layout, selection, byCode.current);
    const target = v >= 0 ? v : layout.root;
    const st = shellStore.getState();
    const cam = st.treeCamera
      ? fromRelative(layout, target, st.treeCamera, c.targetCamera(target))
      : undefined;
    if (v < 0 && selection) {
      // A languoid the tree does not draw: fly to the world and say so (spec 3.4).
      setNote(
        t("tree.notDrawn", {
          name: selection.kind === "language" || selection.kind === "family" ? selection.glottocode : "",
          ancestor: t("crumbs.world"),
        }),
      );
    } else setNote(null);
    const restored = restore !== lastRestore.current;
    lastRestore.current = restore;
    wanted.current = target;
    if (c.focus !== target) c.focusNode(target, false, cam);
    else if (cam && restored) c.goTo(cam, !reducedRef.current);
    else if (restored && !cam) c.goTo(c.targetCamera(target), !reducedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, restore, phase]);

  const L = layout;
  const focusName = L && ui ? L.name[ui.focus]! : "";

  if (phase === "missing" || phase === "error") {
    return (
      <div
        role={phase === "error" ? "alert" : "status"}
        className="m-4 max-w-xl rounded-lg border border-line-strong bg-surface p-5"
        data-testid="tree-missing"
      >
        <T
          as="p"
          k={phase === "error" ? "error.canvas" : "error.noData"}
          o={{ lens: t("lens.tree").toLowerCase() }}
          className="font-semibold"
        />
        <T
          as="p"
          k="error.canvasNext"
          o={{ other: t("lens.map").toLowerCase() }}
          className="mt-1 text-small text-ink-muted"
        />
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 overflow-hidden bg-canvas"
      data-testid="tree-lens"
      data-ready={phase === "ready" ? "true" : "false"}
    >
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="application"
        aria-label={t("tree.label")}
        aria-describedby={helpId}
        aria-roledescription="canvas"
        className="block h-full w-full cursor-grab touch-none"
        lang="en"
        data-lens-canvas="tree"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0 hidden rounded-full border-[3px] border-focus"
        style={{ left: 0 }}
      />
      <p id={helpId} className="sr-only">
        {t("tree.help")}
      </p>
      {phase === "loading" && (
        <div role="status" className="absolute inset-0 flex items-center justify-center">
          <T k="loading.tree" className="rounded-md bg-surface px-4 py-2 shadow-raised" />
        </div>
      )}
      {note && (
        <p
          role="note"
          className="absolute start-4 top-4 max-w-sm rounded-md border border-line-strong bg-surface px-3 py-2 text-small shadow-raised"
        >
          {note}
        </p>
      )}
      {ui && L && (
        <details className="absolute end-4 top-4 max-h-[60%] w-60 overflow-auto rounded-md border border-line bg-surface text-small shadow-overlay">
          <summary className="min-h-target cursor-pointer px-3 leading-[44px]">
            <T k="tree.inside" o={{ name: focusName, count: ui.kidsTotal }} />
          </summary>
          <ul>
            {ui.kids.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => ctl.current?.focusNode(k)}
                  className="min-h-target w-full px-3 text-start text-link underline decoration-1 underline-offset-4"
                  aria-label={describeNode(L, k)}
                >
                  <bdi>{L.name[k]}</bdi>
                  <span className="text-ink-muted">
                    {" "}
                    (
                    {t(
                      `levelLower.${L.level[k] === LEVEL_FAMILY ? "family" : L.level[k] === LEVEL_LANGUAGE ? "language" : "dialect"}`,
                    )}
                    )
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {ui.kidsTotal > ui.kids.length && (
            <T
              as="p"
              k="tree.andMore"
              o={{ count: ui.kidsTotal - ui.kids.length }}
              className="px-3 pb-3 text-ink-muted"
            />
          )}
          {ui.kidsTotal === 0 && <T as="p" k="empty.members" className="px-3 pb-3 text-ink-muted" />}
        </details>
      )}
      <TreeLegend open={legendOpen} onToggle={toggleLegend} />
      <div className="absolute bottom-4 end-4 flex gap-2">
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.in")}
          onClick={() => ctl.current?.zoomCenter(1.6)}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.out")}
          onClick={() => ctl.current?.zoomCenter(1 / 1.6)}
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.all")}
          onClick={() => shellStore.getState().select(null, { source: "canvas" })}
        >
          <Icon name="home" />
        </button>
      </div>
    </div>
  );
}
