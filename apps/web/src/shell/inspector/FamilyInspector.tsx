// Inspector for a family (spec 4.3): path, members, Glottolog counts (languoids, never speakers).

import { useId } from "react";
import { Link } from "react-router";

import type { EntityOk } from "@/data/entity";
import { shellStore, useShell } from "@/state/shell";
import { useShellHref } from "@/state/useShellHref";
import type { Tab } from "@/state/url";

import { T, useT } from "../T";
import { CitationChip } from "./Citation";
import { provRow, sourceShort } from "./cite";
import { usedSources } from "./LanguageInspector";
import { EmptyState, GoDeeper, InspectorHeader, InspectorTabs, SectionTitle, SourcesList } from "./parts";

export function FamilyInspector({ data }: { data: EntityOk }) {
  const tab = useShell((s) => s.tab) as Tab;
  const top = data.bundle.lineage[0]?.glottocode ?? data.glottocode;
  const wrap = (panel: React.ReactNode) => (
    <>
      {panel}
      <GoDeeper cards={data.deeper} />
    </>
  );
  return (
    <article data-entity={data.glottocode}>
      <InspectorHeader path={`/family/${data.glottocode}`} level="family" top={top} name={data.label} />
      <div className="mt-4">
        <InspectorTabs
          active={tab}
          tabs={[
            { id: "overview", panel: wrap(<Overview data={data} />) },
            { id: "members", panel: wrap(<Members data={data} />) },
            { id: "where", panel: wrap(<Where data={data} />) },
            { id: "sources", panel: wrap(<SourcesList sources={usedSources(data.bundle)} />) },
          ]}
        />
      </div>
    </article>
  );
}

function Row({ k, children }: { k: Parameters<typeof T>[0]["k"]; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-x-3 border-b border-line py-2 last:border-b-0 max-[400px]:grid-cols-1">
      <T as="dt" k={k} className="text-small text-ink-muted" />
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Overview({ data }: { data: EntityOk }) {
  const t = useT();
  const href = useShellHref();
  const id = useId();
  const b = data.bundle;
  const lineage = data.crumbs.slice(0, -1);
  const glotto = provRow(b, b.languoid);
  const macroareas = (b.languoid.macroarea ?? "").split(";").filter(Boolean);
  return (
    <section aria-labelledby={id}>
      <SectionTitle k="glance.title" id={id} />
      <dl data-testid="at-a-glance">
        <Row k="glance.level">
          <T k="level.family" />
        </Row>
        <Row k="glance.path">
          {lineage.length ? (
            <span className="inline-flex flex-wrap items-center gap-x-1">
              {lineage.map((c, i) => (
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
              ))}
            </span>
          ) : (
            <Link to={href(null)} className="inline-flex min-h-target items-center">
              <T k="crumbs.world" />
            </Link>
          )}
        </Row>
        <Row k="glance.languages">
          {data.counts ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span>
                <T k="glance.languagesCount" o={{ count: data.counts[0] }} />,{" "}
                <T k="glance.dialectsCount" o={{ count: data.counts[1] }} />
              </span>
              <CitationChip
                short={sourceShort(b.languoid.source_id)}
                what={t("glance.languages")}
                rows={[{ ...glotto, notes: t("glance.countsNote") }]}
              />
            </span>
          ) : (
            <T k="glance.noData" className="text-ink-muted" />
          )}
        </Row>
        <Row k="glance.macroareas">
          {macroareas.length ? (
            <span className="inline-flex flex-wrap items-baseline gap-x-2">
              <span>{macroareas.join(", ")}</span>
              <CitationChip
                short={sourceShort(b.languoid.source_id)}
                what={t("glance.macroareas")}
                rows={[glotto]}
              />
            </span>
          ) : (
            <T k="glance.noData" className="text-ink-muted" />
          )}
        </Row>
        <Row k="glance.speakers">
          <T k="speakers.familyNote" className="text-small" />
        </Row>
        {data.inAtlas !== null && (
          <Row k="profile.badge">
            <T k="glance.inAtlas" o={{ count: data.inAtlas }} />
          </Row>
        )}
        <Row k="glance.codes">
          <span dir="ltr">
            Glottocode:{" "}
            <a
              href={`https://glottolog.org/resource/languoid/id/${data.glottocode}`}
              rel="noreferrer noopener"
              target="_blank"
              className="inline-flex min-h-target items-center"
            >
              {data.glottocode}
            </a>
            {b.languoid.wikidata_qid && (
              <>
                {" · "}Wikidata:{" "}
                <a
                  href={`https://www.wikidata.org/wiki/${b.languoid.wikidata_qid}`}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="inline-flex min-h-target items-center"
                >
                  {b.languoid.wikidata_qid}
                </a>
              </>
            )}
          </span>
        </Row>
      </dl>
    </section>
  );
}

function Members({ data }: { data: EntityOk }) {
  const href = useShellHref();
  const items = data.bundle.children.items;
  const scope = new Set(data.inScope);
  if (!items.length) return <EmptyState title="empty.members" why="empty.membersWhy" />;
  return (
    <div>
      <ul className="grid" data-testid="members">
        {items.map(([g, name, level]) => (
          <li key={g} className="flex flex-wrap items-center gap-x-2">
            <Link
              to={href({ kind: level === "family" ? "family" : "language", glottocode: g })}
              className="inline-flex min-h-target items-center"
            >
              <bdi>{name}</bdi>
            </Link>
            <T
              k={`levelLower.${level === "family" ? "family" : level === "dialect" ? "dialect" : "language"}`}
              className="text-caption text-ink-muted"
            />
            {scope.has(g) && (
              <T k="profile.badge" className="rounded-pill border border-line-strong px-2 text-caption" />
            )}
          </li>
        ))}
      </ul>
      {data.bundle.children.total > items.length && (
        <T
          as="p"
          k="family.shown"
          o={{ shown: items.length, total: data.bundle.children.total }}
          className="mt-2 text-small text-ink-muted"
        />
      )}
    </div>
  );
}

function Where({ data }: { data: EntityOk }) {
  const macroareas = (data.bundle.languoid.macroarea ?? "").split(";").filter(Boolean);
  const button = (
    <button type="button" className="tt-button" onClick={() => shellStore.getState().setLens("map")}>
      <T k="where.showOnMap" />
    </button>
  );
  if (!macroareas.length)
    return (
      <EmptyState title="empty.familyWhere" why="empty.familyWhereWhy">
        {button}
      </EmptyState>
    );
  return (
    <div className="grid gap-3">
      <SectionTitle k="glance.macroareas" />
      <p>{macroareas.join(", ")}</p>
      <div>{button}</div>
    </div>
  );
}
