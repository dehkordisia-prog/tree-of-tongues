// World view (spec 4.5) and the not-found and failed-load states (4.7).

import { useRevalidator } from "react-router";

import type { DeeperCard } from "@/data/deeper";
import type { EntityMissing } from "@/data/entity";
import { shellStore, useShell } from "@/state/shell";
import type { Tab } from "@/state/url";

import { T, useT } from "../T";
import { OverviewProfile, profileTabs } from "./LanguageInspector";
import { GoDeeper, InspectorHeader, InspectorTabs, type TabDef } from "./parts";
import {
  ProfileHook,
  ProfileProvider,
  ProfileSections,
  ProfileSources,
  ProfileStatus,
} from "./profile/Profile";

export function WorldInspector({ deeper }: { deeper: DeeperCard[] }) {
  return (
    <article>
      <WorldHeading />
      <T as="p" k="welcome.body" className="mt-3" />
      <T as="p" k="welcome.keyboard" className="mt-2 text-small text-ink-muted" />
      <GoDeeper cards={deeper} />
    </article>
  );
}

function WorldHeading() {
  const t = useT();
  return <InspectorHeader path="/" level="world" name={t("welcome.title")} copy={false} />;
}

export function MissingInspector({ data }: { data: EntityMissing }) {
  const revalidator = useRevalidator();
  const busy = revalidator.state === "loading";
  if (data.status === "not-found") {
    return (
      <article>
        <InspectorHeader
          path={`/${data.kind}/${data.glottocode}`}
          level={data.kind}
          name={data.glottocode}
          copy={false}
        />
        <div role="alert" className="mt-4 rounded-md border border-line-strong p-4">
          <T as="p" k="error.notFound" o={{ code: data.glottocode }} className="font-semibold" />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="tt-button"
              onClick={() => shellStore.getState().openPalette(data.glottocode)}
            >
              <T k="error.search" />
            </button>
            <button
              type="button"
              className="tt-button"
              onClick={() => shellStore.getState().select(null, { source: "deeper" })}
            >
              <T k="error.world" />
            </button>
          </div>
        </div>
        <GoDeeper cards={data.deeper} />
      </article>
    );
  }
  const content = data.kind === "language" && (data.profile || data.lump);
  return (
    <ProfileProvider profile={data.profile}>
      <article aria-busy={busy} data-entity={data.glottocode}>
        <InspectorHeader
          path={`/${data.kind}/${data.glottocode}`}
          level={data.kind}
          name={data.label ?? data.glottocode}
          copy={false}
        />
        {data.profile && <ProfileStatus profile={data.profile} />}
        <div role="alert" className="mt-4 rounded-md border border-danger p-4">
          <T as="p" k="error.bundle" className="font-semibold" />
          <button
            type="button"
            className="tt-button mt-3"
            disabled={busy}
            onClick={() => revalidator.revalidate()}
          >
            <T k="error.retry" />
          </button>
        </div>
        {content ? <ContentOnlyTabs data={data} /> : <GoDeeper cards={data.deeper} />}
      </article>
    </ProfileProvider>
  );
}

/**
 * The data bundle did not load (or data/build is absent, as in CI), but the profile and the
 * lumper note live in content/: show them, on the tabs that have something to show.
 */
function ContentOnlyTabs({ data }: { data: EntityMissing }) {
  const tab = useShell((s) => s.tab) as Tab;
  const p = data.profile;
  const tabs: TabDef[] = [
    {
      id: "overview",
      panel: (
        <>
          {p?.hook && <ProfileHook section={p.hook} />}
          <OverviewProfile data={data} />
        </>
      ),
    },
    ...(p ? profileTabs(p).filter((x) => p.tabs[x.id as "writing"].length > 0) : []),
    ...(p && p.tabs.family.length
      ? [{ id: "family" as const, panel: <ProfileSections sections={p.tabs.family} /> }]
      : []),
    ...(p && p.sources.length ? [{ id: "sources" as const, panel: <ProfileSources profile={p} /> }] : []),
  ];
  return (
    <div className="mt-4">
      <InspectorTabs
        active={tab}
        tabs={tabs.map((x) => ({
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
  );
}
