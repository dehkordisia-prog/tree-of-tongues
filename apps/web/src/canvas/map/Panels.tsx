// The side panel. It is the text alternative for the map: whatever the map shows for a selection
// is listed here as text, with its source.

import { createElement, useMemo, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import { Link } from "react-router";

import { useLocale } from "@/i18n/locale";
import { regionNameOrNull } from "@/i18n/regions";

import type { Bundle, CountryInfo, DisputedInfo, TerritoryIndex } from "./data";
import { statusLabel, type Join } from "./policy";
import { S } from "./strings";

/** English UI text inside a right to left page keeps its own language and direction (see useTx). */
export function useTextProps(): { lang?: string; dir?: "ltr" } {
  const locale = useLocale();
  return locale === "en" ? {} : { lang: "en", dir: "ltr" };
}

type TxtProps<T extends ElementType> = { as?: T } & Omit<ComponentPropsWithoutRef<T>, "as">;

/** An element holding English copy. */
export function Txt<T extends ElementType = "span">({ as, ...rest }: TxtProps<T>) {
  const tp = useTextProps();
  return createElement(as ?? "span", { ...tp, ...rest });
}

export function useRegionName(): (code: string, fallback?: string) => { text: string; lang?: string } {
  const locale = useLocale();
  // Pinned CLDR 49 names (src/i18n/regions.ts), so every runtime shows the same string.
  return (code, fallback) => {
    const text = regionNameOrNull(locale, code);
    if (text) return { text, lang: locale === "en" ? undefined : locale };
    return { text: fallback ?? code, lang: fallback ? "en" : undefined };
  };
}

export function formatShare(share: number): string {
  return `${new Intl.NumberFormat("en", { maximumSignificantDigits: 3 }).format(share)}%`;
}

const th = "border-b border-line-strong px-2 py-2 text-start text-caption font-semibold text-ink-muted";
const td = "border-b border-line px-2 py-2 align-top text-small";
const linkButton =
  "min-h-target text-start text-link underline decoration-1 underline-offset-2 hover:decoration-2 cursor-pointer";

function Scroll({ label, children }: { label: string; children: ReactNode }) {
  // A scrollable region must be focusable to be reachable by keyboard (axe: scrollable-region-focusable).
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className="max-h-[22rem] overflow-auto rounded-md border border-line"
    >
      {children}
    </div>
  );
}

export function EmptyPanel() {
  return (
    <>
      <Txt as="p">{S.panelEmpty}</Txt>
      <Txt as="p" className="mt-2 text-ink-muted">
        {S.panelEmptyMore}
      </Txt>
    </>
  );
}

function GoDeeper({ extra }: { extra?: ReactNode }) {
  return (
    <nav aria-label={S.goDeeper} className="mt-6 border-t border-line pt-4">
      <Txt as="h3" className="text-small font-semibold">
        {S.goDeeper}
      </Txt>
      <ul className="mt-1">
        {extra}
        <li>
          <Link to="/spike/tree" className="inline-flex min-h-target items-center">
            <Txt>{S.goTree}</Txt>
          </Link>
        </li>
        <li>
          <Link to="/" className="inline-flex min-h-target items-center">
            <Txt>{S.goHome}</Txt>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

/* --------------------------------------------------------------- language */

export interface LanguagePanelProps {
  glottocode: string;
  name: string;
  glottologName: string;
  level: string;
  familyName: string;
  lon: number;
  lat: number;
  state: "loading" | "error" | "ok";
  bundle: Bundle | null;
  join: Join | null;
  countryName: (code: string) => { text: string; lang?: string };
  isPickable: (code: string) => boolean;
  onPickCountry(code: string): void;
}

export function LanguagePanel(p: LanguagePanelProps) {
  const rows = useMemo(
    () => (p.bundle ? p.bundle.territories.flatMap((b) => b.items).sort((a, b) => b.population_share - a.population_share) : []),
    [p.bundle],
  );
  const block = p.bundle?.territories[0];
  const source = block ? p.bundle?.sources?.[block.source_id] : undefined;
  return (
    <>
      <Txt as="h2" className="text-title-sm">
        {p.name}
      </Txt>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
        <Txt as="dt" className="text-ink-muted">
          Glottocode
        </Txt>
        <dd lang="en" dir="ltr">
          <code>{p.glottocode}</code>
        </dd>
        {p.name !== p.glottologName && (
          <>
            <Txt as="dt" className="text-ink-muted">
              {S.glottologName}
            </Txt>
            <dd lang="en" dir="ltr">
              {p.glottologName}
            </dd>
          </>
        )}
        <Txt as="dt" className="text-ink-muted">
          {S.level}
        </Txt>
        <Txt as="dd">{p.level}</Txt>
        <Txt as="dt" className="text-ink-muted">
          {S.family}
        </Txt>
        <Txt as="dd">{p.familyName}</Txt>
      </dl>
      <Txt as="p" className="mt-3 text-small text-ink-muted">
        {S.pointNote} ({p.lat.toFixed(2)}, {p.lon.toFixed(2)})
      </Txt>

      {p.state === "loading" && <Txt as="p" className="mt-4 text-ink-muted">{S.loadingSelection}</Txt>}
      {p.state === "error" && <Txt as="p" className="mt-4 text-danger">{S.bundleFailed}</Txt>}
      {p.state === "ok" && rows.length === 0 && (
        <div className="mt-4 rounded-md border border-line-strong bg-raised p-3">
          <Txt as="p" className="font-semibold">
            {S.noTerritory}
          </Txt>
          <Txt as="p" className="mt-1 text-small text-ink-muted">
            {S.noTerritoryDetail}
          </Txt>
        </div>
      )}
      {p.state === "ok" && rows.length > 0 && (
        <>
          <div className="mt-4">
            <Scroll label={S.territoryCaption}>
              <table className="w-full border-collapse">
                <caption className="sr-only">{S.territoryCaption}</caption>
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <Txt as="th" scope="col" className={th}>{S.colTerritory}</Txt>
                    <Txt as="th" scope="col" className={th}>{S.colShare}</Txt>
                    <Txt as="th" scope="col" className={th}>{S.colStatus}</Txt>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const n = p.countryName(r.iso3166);
                    return (
                      <tr key={r.iso3166}>
                        <td className={td}>
                          {p.isPickable(r.iso3166) ? (
                            <button type="button" className={linkButton} lang={n.lang} onClick={() => p.onPickCountry(r.iso3166)}>
                              {n.text}
                            </button>
                          ) : (
                            <span lang={n.lang}>{n.text}</span>
                          )}
                        </td>
                        <td className={`${td} tabular-nums`}>{formatShare(r.population_share)}</td>
                        <Txt as="td" className={td}>{statusLabel(r.official_status)}</Txt>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroll>
          </div>
          <Txt as="p" className="mt-2 text-small">
            {S.sourceCldr}
          </Txt>
          {p.join && p.join.unmatched.length > 0 && (
            <details className="mt-2 text-small">
              <summary className="min-h-target cursor-pointer py-2">
                <Txt>
                  {S.unmatchedTitle} ({p.join.unmatched.length})
                </Txt>
              </summary>
              <p lang="en" dir="ltr" className="text-ink-muted">
                {p.join.unmatched.map((r) => `${r.iso3166} ${formatShare(r.population_share)}`).join(", ")}
              </p>
            </details>
          )}
          {block && (
            <details className="mt-1 text-small">
              <summary className="min-h-target cursor-pointer py-2">
                <Txt>{S.provenance}</Txt>
              </summary>
              <dl lang="en" dir="ltr" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink-muted">
                <dt>Source</dt>
                <dd>{block.source_id}{source ? `, ${source.version}` : ""}</dd>
                <dt>Locator</dt>
                <dd className="break-all"><code>{block.locator_template}</code></dd>
                <dt>Retrieved</dt>
                <dd>{block.retrieved_at}</dd>
                <dt>License</dt>
                <dd>{source?.license ?? "see data/LICENSES.yaml"}</dd>
                <dt>Confidence</dt>
                <dd>{block.confidence}</dd>
                {block.notes && (
                  <>
                    <dt>Notes</dt>
                    <dd>{block.notes}</dd>
                  </>
                )}
              </dl>
            </details>
          )}
        </>
      )}
      <GoDeeper
        extra={
          <li>
            <a href={`https://glottolog.org/resource/languoid/id/${p.glottocode}`} rel="noreferrer" className="inline-flex min-h-target items-center">
              <Txt>Glottolog entry (opens glottolog.org)</Txt>
            </a>
          </li>
        }
      />
    </>
  );
}

/* ---------------------------------------------------------------- country */

export interface CountryPanelProps {
  info: CountryInfo;
  name: { text: string; lang?: string };
  index: TerritoryIndex | null;
  languageName: (glottocode: string) => string | null;
  onPickLanguage(glottocode: string): void;
}

export function CountryPanel({ info, name, index, languageName, onPickLanguage }: CountryPanelProps) {
  const rows = index?.territories[info.code] ?? [];
  return (
    <>
      <h2 className="font-display text-title-sm" lang={name.lang}>
        {name.text}
      </h2>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-small">
        <Txt as="dt" className="text-ink-muted">
          {S.colTerritory}
        </Txt>
        <dd lang="en" dir="ltr">
          <code>{info.code}</code>
        </dd>
      </dl>
      {info.contested && (
        <Txt as="p" className="mt-3 rounded-md border border-line-strong bg-raised p-3 text-small">
          {S.contestedNote}
          {info.note ? ` ${S.neutralNote}: ${info.note}.` : ""}
        </Txt>
      )}
      {index === null && <Txt as="p" className="mt-4 text-ink-muted">{S.noIndex}</Txt>}
      {index !== null && rows.length === 0 && <Txt as="p" className="mt-4">{S.noLanguagesForCountry}</Txt>}
      {rows.length > 0 && (
        <>
          <div className="mt-4">
            <Scroll label={S.countryCaption}>
              <table className="w-full border-collapse">
                <caption className="sr-only">{S.countryCaption}</caption>
                <thead className="sticky top-0 bg-surface">
                  <tr>
                    <Txt as="th" scope="col" className={th}>{S.colLanguage}</Txt>
                    <Txt as="th" scope="col" className={th}>{S.colShare}</Txt>
                    <Txt as="th" scope="col" className={th}>{S.colStatus}</Txt>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([glottocode, share, status, weak]) => {
                    const label = languageName(glottocode);
                    return (
                      <tr key={glottocode}>
                        <td className={td}>
                          {label ? (
                            <button type="button" className={linkButton} onClick={() => onPickLanguage(glottocode)}>
                              {label}
                            </button>
                          ) : (
                            glottocode
                          )}
                          {weak && (
                            <Txt as="span" className="ms-1 text-ink-muted">
                              {S.weakMappingMark}
                            </Txt>
                          )}
                        </td>
                        <td className={`${td} tabular-nums`}>{formatShare(share)}</td>
                        <Txt as="td" className={td}>{statusLabel(status)}</Txt>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Scroll>
          </div>
          <Txt as="p" className="mt-2 text-small">
            {S.sourceCldr}
          </Txt>
          {rows.some((r) => r[3]) && (
            <Txt as="p" className="mt-1 text-small text-ink-muted">
              {S.weakMappingNote}
            </Txt>
          )}
        </>
      )}
      <GoDeeper />
    </>
  );
}

/* ---------------------------------------------------------------- neutral */

export function NeutralPanel({ info }: { info: DisputedInfo }) {
  return (
    <>
      <h2 className="font-display text-title-sm" lang="en" dir="ltr">
        {info.name}
      </h2>
      <Txt as="p" className="mt-1 text-small font-semibold">
        {S.neutralTitle}
      </Txt>
      <Txt as="p" className="mt-2 text-small">
        {S.neutralBody}
      </Txt>
      {info.note && (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 text-small">
          <Txt as="dt" className="text-ink-muted">
            {S.neutralNote}
          </Txt>
          <dd lang="en" dir="ltr">
            {info.note}
          </dd>
        </dl>
      )}
      <Txt as="p" className="mt-2 text-small text-ink-muted">
        Source: Natural Earth 5.1.1, breakaway and disputed areas. The area name is Natural Earth's as well.
      </Txt>
      <GoDeeper />
    </>
  );
}
