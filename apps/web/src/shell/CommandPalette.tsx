// Global search (spec 7): an ARIA combobox inside a modal dialog. The engine and its documents load
// through dynamic imports, outside the app-shell chunk.

import type { ParseKeys } from "i18next";
import { Dialog } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import type { DocKind, Hit } from "@/search/engine";
import { shellStore, useShell } from "@/state/shell";
import type { Lens } from "@/state/url";

import { T, useT } from "./T";

type Service = typeof import("@/search/service");
type Engine = typeof import("@/search/engine");

let servicePromise: Promise<[Service, Engine]> | null = null;
export function loadSearch(): Promise<[Service, Engine]> {
  servicePromise ??= Promise.all([import("@/search/service"), import("@/search/engine")]);
  return servicePromise;
}

const GROUP_KEY: Record<DocKind, ParseKeys> = {
  language: "search.groupLanguages",
  macrolanguage: "search.groupMacro",
  family: "search.groupFamilies",
  country: "search.groupCountries",
  dialect: "search.groupDialects",
};
const PER_GROUP = 8;

export function CommandPalette() {
  const open = useShell((s) => s.paletteOpen);
  const query = useShell((s) => s.paletteQuery);
  const lens = useShell((s) => s.lens);
  const t = useT();
  const [mods, setMods] = useState<[Service, Engine] | null>(null);
  const [ready, setReady] = useState<{ t1: boolean; t2: boolean }>({ t1: false, t2: false });
  const [failed, setFailed] = useState(false);
  const [debounced, setDebounced] = useState(query);
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState<Set<DocKind>>(new Set());
  const [countText, setCountText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const picked = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const listId = useId();
  const titleId = useId();

  // Load tier 1 on idle after first paint (spec 7.1).
  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    };
    const idle = (cb: () => void) =>
      w.requestIdleCallback ? w.requestIdleCallback(cb, { timeout: 4000 }) : window.setTimeout(cb, 1500);
    idle(() => {
      void loadSearch()
        .then(async (m) => {
          setMods(m);
          await m[0].ensureTier1();
          setReady((r) => ({ ...r, t1: true }));
        })
        .catch(() => setFailed(true));
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    picked.current = false;
    void loadSearch()
      .then(async (m) => {
        setMods(m);
        await m[0].ensureTier1();
        setReady((r) => ({ ...r, t1: true }));
        await m[0].ensureTier2();
        setReady({ t1: true, t2: m[0].sources.tier2 !== "none" });
      })
      .catch(() => setFailed(true));
  }, [open]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(query);
      setActive(0);
      setExpanded(new Set());
    }, 80);
    return () => window.clearTimeout(id);
  }, [query]);

  const hits: Hit[] = useMemo(() => {
    if (!mods) return [];
    void ready;
    return mods[0].engine.search(debounced);
  }, [mods, debounced, ready]);

  const groups = useMemo(() => (mods ? mods[1].groupHits(hits) : []), [mods, hits]);
  const flat = useMemo(
    () => groups.flatMap((g) => (expanded.has(g.kind) ? g.hits : g.hits.slice(0, PER_GROUP))),
    [groups, expanded],
  );

  // "{n} results", 500 ms after typing stops.
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      if (!mods || !mods[1].queryIsLongEnough(debounced)) setCountText("");
      else setCountText(t("search.count", { count: hits.length }));
    }, 500);
    return () => window.clearTimeout(id);
  }, [hits, debounced, open, mods, t]);

  const pick = (h: Hit, otherLens: boolean) => {
    // A macrolanguage candidate opens the one Glottolog node the pipeline links it to (the
    // macrolanguage route comes later); countries are not offered until their route ships.
    const kind =
      h.doc.kind === "dialect" ? "language" : h.doc.kind === "macrolanguage" ? "family" : h.doc.kind;
    if (kind !== "language" && kind !== "family") return;
    picked.current = true;
    const s = shellStore.getState();
    const lensOpt: Lens | undefined = otherLens ? (lens === "tree" ? "map" : "tree") : undefined;
    s.closePalette();
    s.select({ kind, glottocode: h.doc.id }, { source: "search", lens: lensOpt });
    s.announce(
      `${t("search.button")}: ${h.doc.name}, ${t(`levelLower.${h.doc.kind === "family" ? "family" : h.doc.kind === "dialect" ? "dialect" : "language"}`)}.`,
    );
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const n = flat.length;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "PageDown" || e.key === "PageUp") {
      if (!n) return;
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : e.key === "PageDown" ? 5 : -5;
      setActive((a) => (Math.abs(step) === 1 ? (a + step + n) % n : Math.max(0, Math.min(n - 1, a + step))));
    } else if (e.key === "Enter") {
      const h = flat[active];
      if (h) {
        e.preventDefault();
        pick(h, e.altKey);
      }
    }
  };

  useEffect(() => {
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, listId]);

  const long = mods ? mods[1].queryIsLongEnough(debounced) : debounced.trim().length >= 2;
  let index = -1;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => (o ? shellStore.getState().openPalette() : shellStore.getState().closePalette())}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--tt-scrim)]" />
        <Dialog.Content
          aria-labelledby={titleId}
          aria-describedby={undefined}
          className="tt-dialog fixed inset-x-3 top-[8dvh] z-50 mx-auto flex max-h-[80dvh] max-w-2xl flex-col overflow-hidden rounded-lg border border-line-strong bg-raised shadow-overlay"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            const prev = document.activeElement;
            opener.current =
              prev instanceof HTMLElement && prev !== document.body && !prev.closest('[role="dialog"]')
                ? prev
                : document.querySelector<HTMLElement>("[data-search-button]");
            inputRef.current?.focus();
            inputRef.current?.select();
          }}
          onCloseAutoFocus={(e) => {
            // Focus returns to the opener; after a pick it moves to the Inspector heading instead.
            e.preventDefault();
            if (!picked.current) opener.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (shellStore.getState().paletteQuery) {
              e.preventDefault();
              shellStore.getState().setPaletteQuery("");
            }
          }}
        >
          <Dialog.Title id={titleId} className="sr-only">
            {t("search.dialog")}
          </Dialog.Title>
          <div className="border-b border-line p-3">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={flat.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={flat[active] ? `${listId}-opt-${active}` : undefined}
              aria-label={t("search.dialog")}
              aria-describedby={`${listId}-help`}
              placeholder={t("search.placeholder")}
              autoComplete="off"
              spellCheck={false}
              dir="auto"
              value={query}
              onChange={(e) => shellStore.getState().setPaletteQuery(e.target.value)}
              onKeyDown={onKey}
              className="min-h-target w-full rounded-md border border-line-strong bg-surface px-3 text-body text-ink placeholder:text-ink-muted"
            />
            <p id={`${listId}-help`} className="mt-1 text-caption text-ink-muted">
              <T k="search.help" /> <T k="search.keys" />
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {failed ? (
              <div role="alert" className="p-3">
                <T as="p" k="search.error" />
                <button
                  type="button"
                  className="tt-button mt-2"
                  onClick={() => {
                    servicePromise = null;
                    setFailed(false);
                    shellStore.getState().closePalette();
                    shellStore.getState().openPalette();
                  }}
                >
                  <T k="search.retry" />
                </button>
              </div>
            ) : !long ? (
              <T as="p" k="search.minChars" className="p-3 text-small text-ink-muted" />
            ) : !ready.t1 ? (
              <T as="p" k="search.loading" className="p-3 text-small text-ink-muted" />
            ) : (
              <>
                <div id={listId} role="listbox" aria-label={t("search.dialog")} hidden={!groups.length}>
                  {groups.map((g) => {
                    const shown = expanded.has(g.kind) ? g.hits : g.hits.slice(0, PER_GROUP);
                    const gid = `${listId}-g-${g.kind}`;
                    return (
                      <div key={g.kind} role="group" aria-labelledby={gid} className="mb-2">
                        <T
                          as="div"
                          role="presentation"
                          id={gid}
                          k={GROUP_KEY[g.kind]}
                          className="px-2 py-1 text-caption font-semibold uppercase tracking-wide text-ink-muted"
                        />
                        {shown.map((h) => {
                          index++;
                          const i = index;
                          return (
                            <ResultRow
                              key={`${h.doc.kind}:${h.doc.id}:${h.doc.name}`}
                              id={`${listId}-opt-${i}`}
                              hit={h}
                              path={mods![0].engine.pathOf(h.doc)}
                              active={i === active}
                              query={debounced}
                              onPick={(alt) => pick(h, alt)}
                              onHover={() => setActive(i)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                {/* "Show all" buttons sit outside the listbox, which may own only groups and options. */}
                <div className="flex flex-wrap gap-2 px-1">
                  {groups
                    .filter((g) => g.hits.length > PER_GROUP && !expanded.has(g.kind))
                    .map((g) => (
                      <button
                        key={g.kind}
                        type="button"
                        className="tt-button tt-button-quiet"
                        onClick={() => setExpanded((x) => new Set([...x, g.kind]))}
                      >
                        <T k={GROUP_KEY[g.kind]} />: <T k="search.showAll" o={{ count: g.hits.length }} />
                      </button>
                    ))}
                </div>
                {!groups.length && (
                  <div className="p-3">
                    <T as="p" k="search.none" o={{ query: debounced }} className="font-semibold" />
                    <T as="p" k="search.noneNext" className="mt-1 text-small text-ink-muted" />
                  </div>
                )}
                {!ready.t2 && (
                  <T as="p" k="search.loadingAll" className="px-2 py-1 text-caption text-ink-muted" />
                )}
              </>
            )}
          </div>
          <div role="status" aria-live="polite" className="sr-only" data-testid="palette-count">
            {countText}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLowerCase();
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <strong>{text.slice(i, i + q.length)}</strong>
      {text.slice(i + q.length)}
    </>
  );
}

function ResultRow({
  id,
  hit,
  path,
  active,
  query,
  onPick,
  onHover,
}: {
  id: string;
  hit: Hit;
  path: string | null;
  active: boolean;
  query: string;
  onPick: (alt: boolean) => void;
  onHover: () => void;
}) {
  const t = useT();
  const d = hit.doc;
  const r = hit.reason;
  const reason =
    r.kind === "alias"
      ? t("search.matchAlias", { alias: r.text })
      : r.kind === "iso"
        ? t("search.matchIso", { code: r.code })
        : r.kind === "glottocode"
          ? t("search.matchGlottocode", { code: r.code })
          : r.kind === "otherName"
            ? t("search.matchName", { name: r.text })
            : null;
  const level =
    d.kind === "family"
      ? "family"
      : d.kind === "dialect"
        ? "dialect"
        : d.kind === "macrolanguage"
          ? "macrolanguage"
          : d.kind === "country"
            ? "country"
            : "language";
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onPick(e.altKey);
      }}
      onMouseMove={onHover}
      className={`flex min-h-target cursor-pointer flex-col justify-center rounded-md px-2 py-1 ${active ? "bg-surface outline-2 -outline-offset-2 outline-focus" : ""}`}
      data-result={d.id}
    >
      <span className="flex items-baseline gap-2">
        <bdi className="font-semibold">
          <Highlight text={d.name} query={query} />
        </bdi>
        {d.endonym && d.endonym.text !== d.name && (
          <bdi lang={d.endonym.lang ?? undefined} className="text-small">
            {d.endonym.text}
          </bdi>
        )}
        <T k={`level.${level}` as ParseKeys} className="ms-auto text-caption text-ink-muted" />
      </span>
      {(path || reason || !d.drawn) && (
        <span className="flex flex-wrap gap-x-3 text-caption text-ink-muted">
          {path && <bdi>{path}</bdi>}
          {reason && <span>{reason}</span>}
          {!d.drawn && <T k="search.notInTree" />}
        </span>
      )}
    </div>
  );
}
