// Inspector building blocks: header, tabs, empty states, Go deeper cards, sources list.

import type { ParseKeys } from "i18next";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link } from "react-router";

import type { SourceInfo } from "@/data/bundle";
import type { DeeperCard } from "@/data/deeper";
import { FamilyMarker } from "@/design/FamilySwatch";
import { useResolvedTheme } from "@/design/ThemeToggle";
import { familyById, familyColor, type FamilyId } from "@/design/tokens";
import { ROOT_TO_FAMILY } from "@/canvas/map/families";
import { directionOf } from "@/i18n/direction";
import { useLocale } from "@/i18n/locale";
import { regionName } from "@/i18n/regions";
import { shellStore, useShell } from "@/state/shell";
import { useShellHref } from "@/state/useShellHref";
import type { Lens, Tab } from "@/state/url";

import { T, useT } from "../T";

export const INSPECTOR_HEADING_ID = "inspector-heading";

export function familyOf(top: string | null | undefined): FamilyId {
  return (top && ROOT_TO_FAMILY[top]) || "other";
}

export function FamilyMark({ top }: { top: string | null | undefined }) {
  const theme = useResolvedTheme();
  const id = familyOf(top);
  const fam = familyById[id];
  return (
    <span className="inline-flex items-center gap-1" title={fam.name}>
      <FamilyMarker marker={fam.marker} color={familyColor(id, theme).hex} size={16} />
      <span aria-hidden="true" className="text-caption font-semibold text-ink-muted" dir="ltr">
        {fam.abbr}
      </span>
    </span>
  );
}

export interface HeaderProps {
  level: "language" | "dialect" | "family" | "world";
  top?: string | null;
  name: string;
  endonym?: { name: string; lang: string | null; script: string | null } | null;
  copy?: boolean;
  /** The selection path this header belongs to ("/" for the world view). */
  path: string;
}

/** The h1 of the page is the entity name (spec 9.1). It takes focus after a search or Go deeper pick. */
export function InspectorHeader({ level, top, name, endonym, path, copy = true }: HeaderProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const pending = useShell((s) => s.pendingFocus);
  useEffect(() => {
    if (path && pending === path && shellStore.getState().consumeFocus(path))
      ref.current?.focus({ preventScroll: false });
  }, [pending, path]);
  const endoLang = endonym?.lang
    ? endonym.script
      ? `${endonym.lang}-${endonym.script}`
      : endonym.lang
    : undefined;
  return (
    <header className="tt-inspector-header">
      <div className="flex flex-wrap items-center gap-2">
        {level !== "world" && (
          <span className="inline-flex items-center gap-2 rounded-pill border border-line-strong px-2.5 py-0.5 text-caption font-semibold">
            {top !== undefined && <FamilyMark top={top} />}
            <T k={`level.${level}` as ParseKeys} />
          </span>
        )}
        {copy && <CopyLink />}
      </div>
      <h1
        id={INSPECTOR_HEADING_ID}
        ref={ref}
        tabIndex={-1}
        className="mt-2 font-display text-title leading-tight outline-offset-4"
      >
        <bdi>{name}</bdi>
      </h1>
      {endonym && endonym.name !== name && (
        <p className="mt-1 text-lead">
          <bdi lang={endoLang ?? undefined} dir={endoLang ? directionOf(endoLang) : "auto"}>
            {endonym.name}
          </bdi>
        </p>
      )}
    </header>
  );
}

function CopyLink() {
  const t = useT();
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="tt-button tt-button-quiet ms-auto"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setDone(true);
          shellStore.getState().announce(t("inspector.copied"));
          window.setTimeout(() => setDone(false), 2000);
        } catch {
          // Clipboard blocked: the address bar still has the link.
        }
      }}
    >
      <T k={done ? "inspector.copied" : "inspector.copyLink"} />
    </button>
  );
}

/* --------------------------------------------------------------- tabs */

export interface TabDef {
  id: Tab;
  panel: ReactNode;
}

/**
 * WAI-ARIA tabs with automatic activation. Every panel is in the DOM (inactive ones hidden), so the
 * prerendered page carries the Sources list too. Left and Right mirror in RTL; Home and End jump.
 */
export function InspectorTabs({ tabs, active }: { tabs: TabDef[]; active: Tab }) {
  const base = useId();
  const t = useT();
  const locale = useLocale();
  const rtl = directionOf(locale) === "rtl";
  const listRef = useRef<HTMLDivElement>(null);
  const current = tabs.some((x) => x.id === active) ? active : tabs[0]!.id;
  const select = (id: Tab, focus: boolean) => {
    shellStore.getState().setTab(id);
    if (focus) listRef.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    const i = tabs.findIndex((x) => x.id === current);
    let next: number;
    if (e.key === "ArrowRight") next = rtl ? i - 1 : i + 1;
    else if (e.key === "ArrowLeft") next = rtl ? i + 1 : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    next = (next + tabs.length) % tabs.length;
    select(tabs[next]!.id, true);
  };
  return (
    <>
      <div className="tt-tabs-wrap sticky top-0 z-10 -mx-5 border-b border-line bg-surface px-5">
        <div
          ref={listRef}
          role="tablist"
          aria-label={t("tab.label")}
          className="tt-tabs flex overflow-x-auto"
          onKeyDown={onKey}
        >
          {tabs.map((x) => {
            const selected = x.id === current;
            return (
              <button
                key={x.id}
                type="button"
                role="tab"
                id={`${base}-tab-${x.id}`}
                data-tab={x.id}
                aria-selected={selected}
                aria-controls={`${base}-panel-${x.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(x.id, false)}
                className={`min-h-target shrink-0 border-b-2 px-3 text-small font-semibold ${selected ? "border-accent text-ink" : "border-transparent text-ink-muted hover:text-ink"}`}
              >
                <T k={`tab.${x.id}` as ParseKeys} />
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((x) => (
        <div
          key={x.id}
          role="tabpanel"
          id={`${base}-panel-${x.id}`}
          aria-labelledby={`${base}-tab-${x.id}`}
          hidden={x.id !== current}
          tabIndex={0}
          className="tt-panel pt-4 outline-offset-2"
          data-panel={x.id}
        >
          {x.panel}
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------- empty states */

export function EmptyState({
  title,
  why,
  children,
}: {
  title: ParseKeys;
  why?: ParseKeys;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-dashed border-line-strong p-4" data-empty={title}>
      <T as="p" k={title} className="font-semibold" />
      {why && <T as="p" k={why} className="mt-1 text-small text-ink-muted" />}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function SectionTitle({ k, id }: { k: ParseKeys; id?: string }) {
  return (
    <T
      as="h2"
      id={id}
      k={k}
      className="mb-2 font-ui text-caption font-semibold uppercase tracking-wide text-ink-muted"
    />
  );
}

/* ----------------------------------------------------------- Go deeper */

function reasonText(
  t: ReturnType<typeof useT>,
  c: DeeperCard,
  otherLensLabel: string,
  regionName: (iso: string) => string,
): string {
  const r = c.reason;
  switch (r.key) {
    case "sameBranch":
      return t("deeper.sameBranch", { group: r.group });
    case "parent":
      return t("deeper.parent");
    case "sharesPlace":
      return t("deeper.sharesPlace", { place: regionName(r.place) });
    case "sameArea":
      return t("deeper.sameArea", { macroarea: r.macroarea });
    case "member":
      return t("deeper.member");
    case "pilot":
      return t("deeper.pilot");
    case "bigFamily":
      return t("deeper.bigFamily", { count: r.count });
    case "otherLens":
      return t("deeper.otherLens", { lens: otherLensLabel });
    case "world":
      return t("deeper.world");
  }
}

export function useRegionName(): (iso: string) => string {
  const locale = useLocale();
  // Pinned CLDR 49 names, not Intl.DisplayNames: see src/i18n/regions.ts (hydration #418).
  return (iso) => regionName(locale, iso);
}

export function GoDeeper({ cards }: { cards: DeeperCard[] }) {
  const t = useT();
  const href = useShellHref();
  const lens = useShell((s) => s.lens);
  const other: Lens = lens === "tree" ? "map" : "tree";
  const region = useRegionName();
  const id = useId();
  if (!cards.length) return null;
  return (
    <section aria-labelledby={id} className="mt-8" data-testid="go-deeper">
      <SectionTitle k="deeper.title" id={id} />
      <ul className="grid gap-2">
        {cards.map((c, i) => {
          const tgt = c.reason.key === "otherLens" ? { ...c.target, lens: other } : c.target;
          const sel = tgt.type === "world" ? null : { kind: tgt.type, glottocode: tgt.glottocode };
          const to = href(sel as never, tgt.lens ? { lens: tgt.lens } : undefined);
          const name = c.label || t("deeper.worldName");
          return (
            <li key={i}>
              <Link
                to={to}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  shellStore.getState().select(sel as never, { source: "deeper", lens: tgt.lens });
                }}
                className="tt-card flex min-h-[72px] flex-col justify-center rounded-md border border-line-strong bg-raised px-4 py-2 no-underline shadow-raised hover:border-ink-muted"
              >
                <T
                  k={`deeper.${c.kind}` as ParseKeys}
                  className="text-caption font-semibold uppercase tracking-wide text-accent"
                />
                <bdi className="font-display text-title-sm text-ink">{name}</bdi>
                <span className="text-small text-ink-muted" dir="auto">
                  {reasonText(t, c, t(`lens.${other}`), region)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------ sources */

export interface UsedSource {
  id: string;
  info: SourceInfo | null;
  retrieved: string[];
  locators: string[];
}

export function SourcesList({ sources }: { sources: UsedSource[] }) {
  return (
    <div>
      <T as="p" k="sources.intro" className="text-small text-ink-muted" />
      <ul className="mt-3 grid gap-3" data-testid="sources-list">
        {sources.map((s) => (
          <li key={s.id} className="rounded-md border border-line p-3 text-small">
            <p className="font-semibold">{s.info?.attribution ?? s.id}</p>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3">
              <T as="dt" k="sources.version" className="text-ink-muted" />
              <dd>{s.info?.version ?? <T k="glance.noData" />}</dd>
              <T as="dt" k="sources.license" className="text-ink-muted" />
              <dd dir="ltr">{s.info?.license ?? <T k="glance.noData" />}</dd>
              <T as="dt" k="sources.retrieved" className="text-ink-muted" />
              <dd dir="ltr">{s.retrieved.length ? s.retrieved.join(", ") : <T k="glance.noData" />}</dd>
              <T as="dt" k="sources.used" className="text-ink-muted" />
              <dd>
                <code dir="ltr" className="break-all text-caption">
                  {s.locators.slice(0, 6).join("; ")}
                  {s.locators.length > 6 ? "; ..." : ""}
                </code>
              </dd>
            </dl>
            {s.info?.url && (
              <a
                href={s.info.url}
                rel="noreferrer noopener"
                target="_blank"
                className="mt-1 inline-flex min-h-target items-center"
              >
                <T k="sources.link" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Skeleton() {
  const t = useT();
  return (
    <div
      aria-busy="true"
      aria-label={t("inspector.loading")}
      className="grid gap-3"
      data-testid="inspector-skeleton"
    >
      <div className="h-8 w-2/3 rounded-sm bg-raised" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-5 rounded-sm bg-raised" />
      ))}
      <div className="h-10 rounded-sm bg-raised" />
    </div>
  );
}
