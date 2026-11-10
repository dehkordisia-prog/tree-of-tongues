// Inspector for a language or dialect (spec 4.2). Real data: At a glance, Speakers, Where, Family,
// Sources. Writing, Sounds and Words are honest empty states until their content exists.

import type { ParseKeys } from "i18next";
import { useId, useMemo } from "react";
import { Link } from "react-router";

import type { Bundle } from "@/data/bundle";
import { endonymOf, nameRows } from "@/data/bundle";
import type { EntityOk } from "@/data/entity";
import {
  formatCompact,
  formatExact,
  summarizeSpeakers,
  type SpeakerGroup,
  type SpeakerKind,
  type SpeakerSummary,
} from "@/data/speakers";
import { useLocale } from "@/i18n/locale";
import { shellStore, useShell } from "@/state/shell";
import { useShellHref } from "@/state/useShellHref";
import type { Tab } from "@/state/url";

import { T, useT } from "../T";
import { CitationChip, type CiteRow } from "./Citation";
import { groupShort, provRow, sourceShort, speakerRow, territoryRow } from "./cite";
import {
  EmptyState,
  GoDeeper,
  type TabDef,
  InspectorHeader,
  InspectorTabs,
  SectionTitle,
  SourcesList,
  useRegionName,
  type UsedSource,
} from "./parts";

const KIND_KEY: Record<SpeakerKind, ParseKeys> = {
  l1: "speakers.l1",
  l2: "speakers.l2",
  total: "speakers.total",
  unstated: "speakers.unstated",
};

export function LanguageInspector({ data }: { data: EntityOk }) {
  const tab = useShell((s) => s.tab) as Tab;
  const b = data.bundle;
  const endo = endonymOf(b);
  const speakers = useMemo(() => summarizeSpeakers(b.speakers ?? []), [b]);
  const level = b.languoid.level === "dialect" ? "dialect" : "language";
  const top = b.lineage[0]?.glottocode ?? null;
  return (
    <article data-entity={data.glottocode}>
      <InspectorHeader
        path={`/language/${data.glottocode}`}
        level={level}
        top={top}
        name={data.label}
        endonym={endo ? { name: endo.name, lang: endo.lang, script: endo.script } : null}
      />
      <div className="mt-4">
        <InspectorTabs
          active={tab}
          tabs={(
            [
              { id: "overview", panel: <Overview data={data} speakers={speakers} /> },
              { id: "speakers", panel: <SpeakersPanel b={b} s={speakers} /> },
              { id: "where", panel: <WherePanel b={b} /> },
              { id: "writing", panel: <EmptyState title="empty.writing" why="empty.writingWhy" /> },
              { id: "sounds", panel: <EmptyState title="empty.sounds" why="empty.soundsWhy" /> },
              { id: "words", panel: <EmptyState title="empty.words" why="empty.wordsWhy" /> },
              { id: "family", panel: <FamilyPanel data={data} /> },
              { id: "sources", panel: <SourcesList sources={usedSources(b)} /> },
            ] as TabDef[]
          ).map((x) => ({
            ...x,
            panel: (
              <>
                {x.panel}
                <GoDeeper cards={data.deeper} />
              </>
            ),
          }))}
        />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------ glance */

function GlanceRow({ k, children }: { k: ParseKeys; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-x-3 border-b border-line py-2 last:border-b-0 max-[400px]:grid-cols-1">
      <T as="dt" k={k} className="text-small text-ink-muted" />
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function NoData() {
  return <T k="glance.noData" className="text-ink-muted" />;
}

function Overview({ data, speakers }: { data: EntityOk; speakers: SpeakerSummary }) {
  const b = data.bundle;
  const t = useT();
  const locale = useLocale();
  const href = useShellHref();
  const region = useRegionName();
  const id = useId();
  const endo = endonymOf(b);
  const terr = b.territories
    .flatMap((block) => block.items.map((item) => ({ block, item })))
    .sort((x, y) => (y.item.population_share ?? -1) - (x.item.population_share ?? -1));
  const lineage = data.crumbs.slice(0, -1);
  const shortLineage = lineage.length > 3 ? [lineage[0]!, null, ...lineage.slice(-2)] : lineage;
  const iso = b.languoid.iso639_3;
  const qid = b.languoid.wikidata_qid;
  const glotto = provRow(b, b.languoid, { year: null });
  return (
    <section aria-labelledby={id}>
      <SectionTitle k="glance.title" id={id} />
      <dl data-testid="at-a-glance">
        <GlanceRow k="glance.ownName">
          {endo ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <bdi lang={endo.lang ?? undefined}>{endo.name}</bdi>
              <CitationChip
                short={sourceShort(endo.source_id)}
                what={t("glance.ownName")}
                rows={[provRow(b, endo)]}
              />
            </span>
          ) : (
            <NoData />
          )}
        </GlanceRow>
        <GlanceRow k="glance.ipa">
          <NoData />
        </GlanceRow>
        <GlanceRow k="glance.family">
          {lineage.length ? (
            <span className="inline-flex flex-wrap items-center gap-x-1">
              {shortLineage.map((c, i) =>
                c ? (
                  <span key={c.glottocode} className="inline-flex items-center gap-x-1">
                    {i > 0 && (
                      <span aria-hidden="true" className="tt-mirror inline-block text-ink-muted">
                        ›
                      </span>
                    )}
                    <Link
                      to={href({ kind: "family", glottocode: c.glottocode })}
                      className="inline-flex min-h-target items-center"
                    >
                      <bdi>{c.name}</bdi>
                    </Link>
                  </span>
                ) : (
                  <span key="gap" aria-hidden="true" className="text-ink-muted">
                    › ...
                  </span>
                ),
              )}
              <CitationChip
                short={sourceShort(b.languoid.source_id)}
                what={t("glance.family")}
                rows={[glotto]}
              />
            </span>
          ) : (
            <NoData />
          )}
        </GlanceRow>
        <GlanceRow k="glance.speakers">
          <SpeakersGlance b={b} s={speakers} />
        </GlanceRow>
        <GlanceRow k="glance.spokenIn">
          {terr.length ? (
            <ul>
              {terr.slice(0, 5).map(({ block, item }) => (
                <li key={item.iso3166} className="flex flex-wrap items-baseline gap-x-2">
                  <span>
                    {region(item.iso3166)}
                    {item.population_share !== null && (
                      <>
                        ,{" "}
                        {new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
                          item.population_share / 100,
                        )}
                      </>
                    )}
                    {item.official_status && (
                      <span className="text-ink-muted">, {item.official_status.replace(/_/g, " ")}</span>
                    )}
                  </span>
                  <CitationChip
                    short={`${sourceShort(block.source_id)}, ${item.year ?? t("cite.noYear")}`}
                    what={`${t("glance.spokenIn")}: ${region(item.iso3166)}`}
                    rows={[territoryRow(b, block, item)]}
                  />
                </li>
              ))}
              {terr.length > 5 && (
                <li>
                  <button
                    type="button"
                    className="inline-flex min-h-target items-center text-link underline"
                    onClick={() => shellStore.getState().setTab("where")}
                  >
                    <T k="glance.more" o={{ count: terr.length - 5 }} />
                  </button>
                </li>
              )}
            </ul>
          ) : (
            <NoData />
          )}
        </GlanceRow>
        <GlanceRow k="glance.scripts">
          <NoData />
        </GlanceRow>
        <GlanceRow k="glance.status">
          {b.languoid.endangerment ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span>{b.languoid.endangerment}</span>
              <CitationChip
                short={sourceShort(b.languoid.source_id)}
                what={t("glance.status")}
                rows={[glotto]}
              />
            </span>
          ) : (
            <NoData />
          )}
        </GlanceRow>
        <GlanceRow k="glance.codes">
          <ul className="grid gap-x-3" dir="ltr">
            {iso && (
              <li>
                ISO 639-3:{" "}
                <a
                  href={`https://iso639-3.sil.org/code/${iso}`}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex min-h-target items-center"
                >
                  {iso}
                </a>
              </li>
            )}
            <li>
              Glottocode:{" "}
              <a
                href={`https://glottolog.org/resource/languoid/id/${data.glottocode}`}
                rel="noreferrer noopener"
                target="_blank"
                className="inline-flex min-h-target items-center"
              >
                {data.glottocode}
              </a>
            </li>
            {qid && (
              <li>
                Wikidata:{" "}
                <a
                  href={`https://www.wikidata.org/wiki/${qid}`}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex min-h-target items-center"
                >
                  {qid}
                </a>
              </li>
            )}
          </ul>
        </GlanceRow>
      </dl>
    </section>
  );
}

function rangeText(g: SpeakerGroup, locale: string, t: ReturnType<typeof useT>): string {
  if (g.min === null || g.max === null) return t("speakers.noFigure");
  if (g.min === g.max) return formatCompact(g.min, locale);
  return t("speakers.range", { low: formatCompact(g.min, locale), high: formatCompact(g.max, locale) });
}

function groupRows(b: Bundle, g: SpeakerGroup, locale: string, t: ReturnType<typeof useT>): CiteRow[] {
  return g.rows.map((r) =>
    speakerRow(
      b,
      r,
      locale,
      t(KIND_KEY[g.kind]),
      r.rank === "preferred" ? t("speakers.preferred") : undefined,
    ),
  );
}

function SpeakersGlance({ b, s }: { b: Bundle; s: SpeakerSummary }) {
  const locale = useLocale();
  const t = useT();
  if (!s.any) return <NoData />;
  const kinds: SpeakerKind[] = ["l1", "total"];
  if (!s.groups.l1.rows.length && !s.groups.total.rows.length) kinds.push("unstated");
  return (
    <ul className="grid gap-1">
      {kinds.map((k) => {
        const g = s.groups[k];
        return (
          <li key={k} className="flex flex-wrap items-baseline gap-x-2">
            <T k={KIND_KEY[k]} className="text-small text-ink-muted" />
            <span>{rangeText(g, locale, t)}</span>
            {g.rows.length > 0 && (
              <CitationChip
                short={groupShort(g, t as never, locale)}
                what={t(KIND_KEY[k])}
                rows={groupRows(b, g, locale, t)}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------- speakers */

function SpeakersPanel({ b, s }: { b: Bundle; s: SpeakerSummary }) {
  const locale = useLocale();
  const t = useT();
  if (!s.any && !s.deprecated.length) return <EmptyState title="empty.speakers" why="empty.speakersWhy" />;
  return (
    <div className="grid gap-5" data-testid="speakers">
      {(["l1", "l2", "total", "unstated"] as SpeakerKind[]).map((k) => (
        <KindTable key={k} b={b} g={s.groups[k]} />
      ))}
      {s.deprecated.length > 0 && (
        <details className="rounded-md border border-line p-3">
          <summary className="min-h-target cursor-pointer leading-[44px]">
            <T k="speakers.deprecated" o={{ count: s.deprecated.length }} />
          </summary>
          <ul className="mt-2 grid gap-2 text-small">
            {s.deprecated.map((r) => (
              <li key={r.locator} className="flex flex-wrap items-baseline gap-x-2">
                <span className="line-through decoration-1">{formatExact(r.value, locale)}</span>
                <span>{r.year ?? t("cite.noYear")}</span>
                <CitationChip
                  short={`${sourceShort(r.source_id)}, ${r.year ?? t("cite.noYear")}`}
                  what={t("speakers.deprecated", { count: s.deprecated.length })}
                  rows={[speakerRow(b, r, locale, r.kind, "deprecated")]}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
      {s.disagrees && <T as="p" k="speakers.differ" className="text-small" />}
      {s.mixed && <T as="p" k="speakers.mixed" className="text-small" />}
      {Object.values(s.groups).some((g) => g.rows.length > 1) && (
        <T as="p" k="speakers.neverAveraged" className="text-small text-ink-muted" />
      )}
    </div>
  );
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function KindTable({ b, g }: { b: Bundle; g: SpeakerGroup }) {
  const locale = useLocale();
  const t = useT();
  return (
    <table className="w-full border-collapse text-small [overflow-wrap:anywhere]" data-kind={g.kind}>
      <caption className="pb-1 text-start">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <T k={KIND_KEY[g.kind]} className="font-semibold text-body" />
          <span className="text-body">{rangeText(g, locale, t)}</span>
          {g.rows.length > 0 && (
            <CitationChip
              short={groupShort(g, t as never, locale)}
              what={t(KIND_KEY[g.kind])}
              rows={groupRows(b, g, locale, t)}
            />
          )}
        </span>
      </caption>
      {g.rows.length > 0 && (
        <>
          <thead className="sr-only">
            <tr>
              <th scope="col">{t("speakers.colValue")}</th>
              <th scope="col">{t("speakers.colYear")}</th>
              <th scope="col">{t("speakers.colSource")}</th>
              <th scope="col">{t("speakers.colDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {g.rows.map((r) => {
              const ref = r.references?.[0];
              // A reference that is only a URL shows its host (spec 5.2); the popover keeps the full link.
              const stated = ref?.stated_in_label ?? ref?.stated_in ?? hostOf(ref?.url) ?? null;
              return (
                <tr key={r.locator} className="border-t border-line align-baseline">
                  <td className="py-1 pe-2 whitespace-nowrap">{formatCompact(r.value, locale)}</td>
                  <td className="py-1 pe-2">{r.year ?? <T k="cite.noYear" />}</td>
                  <td className="py-1 pe-2">
                    {sourceShort(r.source_id)}
                    {", "}
                    {stated ? (
                      <>
                        {t("cite.statedIn").toLowerCase()} <bdi dir="ltr">{stated}</bdi>
                      </>
                    ) : (
                      <T k="cite.noReference" />
                    )}
                    {r.rank === "preferred" && (
                      <>
                        {" "}
                        <T k="speakers.preferred" className="text-ink-muted" />
                      </>
                    )}
                  </td>
                  <td className="py-1">
                    <CitationChip
                      short={`${r.year ?? t("cite.noYear")}`}
                      what={`${t(KIND_KEY[g.kind])}: ${formatExact(r.value, locale)}`}
                      rows={[
                        speakerRow(
                          b,
                          r,
                          locale,
                          t(KIND_KEY[g.kind]),
                          r.rank === "preferred" ? t("speakers.preferred") : undefined,
                        ),
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </>
      )}
    </table>
  );
}

/* ------------------------------------------------------------- where */

function WherePanel({ b }: { b: Bundle }) {
  const region = useRegionName();
  const locale = useLocale();
  const t = useT();
  const rows = b.territories
    .flatMap((block) => block.items.map((item) => ({ block, item })))
    .sort((x, y) => (y.item.population_share ?? -1) - (x.item.population_share ?? -1));
  const { latitude: lat, longitude: lon } = b.languoid;
  const showOnMap = (
    <button type="button" className="tt-button" onClick={() => shellStore.getState().setLens("map")}>
      <T k="where.showOnMap" />
    </button>
  );
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const point =
    lat !== null && lon !== null ? (
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 text-small">
        <T k="where.point" o={{ lat: nf.format(lat), lon: nf.format(lon) }} />
        <CitationChip
          short={sourceShort(b.languoid.source_id)}
          what={t("glance.point")}
          rows={[provRow(b, b.languoid)]}
        />
      </p>
    ) : (
      <T as="p" k="where.noPoint" className="mt-3 text-small text-ink-muted" />
    );
  if (!rows.length) {
    return (
      <EmptyState title="empty.where" why="empty.whereWhy">
        {showOnMap}
        {point}
      </EmptyState>
    );
  }
  return (
    <div>
      <table className="w-full border-collapse text-small">
        <thead>
          <tr className="text-start text-ink-muted">
            <th scope="col" className="py-1 pe-2 text-start font-normal">
              {t("where.territory")}
            </th>
            <th scope="col" className="py-1 pe-2 text-start font-normal">
              {t("where.share")}
            </th>
            <th scope="col" className="py-1 pe-2 text-start font-normal">
              {t("where.status")}
            </th>
            <th scope="col" className="py-1 text-start font-normal">
              {t("where.source")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ block, item }) => (
            <tr key={item.iso3166} className="border-t border-line align-baseline">
              <td className="py-1 pe-2">{region(item.iso3166)}</td>
              <td className="py-1 pe-2">
                {item.population_share === null ? (
                  <NoData />
                ) : (
                  new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(
                    item.population_share / 100,
                  )
                )}
              </td>
              <td className="py-1 pe-2">
                {item.official_status ? item.official_status.replace(/_/g, " ") : ""}
              </td>
              <td className="py-1">
                <CitationChip
                  short={`${sourceShort(block.source_id)}, ${item.year ?? t("cite.noYear")}`}
                  what={region(item.iso3166)}
                  rows={[territoryRow(b, block, item)]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4">{showOnMap}</div>
      {point}
    </div>
  );
}

/* ------------------------------------------------------------ family */

function FamilyPanel({ data }: { data: EntityOk }) {
  const href = useShellHref();
  const b = data.bundle;
  const scope = new Set(data.inScope);
  const lineage = data.crumbs.slice(0, -1);
  const dialects = b.children.items.filter(([, , lvl]) => lvl === "dialect");
  return (
    <div className="grid gap-5">
      <section>
        <SectionTitle k="family.lineage" />
        <ol className="grid">
          {lineage.map((c) => (
            <li key={c.glottocode}>
              <Link
                to={href({ kind: "family", glottocode: c.glottocode })}
                className="inline-flex min-h-target items-center"
              >
                <bdi>{c.name}</bdi>
              </Link>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <SectionTitle k="family.sisters" />
        {data.sisters && data.sisters.length ? (
          <ul className="grid">
            {data.sisters.slice(0, 30).map((s) => (
              <li key={s.glottocode} className="flex items-center gap-2">
                <Link
                  to={href({ kind: "language", glottocode: s.glottocode })}
                  className="inline-flex min-h-target items-center"
                >
                  <bdi>{s.name}</bdi>
                </Link>
                {scope.has(s.glottocode) && (
                  <T k="profile.badge" className="rounded-pill border border-line-strong px-2 text-caption" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <T as="p" k="glance.noData" className="text-small text-ink-muted" />
        )}
      </section>
      <section>
        <SectionTitle k="family.dialects" />
        {dialects.length ? (
          <ul className="grid">
            {dialects.map(([g, name]) => (
              <li key={g}>
                <Link
                  to={href({ kind: "language", glottocode: g })}
                  className="inline-flex min-h-target items-center"
                >
                  <bdi>{name}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <T as="p" k="empty.dialects" className="text-small text-ink-muted" />
        )}
      </section>
      <div>
        <button type="button" className="tt-button" onClick={() => shellStore.getState().setLens("tree")}>
          <T k="family.openInTree" />
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- sources */

export function usedSources(b: Bundle): UsedSource[] {
  const map = new Map<string, { retrieved: Set<string>; locators: Set<string> }>();
  const add = (id: string, retrieved: string | null | undefined, locator: string) => {
    const e = map.get(id) ?? { retrieved: new Set(), locators: new Set() };
    if (retrieved) e.retrieved.add(retrieved.slice(0, 10));
    e.locators.add(locator);
    map.set(id, e);
  };
  add(b.languoid.source_id, b.languoid.retrieved_at, b.languoid.locator);
  for (const n of nameRows(b)) add(n.source_id, n.retrieved_at, n.locator);
  for (const s of b.speakers ?? []) add(s.source_id, s.retrieved_at, s.locator);
  for (const t of b.territories ?? []) add(t.source_id, t.retrieved_at, t.locator_template);
  for (const x of b.xrefs ?? []) add(x.source_id, x.retrieved_at, x.locator);
  return [...map.entries()].map(([id, e]) => ({
    id,
    info: b.sources[id] ?? null,
    retrieved: [...e.retrieved].sort(),
    locators: [...e.locators],
  }));
}
