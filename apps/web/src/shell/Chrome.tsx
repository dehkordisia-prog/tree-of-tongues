// Shell chrome: skip links, top bar (wordmark, search button, lens switcher, settings), breadcrumbs,
// time strip, footer strip, live region and the keyboard help dialog.

import { Dialog, Popover } from "radix-ui";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useMatches } from "react-router";

import type { Crumb, EntityData } from "@/data/entity";
import { ThemeToggle } from "@/design/ThemeToggle";
import { LOCALE_ENDONYMS, LOCALES, type Locale } from "@/i18n/direction";
import { shellStore, useShell } from "@/state/shell";
import { useShellHref } from "@/state/useShellHref";
import type { Lens } from "@/state/url";

import { CANVAS_ID } from "./Canvas";
import { INSPECTOR_HEADING_ID } from "./inspector/parts";
import { useTx } from "@/i18n/useTx";

import { Icon, isApple, T, useT } from "./T";

/* ---------------------------------------------------------- skip links */

function focusCanvas() {
  const lens = shellStore.getState().lens;
  const el =
    document.querySelector<HTMLElement>(`[data-lens="${lens}"] [data-lens-canvas="tree"]`) ??
    document.querySelector<HTMLElement>(`[data-lens="${lens}"] .maplibregl-canvas`) ??
    document.getElementById(CANVAS_ID);
  el?.focus();
}

export function SkipLinks() {
  return (
    <div className="tt-skip-links">
      <a
        href={`#${INSPECTOR_HEADING_ID}`}
        className="tt-skip"
        onClick={(e) => {
          e.preventDefault();
          if (shellStore.getState().inspectorCollapsed) shellStore.getState().toggleInspector();
          requestAnimationFrame(() => document.getElementById(INSPECTOR_HEADING_ID)?.focus());
        }}
      >
        <T k="shell.skipToDetails" />
      </a>
      <a
        href={`#${CANVAS_ID}`}
        className="tt-skip"
        onClick={(e) => {
          e.preventDefault();
          focusCanvas();
        }}
      >
        <T k="shell.skipToCanvas" />
      </a>
    </div>
  );
}

/* -------------------------------------------------------------- top bar */

const subscribeNothing = () => () => {};

export function TopBar() {
  const t = useT();
  const href = useShellHref();
  const apple = useSyncExternalStore(subscribeNothing, isApple, () => false);
  return (
    <header className="tt-topbar flex h-14 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-4 sm:px-4">
      <Link
        to={href(null)}
        className="inline-flex min-h-target min-w-target shrink-0 items-center gap-2 font-display text-title-sm text-ink no-underline"
        aria-label={t("shell.home")}
      >
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="9" cy="10" r="4" />
          <circle cx="16" cy="15" r="3" />
        </svg>
        <span className="hidden md:inline">{t("app.title")}</span>
      </Link>
      <button
        type="button"
        data-search-button=""
        onClick={() => shellStore.getState().openPalette()}
        className="inline-flex min-h-target min-w-target flex-1 items-center gap-2 rounded-pill border border-line-strong bg-raised px-3 text-small text-ink-muted hover:text-ink sm:max-w-md"
        aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      >
        <Icon name="search" />
        <T k="search.button" className="sm:hidden" />
        <T k="search.buttonLong" className="hidden truncate sm:inline" />
        <kbd
          className="ms-auto hidden rounded-xs border border-line px-1.5 text-caption sm:[@media(pointer:fine)]:inline"
          dir="ltr"
        >
          {t(apple ? "search.shortcutMac" : "search.shortcut")}
        </kbd>
      </button>
      <LensSwitcher />
      <SettingsMenu />
    </header>
  );
}

function LensSwitcher() {
  const lens = useShell((s) => s.lens);
  const name = useId();
  const t = useT();
  const set = (l: Lens) => {
    shellStore.getState().setLens(l);
    shellStore.getState().announce(t(l === "tree" ? "lens.announceTree" : "lens.announceMap"));
  };
  return (
    <fieldset className="ms-auto shrink-0">
      <legend className="sr-only">{t("lens.label")}</legend>
      <div className="inline-flex rounded-pill border border-line-strong bg-canvas p-0.5">
        {(["tree", "map"] as const).map((l) => (
          <label
            key={l}
            className="relative inline-flex min-h-target min-w-target cursor-pointer items-center justify-center gap-1.5 rounded-pill px-3 text-small text-ink-muted has-checked:bg-raised has-checked:text-ink has-checked:shadow-raised has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name={name}
              value={l}
              checked={lens === l}
              onChange={() => set(l)}
              className="sr-only"
            />
            <Icon name={l} />
            <T k={`lens.${l}`} className="max-[359px]:sr-only" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const MOTION_KEY = "tt-motion";

function readMotion(): "system" | "reduce" {
  try {
    return localStorage.getItem(MOTION_KEY) === "reduce" ? "reduce" : "system";
  } catch {
    return "system";
  }
}

const motionListeners = new Set<() => void>();

function writeMotion(m: "system" | "reduce") {
  try {
    if (m === "reduce") localStorage.setItem(MOTION_KEY, "reduce");
    else localStorage.removeItem(MOTION_KEY);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  applyMotion(m);
  motionListeners.forEach((l) => l());
}

function applyMotion(m: "system" | "reduce") {
  if (m === "reduce") document.documentElement.dataset.motion = "reduce";
  else delete document.documentElement.dataset.motion;
}

function useMotionPref(): "system" | "reduce" {
  return useSyncExternalStore(
    (cb) => {
      motionListeners.add(cb);
      return () => motionListeners.delete(cb);
    },
    readMotion,
    () => "system",
  );
}

function SettingsMenu() {
  const t = useT();
  const locale = useShell((s) => s.locale);
  const motion = useMotionPref();
  const langName = useId();
  const motionName = useId();
  useEffect(() => applyMotion(readMotion()), []);
  const pickMotion = writeMotion;
  const radio = "inline-flex min-h-target cursor-pointer items-center gap-2 px-1";
  return (
    <Popover.Root>
      <Popover.Trigger className="tt-icon-button shrink-0" aria-label={t("settings.button")}>
        <Icon name="settings" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="tt-popover z-50 grid w-[min(92vw,22rem)] gap-4 rounded-md border border-line-strong bg-raised p-4 shadow-overlay"
        >
          <ThemeToggle />
          <fieldset>
            <T as="legend" k="settings.language" className="text-small font-semibold" />
            {LOCALES.map((l: Locale) => (
              <label key={l} className={radio}>
                <input
                  type="radio"
                  name={langName}
                  checked={locale === l}
                  onChange={() => shellStore.getState().setLocale(l)}
                  className="size-5 accent-link"
                />
                <span lang={l} dir={l === "fa" ? "rtl" : "ltr"}>
                  {LOCALE_ENDONYMS[l]}
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset>
            <T as="legend" k="settings.motion" className="text-small font-semibold" />
            {(["system", "reduce"] as const).map((m) => (
              <label key={m} className={radio}>
                <input
                  type="radio"
                  name={motionName}
                  checked={motion === m}
                  onChange={() => pickMotion(m)}
                  className="size-5 accent-link"
                />
                <T k={m === "system" ? "settings.motionSystem" : "settings.motionReduced"} />
              </label>
            ))}
          </fieldset>
          <Popover.Close asChild>
            <button
              type="button"
              className="tt-button justify-self-start"
              onClick={() => shellStore.getState().setHelpOpen(true)}
            >
              <T k="settings.shortcuts" />
            </button>
          </Popover.Close>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/* ---------------------------------------------------------- breadcrumbs */

export function useEntityData(): EntityData | null {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const d = matches[i]!.loaderData as EntityData | { status: "world" } | undefined;
    if (d && typeof d === "object" && "status" in d && d.status !== "world") return d as EntityData;
  }
  return null;
}

export function Breadcrumbs() {
  const t = useT();
  const href = useShellHref();
  const data = useEntityData();
  const crumbs = useMemo<Crumb[]>(() => (data && data.status !== "redirect" ? data.crumbs : []), [data]);
  const listRef = useRef<HTMLOListElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) {
      moved.current = false;
      listRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    }
  }, [crumbs]);
  const world = { glottocode: "", name: t("crumbs.world"), kind: "world" as const };
  const all = [world, ...crumbs];
  const last = all.length - 1;
  // Desktop: World, the first family, more, the last two ancestors, the current item.
  const hiddenDesktop = new Set<number>();
  if (all.length > 5) for (let i = 2; i < last - 2; i++) hiddenDesktop.add(i);
  // Phone: more, the parent, the current item.
  const hiddenPhone = new Set<number>();
  for (let i = 0; i < last - 1; i++) hiddenPhone.add(i);
  const go = (c: (typeof all)[number]) => {
    moved.current = true;
    shellStore
      .getState()
      .select(c.kind === "world" ? null : { kind: c.kind, glottocode: c.glottocode }, { source: "crumb" });
  };
  const toOf = (c: (typeof all)[number]) =>
    href(c.kind === "world" ? null : { kind: c.kind, glottocode: c.glottocode });
  const more = (hidden: Set<number>, cls: string) =>
    hidden.size > 0 && (
      <li className={`flex items-center ${cls}`}>
        <Popover.Root>
          <Popover.Trigger className="tt-icon-button" aria-label={t("crumbs.more")}>
            ...
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className="tt-popover z-50 max-h-[60dvh] overflow-auto rounded-md border border-line-strong bg-raised p-2 shadow-overlay"
            >
              <ul>
                {[...hidden].map((i) => (
                  <li key={i}>
                    <Popover.Close asChild>
                      <Link
                        to={toOf(all[i]!)}
                        onClick={(e) => {
                          e.preventDefault();
                          go(all[i]!);
                        }}
                        className="flex min-h-target items-center px-3"
                      >
                        <bdi>{all[i]!.name}</bdi>
                      </Link>
                    </Popover.Close>
                  </li>
                ))}
              </ul>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <Sep />
      </li>
    );
  return (
    <nav
      aria-label={t("crumbs.label")}
      className="flex h-11 items-center overflow-hidden border-b border-line bg-canvas px-2"
    >
      <ol ref={listRef} className="flex min-w-0 items-center">
        {all.map((c, i) => {
          const current = i === last;
          const firstHidden = (hidden: Set<number>) => hidden.has(i) && !hidden.has(i - 1);
          return (
            <FragmentWithMore
              key={`${c.kind}:${c.glottocode}`}
              before={firstHidden(hiddenDesktop) ? more(hiddenDesktop, "max-sm:hidden") : null}
              beforePhone={i === 0 ? more(hiddenPhone, "sm:hidden") : null}
            >
              <li
                className={`flex min-w-0 items-center ${hiddenDesktop.has(i) ? "sm:hidden" : ""} ${hiddenPhone.has(i) ? "max-sm:hidden" : ""} ${hiddenDesktop.has(i) && !hiddenPhone.has(i) ? "" : ""}`}
                data-hidden-desktop={hiddenDesktop.has(i) || undefined}
              >
                <Link
                  to={toOf(c)}
                  aria-current={current ? "page" : undefined}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                    e.preventDefault();
                    if (!current) go(c);
                  }}
                  className={`inline-flex min-h-target min-w-target items-center truncate rounded-sm px-2 text-small ${current ? "font-semibold text-ink no-underline" : "text-link"}`}
                >
                  <bdi className="truncate">{c.name}</bdi>
                </Link>
                {!current && <Sep />}
              </li>
            </FragmentWithMore>
          );
        })}
      </ol>
    </nav>
  );
}

function FragmentWithMore({
  before,
  beforePhone,
  children,
}: {
  before: React.ReactNode;
  beforePhone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      {beforePhone}
      {before}
      {children}
    </>
  );
}

function Sep() {
  return (
    <span aria-hidden="true" className="tt-mirror inline-block px-0.5 text-ink-muted">
      ›
    </span>
  );
}

/* ------------------------------------------------------------ time strip */

export function TimeStrip() {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("time.label")}
      aria-description={t("time.later")}
      className="tt-time flex h-11 shrink-0 items-center gap-3 border-t border-line bg-surface px-4 lg:h-14"
      data-testid="time-strip"
    >
      <span className="text-small font-semibold max-lg:hidden">
        <T k="time.label" />
      </span>
      <span className="text-small max-lg:hidden">
        <T k="time.today" />
      </span>
      <span aria-hidden="true" className="relative hidden h-1 min-w-24 flex-1 rounded-pill bg-line sm:block">
        <span className="absolute -top-1.5 end-0 size-4 rounded-full border-2 border-line-strong bg-raised" />
      </span>
      <T k="time.later" className="hidden text-caption text-ink-muted lg:inline" />
      <T k="time.laterShort" className="text-caption text-ink-muted lg:hidden" aria-hidden="true" />
    </div>
  );
}

/* ---------------------------------------------------------- footer strip */

export function FooterStrip() {
  const lens = useShell((s) => s.lens);
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-4 border-t border-line bg-canvas px-4 py-1 text-caption text-ink-muted">
      {lens === "map" && <T as="p" k="map.borders" data-testid="borders-note" />}
      <T as="p" k="footer.classification" />
      <nav aria-label={t("nav.workbenches")} className="ms-auto">
        <ul className="flex gap-x-3">
          {(["design", "tree", "map"] as const).map((w) => (
            <li key={w}>
              <WorkbenchLink w={w} />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** The link itself carries lang and dir when its label is still English inside another locale. */
function WorkbenchLink({ w }: { w: "design" | "tree" | "map" }) {
  const tx = useTx();
  const label = tx(`workbench.${w}.label`);
  return (
    <Link
      to={w === "design" ? "/design" : `/spike/${w}`}
      lang={label.lang}
      dir={label.dir}
      className="inline-flex min-h-target items-center"
    >
      {label.text}
    </Link>
  );
}

/* ------------------------------------------------------------ live region */

export function LiveRegion() {
  const a = useShell((s) => s.announcement);
  const [text, setText] = useState("");
  useEffect(() => {
    // Clear first, so the same sentence twice is announced twice.
    const clear = window.setTimeout(() => setText(""), 0);
    const id = window.setTimeout(() => setText(a.text), 60);
    return () => {
      window.clearTimeout(clear);
      window.clearTimeout(id);
    };
  }, [a.id, a.text]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="live-region">
      {text}
    </div>
  );
}

/* -------------------------------------------------------- keyboard help */

export function HelpDialog() {
  const open = useShell((s) => s.helpOpen);
  const t = useT();
  const opener = useRef<HTMLElement | null>(null);
  const rows: [string, Parameters<typeof T>[0]["k"], Parameters<typeof T>[0]["k"]][] = [
    ["Ctrl K, ⌘ K", "help.anywhere", "help.kSearch"],
    ["Esc", "help.anywhere", "help.kEsc"],
    ["← ↑ → ↓", "help.canvasTree", "help.kArrowsTree"],
    ["Enter", "help.canvasTree", "help.kEnter"],
    ["Esc, Backspace", "help.canvasTree", "help.kBack"],
    ["Home", "help.canvasTree", "help.kHome"],
    ["+ −", "help.canvasBoth", "help.kZoom"],
    ["← ↑ → ↓", "help.canvasMap", "help.kArrowsMap"],
    ["1, 2", "help.canvasBoth", "help.kLens"],
    ["I", "help.canvasBoth", "help.kInspector"],
    ["?", "help.canvasBoth", "help.kHelp"],
  ];
  return (
    <Dialog.Root open={open} onOpenChange={(o) => shellStore.getState().setHelpOpen(o)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[var(--tt-scrim)]" />
        <Dialog.Content
          onOpenAutoFocus={() => {
            const prev = document.activeElement;
            opener.current = prev instanceof HTMLElement && prev !== document.body ? prev : null;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            (opener.current?.isConnected
              ? opener.current
              : document.querySelector<HTMLElement>('[aria-label="Settings"]')
            )?.focus();
          }}
          className="tt-dialog fixed start-1/2 top-[10dvh] z-50 max-h-[80dvh] w-[min(94vw,36rem)] -translate-x-1/2 overflow-auto rounded-lg border border-line-strong bg-raised p-5 shadow-overlay rtl:translate-x-1/2"
        >
          <Dialog.Title className="font-display text-title-sm">{t("help.title")}</Dialog.Title>
          <Dialog.Description className="mt-1 text-small text-ink-muted">
            {t("help.canvasOnly")}
          </Dialog.Description>
          <table className="mt-3 w-full text-small">
            <tbody>
              {rows.map(([keys, where, what], i) => (
                <tr key={i} className="border-t border-line align-baseline">
                  <td className="py-1 pe-3 whitespace-nowrap">
                    <kbd dir="ltr">{keys}</kbd>
                  </td>
                  <td className="py-1 pe-3 text-ink-muted">
                    <T k={where} />
                  </td>
                  <td className="py-1">
                    <T k={what} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Dialog.Close className="tt-button mt-4">{t("help.close")}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
