// The Map lens in the shell: the spike's data loaders and MapController (MapLibre plus deck.gl,
// borders policy D-019), driven by the shell store. Loaded lazily; MapLibre and deck.gl sit behind
// a second dynamic import, as in the spike.
//
// Phase 1 round 1: a language selection highlights its Glottolog point and fills the countries CLDR
// lists for it. Clicking a point selects that language. Country and disputed-area selection waits
// for the country route (spec 2.1, should-have).

import { useEffect, useId, useRef, useState } from "react";

import type { MapController } from "@/canvas/map/controller";
import { loadAll, DataMissingError, type LoadedData } from "@/canvas/map/data";
import { joinChoropleth } from "@/canvas/map/policy";
import { getBundleCached } from "@/data/clientDeps";
import { labelFor } from "@/data/names";
import { loadScopeIndex } from "@/data/scopeIndex";
import { useResolvedTheme } from "@/design/ThemeToggle";
import { currentTheme, prefersReducedMotion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/design/useReducedMotion";
import { Icon, T, useT } from "@/shell/T";
import { shellStore, useShell } from "@/state/shell";
import { round, sameMapCamera, type MapCamera } from "@/state/url";

type Phase = "loading" | "missing" | "error" | "ready";
const IN_VIEW_MAX = 40;

async function importWithRetry<T>(load: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await load();
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

export default function MapLens({ active }: { active: boolean }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [data, setData] = useState<LoadedData | null>(null);
  const [ctl, setCtl] = useState<MapController | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [inView, setInView] = useState<{ g: string; name: string }[]>([]);
  const [inViewTotal, setInViewTotal] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const theme = useResolvedTheme();
  const reduced = usePrefersReducedMotion();
  const selection = useShell((s) => s.selection);
  const dialects = useShell((s) => s.mapDialects);
  const restore = useShell((s) => s.cameraRestore);
  const t = useT();
  const listId = useId();
  const activeRef = useRef(active);
  const fitCam = useRef<MapCamera | null>(null);
  const programmatic = useRef(false);
  const lastRestore = useRef(-1);

  useEffect(() => {
    activeRef.current = active;
    if (active) ctl?.map.resize();
  }, [active, ctl]);

  // 1. Data.
  useEffect(() => {
    const ac = new AbortController();
    void loadScopeIndex().then((i) => setLabels(i.labels));
    loadAll(ac.signal).then(
      (d) => setData(d),
      (e: unknown) => {
        if (!ac.signal.aborted) setPhase(e instanceof DataMissingError ? "missing" : "error");
      },
    );
    return () => ac.abort();
  }, []);

  // 2. Map.
  useEffect(() => {
    if (!data || !container.current) return;
    const pts = data.points;
    let cancelled = false;
    let created: MapController | null = null;
    const el = container.current;
    void (async () => {
      try {
        const { MapController } = await importWithRetry(() => import("@/canvas/map/controller"));
        const st = shellStore.getState();
        const c = await MapController.create({
          container: el,
          theme: currentTheme(),
          geo: data.geo,
          points: data.points,
          showDialects: st.mapDialects,
          reducedMotion: prefersReducedMotion(),
          mapTitle: t("lens.map"),
          onHit: (hit) => {
            if (hit?.kind === "language") {
              const g = data.points.glottocodes[hit.index]!;
              const level = data.points.levels[hit.index];
              shellStore
                .getState()
                .select({ kind: level === 0 ? "family" : "language", glottocode: g }, { source: "canvas" });
            }
          },
        });
        if (cancelled) {
          c.destroy();
          return;
        }
        created = c;
        if (st.mapCamera)
          c.setCamera({ lng: st.mapCamera.lon, lat: st.mapCamera.lat, zoom: st.mapCamera.zoom });
        lastRestore.current = st.cameraRestore;
        c.map.on("movestart", () => shellStore.getState().setFlight("map", true));
        c.map.on("moveend", () => {
          shellStore.getState().setFlight("map", false);
          const center = c.map.getCenter();
          const cam: MapCamera = {
            zoom: round(c.map.getZoom(), 2),
            lat: round(center.lat, 3),
            lon: round(center.lng, 3),
          };
          if (programmatic.current) {
            programmatic.current = false;
            fitCam.current = cam;
          }
          if (activeRef.current) {
            const fit = fitCam.current;
            shellStore.getState().commitCamera("map", fit && sameMapCamera(fit, cam) ? null : cam);
          }
          updateInView(c);
        });
        setCtl(c);
        await c.settled();
        if (!cancelled) {
          setPhase("ready");
          updateInView(c);
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    function updateInView(c: MapController) {
      const b = c.map.getBounds();
      const out: { g: string; name: string }[] = [];
      let total = 0;
      for (let i = 0; i < pts.count; i++) {
        if (pts.levels[i] !== 1) continue;
        const lon = pts.lonlat[2 * i]!;
        const lat = pts.lonlat[2 * i + 1]!;
        if (!b.contains([lon, lat])) continue;
        total++;
        out.push({ g: pts.glottocodes[i]!, name: pts.names[i]! });
      }
      out.sort((a, z) => a.name.localeCompare(z.name, "en"));
      setInView(out.slice(0, IN_VIEW_MAX));
      setInViewTotal(total);
    }
    return () => {
      cancelled = true;
      created?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => ctl?.applyTheme(theme), [ctl, theme]);
  useEffect(() => ctl?.setShowDialects(dialects), [ctl, dialects]);
  useEffect(() => ctl?.setReducedMotion(reduced), [ctl, reduced]);

  // 3. Selection -> point, choropleth and camera.
  useEffect(() => {
    if (!ctl || !data) return;
    let cancelled = false;
    const g =
      selection && (selection.kind === "language" || selection.kind === "family")
        ? selection.glottocode
        : null;
    const index = g ? data.points.index.get(g) : undefined;
    const st = shellStore.getState();
    const restored = st.cameraRestore !== lastRestore.current;
    lastRestore.current = st.cameraRestore;
    ctl.setSelectedPoint(index ?? null);
    ctl.setSelectedCountry(null);
    ctl.setChoropleth(new Map(), index === undefined ? null : data.points.family[index]!);
    if (st.mapCamera && restored) {
      ctl.setCamera({ lng: st.mapCamera.lon, lat: st.mapCamera.lat, zoom: st.mapCamera.zoom });
    } else if (!st.mapCamera && index !== undefined) {
      programmatic.current = true;
      ctl.focusPoint(index);
    }
    if (g && index !== undefined) {
      void getBundleCached(g).then((r) => {
        if (cancelled || r.status !== "ok") return;
        const rows = r.bundle.territories
          .flatMap((b) => b.items)
          .filter((i) => i.population_share !== null) as unknown as Parameters<typeof joinChoropleth>[0];
        ctl.setChoropleth(joinChoropleth(rows, data.geo.drawableCodes).fills, data.points.family[index]!);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [ctl, data, selection, restore]);

  if (phase === "missing" || phase === "error") {
    return (
      <div
        role={phase === "error" ? "alert" : "status"}
        className="m-4 max-w-xl rounded-lg border border-line-strong bg-surface p-5"
        data-testid="map-missing"
      >
        <T
          as="p"
          k={phase === "error" ? "error.canvas" : "error.noData"}
          o={{ lens: t("lens.map").toLowerCase() }}
          className="font-semibold"
        />
        <T
          as="p"
          k="error.canvasNext"
          o={{ other: t("lens.tree").toLowerCase() }}
          className="mt-1 text-small text-ink-muted"
        />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0"
      data-testid="map-lens"
      data-ready={phase === "ready" ? "true" : "false"}
    >
      <div
        ref={container}
        role="region"
        aria-label={t("lens.map")}
        lang="en"
        dir="ltr"
        data-testid="map"
        data-lens-canvas="map"
        style={{ position: "absolute", inset: 0 }}
      />
      {phase === "loading" && (
        <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <T k="loading.map" className="rounded-md bg-surface px-4 py-2 shadow-raised" />
        </div>
      )}
      {phase === "ready" && (
        <details className="absolute end-4 top-4 max-h-[60%] w-60 overflow-auto rounded-md border border-line bg-surface text-small shadow-overlay">
          <summary className="min-h-target cursor-pointer px-3 leading-[44px]">
            <T k="map.inView" o={{ count: inViewTotal }} />
          </summary>
          <ul id={listId}>
            {inView.map((x) => (
              <li key={x.g}>
                <button
                  type="button"
                  className="min-h-target w-full px-3 text-start text-link underline decoration-1 underline-offset-4"
                  onClick={() =>
                    shellStore.getState().select({ kind: "language", glottocode: x.g }, { source: "canvas" })
                  }
                >
                  <bdi>{labelFor(x.g, x.name, labels)}</bdi>
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="absolute bottom-4 end-4 flex gap-2">
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.in")}
          onClick={() => ctl?.map.zoomIn()}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.out")}
          onClick={() => ctl?.map.zoomOut()}
        >
          <Icon name="minus" />
        </button>
        <button
          type="button"
          className="tt-icon-button bg-surface"
          aria-label={t("zoom.all")}
          onClick={() => ctl?.map.easeTo({ center: [15, 25], zoom: 1.2, duration: reduced ? 0 : 600 })}
        >
          <Icon name="home" />
        </button>
      </div>
    </div>
  );
}
