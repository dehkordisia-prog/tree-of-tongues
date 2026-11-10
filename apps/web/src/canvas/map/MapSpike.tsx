// The map spike body: toolbar, map, time slider, notes and the side panel (the text alternative).
// MapLibre and deck.gl live in controller.ts and load through a dynamic import, and only when the
// data is present, so a build without /data never downloads them.

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { FamilyMarker } from "@/design/FamilySwatch";
import { useResolvedTheme } from "@/design/ThemeToggle";
import { currentTheme, familyById, familyColor, prefersReducedMotion } from "@/design/tokens";
import { usePrefersReducedMotion } from "@/design/useReducedMotion";
import { useLocale } from "@/i18n/locale";

import { attachBench, wantsBench } from "./bench";
import type { Hit, MapController } from "./controller";
import {
  DATA_URLS,
  DataMissingError,
  fetchJson,
  loadAll,
  type Bundle,
  type LoadedData,
} from "./data";
import { FAMILY_ORDER } from "./families";
import {
  CountryPanel,
  EmptyPanel,
  LanguagePanel,
  NeutralPanel,
  Txt,
  useRegionName,
} from "./Panels";
import { BIN_LABELS, BORDERS_NOTE, joinChoropleth, type Join } from "./policy";
import { buildSearchIndex, displayName, searchNames } from "./search";
import { S } from "./strings";
import { BIN_ALPHA, rgba } from "./style";
import { TimeSlider, PRESENT_YEAR, isPresent } from "./TimeSlider";

type Sel =
  | { kind: "language"; index: number }
  | { kind: "country"; code: string }
  | { kind: "neutral"; id: string }
  | null;

type LoadState = "loading" | "missing" | "error" | "ready";

interface BundleState {
  glottocode: string;
  status: "ok" | "error";
  bundle: Bundle | null;
  join: Join | null;
}

/**
 * A cold dev server can answer a dynamic import with 504 Outdated Optimize Dep once, while Vite
 * re-bundles dependencies. A short retry makes that invisible. A production build never needs it.
 */
async function importWithRetry<T>(load: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await load();
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * i));
    }
  }
}

const EMPTY_FILLS: Join = { fills: new Map(), unmatched: [] };

export default function MapSpike() {
  const locale = useLocale();
  const theme = useResolvedTheme();
  const reduced = usePrefersReducedMotion();
  const regionName = useRegionName();

  const [load, setLoad] = useState<LoadState>("loading");
  const [data, setData] = useState<LoadedData | null>(null);
  const [controller, setController] = useState<MapController | null>(null);
  const [glFailed, setGlFailed] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const [sel, setSel] = useState<Sel>(null);
  const [bundleState, setBundleState] = useState<BundleState | null>(null);
  const [showDialects, setShowDialects] = useState(
    () => new URLSearchParams(window.location.search).get("dialects") === "1",
  );
  const [familyFilter, setFamilyFilter] = useState<number | null>(null);
  const [year, setYear] = useState(PRESENT_YEAR);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState("");

  const container = useRef<HTMLDivElement>(null);
  const bundleCache = useRef(new Map<string, Bundle>());
  const onHit = useRef<(hit: Hit | null) => void>(() => {});
  const mountedAt = useRef(0);
  const ids = { list: useId(), search: useId(), country: useId() };

  /* ----------------------------------------------------------- load data */

  useEffect(() => {
    mountedAt.current = performance.now();
    const ac = new AbortController();
    loadAll(ac.signal).then(
      (d) => {
        setData(d);
        setLoad("ready");
      },
      (error: unknown) => {
        if (ac.signal.aborted) return;
        setLoad(error instanceof DataMissingError ? "missing" : "error");
      },
    );
    return () => ac.abort();
  }, []);

  const searchIndex = useMemo(() => (data ? buildSearchIndex(data.points) : []), [data]);

  /* ----------------------------------------------------------- map setup */

  useEffect(() => {
    if (!data || !container.current) return;
    let cancelled = false;
    let created: MapController | null = null;
    const el = container.current;
    void (async () => {
      try {
        const { MapController } = await importWithRetry(() => import("./controller"));
        const c = await MapController.create({
          container: el,
          theme: currentTheme(),
          geo: data.geo,
          points: data.points,
          showDialects: new URLSearchParams(window.location.search).get("dialects") === "1",
          reducedMotion: prefersReducedMotion(),
          mapTitle: S.mapLabel,
          onHit: (hit) => onHit.current(hit),
        });
        if (cancelled) {
          c.destroy();
          return;
        }
        created = c;
        setController(c);
        await c.settled();
        if (cancelled) return;
        setMapReady(true);
        const firstFrameMs = performance.now() - mountedAt.current;
        if (wantsBench(window.location.search)) attachBench(c.benchImpl(data.loadMs, () => firstFrameMs));
      } catch {
        if (!cancelled) setGlFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      created?.destroy();
    };
  }, [data]);

  useEffect(() => controller?.applyTheme(theme), [controller, theme]);
  useEffect(() => controller?.setShowDialects(showDialects), [controller, showDialects]);
  useEffect(() => controller?.setFamilyFilter(familyFilter), [controller, familyFilter]);
  useEffect(() => controller?.setDim(!isPresent(year)), [controller, year]);

  /* ----------------------------------------------------------- selection */

  const familyOfIndex = useCallback(
    (index: number) => data?.points.family[index] ?? FAMILY_ORDER.length - 1,
    [data],
  );

  const selectLanguage = useCallback(
    (index: number, fly = true) => {
      if (!data) return;
      controller?.setSelectedCountry(null);
      controller?.setSelectedPoint(index);
      controller?.setChoropleth(EMPTY_FILLS.fills, familyOfIndex(index));
      if (fly) controller?.focusPoint(index);
      setSel({ kind: "language", index });
      const name = displayName(data.points.glottocodes[index]!, data.points.names[index]!);
      setAnnounce(`Selected ${name}. Details are in the side panel.`);
    },
    [controller, data, familyOfIndex],
  );

  const selectCountry = useCallback(
    (code: string, fly = true) => {
      const info = data?.geo.byCode.get(code);
      if (!data || !info) return;
      controller?.setSelectedPoint(null);
      controller?.setChoropleth(EMPTY_FILLS.fills, null);
      controller?.setSelectedCountry(code);
      if (fly && info.shape) controller?.focusBox(info.shape.bbox);
      setSel({ kind: "country", code });
      setAnnounce(`Selected ${regionName(code, info.name).text}. Details are in the side panel.`);
    },
    [controller, data, regionName],
  );

  const selectNeutral = useCallback(
    (id: string, fly = true) => {
      const info = data?.geo.neutral.find((n) => n.id === id);
      if (!data || !info) return;
      controller?.setSelectedPoint(null);
      controller?.setChoropleth(EMPTY_FILLS.fills, null);
      controller?.setSelectedCountry(null);
      if (fly && info.shape) controller?.focusBox(info.shape.bbox);
      setSel({ kind: "neutral", id });
      setAnnounce(`Selected ${info.name}, a disputed or breakaway area. Details are in the side panel.`);
    },
    [controller, data],
  );

  useEffect(() => {
    onHit.current = (hit) => {
      if (!hit) return;
      if (hit.kind === "language") selectLanguage(hit.index, false);
      else if (hit.kind === "country") selectCountry(hit.code, false);
      else selectNeutral(hit.id, false);
    };
  }, [selectLanguage, selectCountry, selectNeutral]);

  // Reduced motion: the controller reads this when it moves the camera.
  useEffect(() => controller?.setReducedMotion(reduced), [controller, reduced]);

  const selectedGlottocode = sel?.kind === "language" && data ? data.points.glottocodes[sel.index]! : null;

  useEffect(() => {
    if (!selectedGlottocode || !data || sel?.kind !== "language") return;
    const index = sel.index;
    const family = data.points.family[index]!;
    const cached = bundleCache.current.get(selectedGlottocode);
    let cancelled = false;
    const apply = (bundle: Bundle | null) => {
      if (cancelled) return;
      if (!bundle) {
        setBundleState({ glottocode: selectedGlottocode, status: "error", bundle: null, join: null });
        return;
      }
      const rows = bundle.territories.flatMap((b) => b.items);
      const join = joinChoropleth(rows, data.geo.drawableCodes);
      controller?.setChoropleth(join.fills, family);
      setBundleState({ glottocode: selectedGlottocode, status: "ok", bundle, join });
    };
    if (cached) {
      queueMicrotask(() => apply(cached));
    } else {
      fetchJson<Bundle>(DATA_URLS.bundle(selectedGlottocode)).then(
        (b) => {
          bundleCache.current.set(selectedGlottocode, b);
          apply(b);
        },
        () => apply(null),
      );
    }
    return () => {
      cancelled = true;
    };
  }, [selectedGlottocode, sel, data, controller]);

  /* ------------------------------------------------------------- search */

  const hits = useMemo(
    () => (data ? searchNames(searchIndex, data.points.levels, query) : []),
    [data, searchIndex, query],
  );

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(hits.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && open && hits[active]) {
      e.preventDefault();
      pick(hits[active]!.index);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const pick = (index: number) => {
    selectLanguage(index);
    setOpen(false);
    setQuery("");
  };

  /* ------------------------------------------------------------- lists */

  const dialectCount = useMemo(() => (data ? data.points.levels.reduce((n, l) => n + (l === 2 ? 1 : 0), 0) : 0), [data]);

  const countryOptions = useMemo(() => {
    if (!data) return [];
    const collator = new Intl.Collator(locale);
    return [...data.geo.byCode.values()]
      .map((c) => ({ code: c.code, label: regionName(c.code, c.name).text }))
      .sort((a, b) => collator.compare(a.label, b.label));
  }, [data, locale, regionName]);

  const neutralOptions = useMemo(() => {
    if (!data) return [];
    return [...data.geo.neutral].sort((a, b) => a.name.localeCompare(b.name, "en"));
  }, [data]);

  const onCountryChange = (value: string) => {
    if (value.startsWith("c:")) selectCountry(value.slice(2));
    else if (value.startsWith("d:") || value.startsWith("n:")) selectNeutral(value);
  };
  const countryValue =
    sel?.kind === "country" ? `c:${sel.code}` : sel?.kind === "neutral" ? sel.id : "";

  /* -------------------------------------------------------------- render */

  if (load === "missing" || load === "error") {
    return (
      <div className="flex-1 px-gutter py-10">
        <div role="status" className="max-w-xl rounded-lg border border-line-strong bg-surface p-5 shadow-raised">
          <Txt as="p" className="font-display text-title-sm">
            {load === "missing" ? S.missing : "The map data could not be read."}
          </Txt>
          <Txt as="p" className="mt-2 text-ink-muted">
            {load === "missing" ? S.missingHelp : "Run uv run pipeline validate to check the build."}
          </Txt>
        </div>
      </div>
    );
  }

  const selectionPanel = () => {
    if (!data || !sel) return <EmptyPanel />;
    if (sel.kind === "language") {
      const code = data.points.glottocodes[sel.index]!;
      const glottologName = data.points.names[sel.index]!;
      const fam = FAMILY_ORDER[data.points.family[sel.index]!]!;
      const current = bundleState?.glottocode === code ? bundleState : null;
      return (
        <LanguagePanel
          glottocode={code}
          name={displayName(code, glottologName)}
          glottologName={glottologName}
          level={["family", "language", "dialect"][data.points.levels[sel.index]!] ?? "language"}
          familyName={current?.bundle?.lineage[0]?.name ?? familyById[fam].name}
          lon={data.points.lonlat[2 * sel.index]!}
          lat={data.points.lonlat[2 * sel.index + 1]!}
          state={current ? current.status : "loading"}
          bundle={current?.bundle ?? null}
          join={current?.join ?? null}
          countryName={(c) => regionName(c, data.geo.byCode.get(c)?.name)}
          isPickable={(c) => data.geo.byCode.has(c)}
          onPickCountry={(c) => selectCountry(c)}
        />
      );
    }
    if (sel.kind === "country") {
      const info = data.geo.byCode.get(sel.code)!;
      return (
        <CountryPanel
          info={info}
          name={regionName(info.code, info.name)}
          index={data.territoryIndex}
          languageName={(g) => {
            const i = data.points.index.get(g);
            return i === undefined ? null : displayName(g, data.points.names[i]!);
          }}
          onPickLanguage={(g) => {
            const i = data.points.index.get(g);
            if (i !== undefined) selectLanguage(i);
          }}
        />
      );
    }
    const info = data.geo.neutral.find((n) => n.id === sel.id);
    return info ? <NeutralPanel info={info} /> : <EmptyPanel />;
  };

  const fillFamily =
    sel?.kind === "language" && data ? FAMILY_ORDER[data.points.family[sel.index]!]! : null;
  const showFillLegend =
    fillFamily !== null && bundleState?.glottocode === selectedGlottocode && (bundleState?.join?.fills.size ?? 0) > 0;
  const field =
    "min-h-target rounded-md border border-line-strong bg-surface px-3 text-body text-ink placeholder:text-ink-muted";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-line px-gutter py-3">
          <div className="relative min-w-56 flex-1">
            <label htmlFor={ids.search} className="block text-small font-semibold">
              <Txt>{S.searchLabel}</Txt>
            </label>
            <input
              id={ids.search}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-expanded={open && hits.length > 0}
              aria-controls={ids.list}
              aria-autocomplete="list"
              aria-activedescendant={open && hits[active] ? `${ids.list}-${active}` : undefined}
              aria-describedby={`${ids.search}-help`}
              value={query}
              disabled={!data}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onKeyDown={onSearchKey}
              onBlur={() => setOpen(false)}
              onFocus={() => setOpen(query.length > 1)}
              className={`${field} mt-1 w-full`}
              lang="en"
              dir="auto"
            />
            <span id={`${ids.search}-help`} className="sr-only">
              {S.searchHelp}
            </span>
            <ul
              id={ids.list}
              role="listbox"
              aria-label={S.searchLabel}
              hidden={!(open && query.trim().length > 1)}
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-line-strong bg-raised shadow-overlay"
            >
              {hits.map((h, i) => {
                const code = data!.points.glottocodes[h.index]!;
                const dialect = data!.points.levels[h.index] === 2;
                return (
                  <li
                    key={h.index}
                    id={`${ids.list}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(h.index);
                    }}
                    className={`flex min-h-target cursor-pointer items-center justify-between gap-3 px-3 py-1 ${
                      i === active ? "bg-surface outline-2 -outline-offset-2 outline-focus" : ""
                    }`}
                  >
                    <span lang="en" dir="ltr">{displayName(code, data!.points.names[h.index]!)}</span>
                    <span lang="en" dir="ltr" className="text-caption text-ink-muted">
                      {dialect ? "dialect, " : ""}
                      {code}
                    </span>
                  </li>
                );
              })}
              {hits.length === 0 && (
                <li role="option" aria-selected="false" aria-disabled="true" className="min-h-target px-3 py-2 text-ink-muted">
                  <Txt>{S.searchNone}</Txt>
                </li>
              )}
            </ul>
          </div>

          <div>
            <label htmlFor={ids.country} className="block text-small font-semibold">
              <Txt>{S.countryLabel}</Txt>
            </label>
            <select
              id={ids.country}
              value={countryValue}
              disabled={!data}
              onChange={(e) => onCountryChange(e.target.value)}
              className={`${field} mt-1 w-full min-w-56`}
            >
              <option value="" disabled>
                {S.countryNone}
              </option>
              <optgroup label={S.countryGroup}>
                {countryOptions.map((c) => (
                  <option key={c.code} value={`c:${c.code}`}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label={S.neutralGroup}>
                {neutralOptions.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <label className="inline-flex min-h-target cursor-pointer items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={showDialects}
              onChange={(e) => setShowDialects(e.target.checked)}
              className="size-5 accent-link"
            />
            <Txt>
              {S.showDialects}
              {data ? ` (${dialectCount.toLocaleString("en")})` : ""}
            </Txt>
          </label>
        </div>

        <div className="relative min-h-[24rem] flex-1 lg:min-h-0">
          <div
            ref={container}
            role="region"
            aria-label={S.mapLabel}
            lang="en"
            dir="ltr"
            data-testid="map"
            data-ready={mapReady ? "true" : "false"}
            // Inline, because maplibre-gl.css (unlayered) sets position: relative on .maplibregl-map.
            style={{ position: "absolute", inset: 0 }}
          />
          {showFillLegend && (
            <section
              aria-label={S.fillTitle}
              className="pointer-events-none absolute bottom-3 start-3 max-w-[16rem] rounded-md border border-line-strong bg-surface/95 p-3 shadow-raised"
            >
              <Txt as="h3" className="text-caption font-semibold">
                {S.fillTitle}
              </Txt>
              <ul className="mt-1">
                {BIN_LABELS.map((label, i) => (
                  <li key={label} className="flex items-center gap-2 text-caption">
                    <span
                      aria-hidden="true"
                      className="inline-block size-4 shrink-0 rounded-xs border border-line-strong"
                      style={{ background: rgba(familyColor(fillFamily!, theme).hex, BIN_ALPHA[i]!) }}
                    />
                    <Txt>{label}</Txt>
                  </li>
                ))}
              </ul>
              <Txt as="p" className="mt-1 text-caption text-ink-muted">
                {S.fillHelp}
              </Txt>
            </section>
          )}
          {(!mapReady || glFailed) && (
            <div
              role="status"
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/60 p-6 text-center"
            >
              <Txt as="p" className="rounded-md bg-surface px-4 py-2 shadow-raised">
                {glFailed ? S.noWebgl : S.loading}
              </Txt>
            </div>
          )}
        </div>

        <TimeSlider year={year} onChange={setYear} />

        <div className="border-t border-line px-gutter py-2">
          <Txt as="p" className="text-small" data-testid="borders-note">
            {BORDERS_NOTE}
          </Txt>
          <Txt as="p" className="mt-1 text-caption text-ink-muted">
            {S.attribution}
          </Txt>
        </div>
      </div>

      <aside
        aria-labelledby={`${ids.list}-panel`}
        className="w-full border-t border-line bg-surface lg:w-[26rem] lg:overflow-y-auto lg:border-t-0 lg:border-s"
      >
        <div className="px-gutter py-4 lg:px-5">
          <Txt as="h2" id={`${ids.list}-panel`} className="sr-only">
            {S.panelTitle}
          </Txt>
          <div role="status" className="sr-only">
            {announce}
          </div>

          <div data-testid="selection">{selectionPanel()}</div>

          <section aria-labelledby={`${ids.list}-legend`} className="mt-6 border-t border-line pt-4">
            <Txt as="h3" id={`${ids.list}-legend`} className="text-small font-semibold">
              {S.legendTitle}
            </Txt>
            <Txt as="p" className="mt-1 text-caption text-ink-muted">
              {S.legendHelp}
            </Txt>
            <ul className="mt-2 flex flex-wrap gap-2">
              {FAMILY_ORDER.map((id, i) => {
                const fam = familyById[id];
                const pressed = familyFilter === i;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => setFamilyFilter(pressed ? null : i)}
                      className="inline-flex min-h-target items-center gap-2 rounded-md border border-line-strong px-2 text-caption hover:bg-raised aria-pressed:bg-raised aria-pressed:outline-2 aria-pressed:-outline-offset-2 aria-pressed:outline-focus"
                    >
                      <FamilyMarker marker={fam.marker} color={familyColor(id, theme).hex} size={16} />
                      <Txt>{id === "other" ? S.legendOther : fam.name}</Txt>
                      <span className="text-ink-muted" lang="en" dir="ltr">
                        {fam.abbr}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 inline-flex items-center gap-2 text-caption">
              <svg aria-hidden="true" width="24" height="16" className="shrink-0">
                <defs>
                  <pattern id={`${ids.list}-h`} width="8" height="8" patternUnits="userSpaceOnUse">
                    <path d="M-2 10L10 -2M6 10L18 -2M-10 10L2 -2" stroke="currentColor" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0.5" y="0.5" width="23" height="15" fill={`url(#${ids.list}-h)`} stroke="currentColor" strokeDasharray="3 2" />
              </svg>
              <Txt>{S.hatchLegend}</Txt>
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}
