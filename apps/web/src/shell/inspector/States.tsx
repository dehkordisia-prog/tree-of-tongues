// World view (spec 4.5) and the not-found and failed-load states (4.7).

import { useRevalidator } from "react-router";

import type { DeeperCard } from "@/data/deeper";
import type { EntityMissing } from "@/data/entity";
import { shellStore } from "@/state/shell";

import { T, useT } from "../T";
import { GoDeeper, InspectorHeader } from "./parts";

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
  return (
    <article aria-busy={busy}>
      <InspectorHeader
        path={`/${data.kind}/${data.glottocode}`}
        level={data.kind}
        name={data.label ?? data.glottocode}
        copy={false}
      />
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
      <GoDeeper cards={data.deeper} />
    </article>
  );
}
