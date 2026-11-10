// The shell store (docs/specs/app-shell.md section 3). URL-backed fields flow one way: an action
// builds the next URL and navigates; <UrlSync> hears the location change and calls hydrateFromUrl.
//
// One exception, by design: settled cameras. They are written with history.replaceState through
// this module only (debounced, section 3.3), and the store is updated in the same call. A router
// navigation per camera write would rerun route loaders and could be cancelled by the push that
// follows a flush, which would lose the camera that Back must restore.

import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { Locale } from "@/i18n/direction";

import {
  DEFAULT_STATE,
  defaultTab,
  isDefaultTreeCamera,
  sameSelection,
  selectionPath,
  toShellHref,
  type DevFlags,
  type Lens,
  type LumpGroup,
  type MapCamera,
  type Selection,
  type Tab,
  type TreeCamera,
  type UrlState,
} from "./url";

export type SheetStop = "peek" | "half" | "full";
export type HydrateCause = "load" | "push" | "replace" | "pop";
export type SelectSource = "canvas" | "search" | "deeper" | "crumb" | "list" | "other";

export interface SessionState {
  inspectorCollapsed: boolean;
  sheetStop: SheetStop;
  paletteOpen: boolean;
  paletteQuery: string;
  treeCursor: string | null;
  flight: { lens: Lens; running: boolean } | null;
  mounted: { tree: boolean; map: boolean };
  announcement: { text: string; id: number };
  helpOpen: boolean;
  /** Bumped when cameras come from the URL (load, back, forward): lenses then apply them. */
  cameraRestore: number;
  /** Where the last selection came from (focus rules, section 9.3). */
  lastSelectSource: SelectSource;
  /** Path of a selection whose Inspector heading should take focus once it renders (search, Go deeper). */
  pendingFocus: string | null;
  flags: DevFlags;
  hydrated: boolean;
}

export interface Navigator {
  (href: string, opts: { replace: boolean }): void;
}

export interface ShellActions {
  select(sel: Selection, opts?: { tab?: Tab; lens?: Lens; source?: SelectSource }): void;
  setLens(lens: Lens): void;
  setTab(tab: Tab): void;
  setLumped(group: LumpGroup, lumped: boolean): void;
  setMapDialects(on: boolean): void;
  setLocale(locale: Locale): void;
  commitCamera(lens: Lens, cam: TreeCamera | MapCamera | null): void;
  flushCamera(): void;
  hydrateFromUrl(next: UrlState, cause: HydrateCause, flags?: DevFlags): void;
  setSheetStop(stop: SheetStop): void;
  toggleInspector(): void;
  openPalette(query?: string): void;
  closePalette(): void;
  setPaletteQuery(q: string): void;
  setHelpOpen(open: boolean): void;
  setTreeCursor(g: string | null): void;
  consumeFocus(path: string): boolean;
  setFlight(lens: Lens, running: boolean): void;
  markMounted(lens: Lens): void;
  announce(text: string): void;
  /** Bind the router's navigate (UrlSync) and the history writer (tests replace it). */
  bind(nav: Navigator, history?: HistoryWriter): void;
}

export interface HistoryWriter {
  replaceUrl(href: string): void;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(t: unknown): void;
}

export type ShellStore = UrlState & SessionState & ShellActions;

export const CAMERA_DEBOUNCE_MS = 400;
export const CAMERA_MIN_INTERVAL_MS = 1000;

const browserHistory: HistoryWriter = {
  replaceUrl(href) {
    // Keep React Router's own history state (key and index), so Back still works.
    window.history.replaceState(window.history.state, "", href);
  },
  now: () => performance.now(),
  setTimer: (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (t) => window.clearTimeout(t as number),
};

export function urlStateOf(s: UrlState): UrlState {
  return {
    selection: s.selection,
    lens: s.lens,
    tab: s.tab,
    lumped: s.lumped,
    classification: s.classification,
    year: s.year,
    area: s.area,
    mapDialects: s.mapDialects,
    treeCamera: s.treeCamera,
    mapCamera: s.mapCamera,
    locale: s.locale,
  };
}

export function createShellStore(): StoreApi<ShellStore> {
  let navigate: Navigator | null = null;
  let history: HistoryWriter | null = null;
  let pending: { tree?: TreeCamera | null; map?: MapCamera | null } | null = null;
  let timer: unknown = null;
  let lastWrite = -Infinity;
  let announceId = 0;
  /** The href of a navigation that has not reached the store yet (route loaders can take a moment). */
  let inFlight: string | null = null;

  return createStore<ShellStore>()((set, get) => {
    const go = (next: UrlState, replace: boolean) => {
      const href = toShellHref(next, get().flags);
      inFlight = href;
      if (navigate) navigate(href, { replace });
    };

    const writeCameras = () => {
      timer = null;
      if (!pending || !history) return;
      const s = get();
      if (s.flight?.running) {
        timer = history.setTimer(writeCameras, CAMERA_DEBOUNCE_MS);
        return;
      }
      const next = { ...urlStateOf(s) };
      if ("tree" in pending) next.treeCamera = pending.tree ?? null;
      if ("map" in pending) next.mapCamera = pending.map ?? null;
      pending = null;
      lastWrite = history.now();
      set({ treeCamera: next.treeCamera, mapCamera: next.mapCamera });
      history.replaceUrl(toShellHref(next, s.flags));
    };

    const flush = () => {
      if (!pending) return;
      if (timer !== null && history) history.clearTimer(timer);
      writeCameras();
    };

    return {
      ...DEFAULT_STATE,
      inspectorCollapsed: false,
      sheetStop: "peek",
      paletteOpen: false,
      paletteQuery: "",
      treeCursor: null,
      flight: null,
      mounted: { tree: false, map: false },
      announcement: { text: "", id: 0 },
      helpOpen: false,
      cameraRestore: 0,
      lastSelectSource: "other",
      pendingFocus: null,
      flags: {},
      hydrated: false,

      bind(nav, h = browserHistory) {
        navigate = nav;
        history = h;
      },

      select(sel, opts = {}) {
        flush();
        const s = get();
        const lens = opts.lens ?? s.lens;
        const tab = opts.tab ?? defaultTab(sel);
        const source = opts.source ?? "other";
        const sheetStop =
          (source === "search" || source === "deeper") && s.sheetStop === "peek" ? "half" : s.sheetStop;
        set({
          lastSelectSource: source,
          sheetStop,
          pendingFocus: source === "search" || source === "deeper" ? selectionPath(sel) : s.pendingFocus,
        });
        const target = toShellHref(
          { ...urlStateOf(s), selection: sel, lens, tab, area: null, treeCamera: null, mapCamera: null },
          s.flags,
        );
        if (
          inFlight ? inFlight === target : sameSelection(sel, s.selection) && lens === s.lens && tab === s.tab
        )
          return;
        // A new selection gets a fresh fit: no camera params.
        go(
          { ...urlStateOf(s), selection: sel, lens, tab, area: null, treeCamera: null, mapCamera: null },
          false,
        );
      },

      setLens(lens) {
        const s = get();
        if (lens === s.lens) return;
        flush();
        go({ ...urlStateOf(get()), lens }, false);
      },

      setTab(tab) {
        const s = get();
        if (tab === s.tab) return;
        go({ ...urlStateOf(s), tab }, true);
      },

      setLumped(code, lumped) {
        flush();
        const s = get();
        const set_ = new Set(s.lumped);
        if (lumped) set_.add(code);
        else set_.delete(code);
        go({ ...urlStateOf(get()), lumped: [...set_].sort() }, false);
      },

      setMapDialects(on) {
        go({ ...urlStateOf(get()), mapDialects: on }, true);
      },

      setLocale(locale) {
        go({ ...urlStateOf(get()), locale }, true);
      },

      commitCamera(lens, cam) {
        if (!history) return;
        const value = lens === "tree" && isDefaultTreeCamera(cam as TreeCamera | null) ? null : cam;
        pending = { ...pending, [lens]: value } as typeof pending;
        if (timer !== null) history.clearTimer(timer);
        const now = history.now();
        const wait = Math.max(CAMERA_DEBOUNCE_MS, lastWrite + CAMERA_MIN_INTERVAL_MS - now);
        timer = history.setTimer(writeCameras, wait);
      },

      flushCamera: flush,

      hydrateFromUrl(next, cause, flags) {
        const s = get();
        inFlight = null;
        const restore = cause === "load" || cause === "pop";
        if (restore && pending) {
          // A pending camera belongs to the entry we just left; drop it.
          if (timer !== null && history) history.clearTimer(timer);
          pending = null;
          timer = null;
        }
        set({
          ...next,
          flags: flags ?? s.flags,
          hydrated: true,
          cameraRestore: restore ? s.cameraRestore + 1 : s.cameraRestore,
        });
      },

      setSheetStop(stop) {
        set({ sheetStop: stop });
      },
      toggleInspector() {
        set({ inspectorCollapsed: !get().inspectorCollapsed });
      },
      openPalette(query) {
        set({ paletteOpen: true, paletteQuery: query ?? get().paletteQuery });
      },
      closePalette() {
        set({ paletteOpen: false });
      },
      setPaletteQuery(q) {
        set({ paletteQuery: q });
      },
      setHelpOpen(open) {
        set({ helpOpen: open });
      },
      consumeFocus(path) {
        if (get().pendingFocus !== path) return false;
        set({ pendingFocus: null });
        return true;
      },
      setTreeCursor(g) {
        set({ treeCursor: g });
      },
      setFlight(lens, running) {
        set({ flight: { lens, running } });
      },
      markMounted(lens) {
        const m = get().mounted;
        if (!m[lens]) set({ mounted: { ...m, [lens]: true } });
      },
      announce(text) {
        announceId += 1;
        set({ announcement: { text, id: announceId } });
      },
    };
  });
}

export const shellStore = createShellStore();

export function useShell<T>(selector: (s: ShellStore) => T): T {
  return useStore(shellStore, selector);
}
