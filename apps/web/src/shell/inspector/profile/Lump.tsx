// "Why linguists disagree" (docs/specs/app-shell.md 4.2, 6.2, 6.4; D-022, D-023): the scope list's
// inspector_note, the group label as the scope list words it, the members as links, and the
// Split or Grouped control. The control writes ?lump=<group> with a history push. In Phase 1 round 2
// it changes only this panel and the URL; the tree and map views of a group come later, and the
// panel says so.

import { RadioGroup } from "radix-ui";
import { useId } from "react";
import { Link } from "react-router";

import type { LumpInfo } from "@/data/entity";
import { shellStore, useShell } from "@/state/shell";
import { useShellHref } from "@/state/useShellHref";
import { isLumpGroup } from "@/state/url";

import { T, useT } from "../../T";
import { EmptyState, SectionTitle } from "../parts";

/**
 * The scope list labels mix reader-facing text with notes to editors ("Do not label this group
 * with ISO msa"). Sentences that are instructions to editors are left out of the UI.
 */
export function labelSentences(label: string | null): string[] {
  if (!label) return [];
  return label
    .split(/(?<=\.)\s+|;\s+(?=Do not\b)/)
    .map((s) => s.trim())
    .filter((s) => s && !/^Do not\b/i.test(s));
}

export function LumpSlot({ lump, glottocode }: { lump: LumpInfo; glottocode: string }) {
  const id = useId();
  const t = useT();
  const href = useShellHref();
  const lumped = useShell((s) => s.lumped);
  const group = lump.group;
  const grouped = isLumpGroup(group) && lumped.includes(group);
  const sentences = labelSentences(lump.label);
  const members = (
    <ul className="flex flex-wrap gap-x-3" lang="en" dir="ltr">
      {lump.members.map((m) => (
        <li key={m.g}>
          {m.g === glottocode ? (
            <span className="inline-flex min-h-target items-center font-semibold" aria-current="page">
              <bdi>{m.label}</bdi>
              <span className="ms-1 font-normal text-ink-muted">
                (<T k="lump.thisPage" />)
              </span>
            </span>
          ) : (
            <Link
              to={href({ kind: "language", glottocode: m.g })}
              className="inline-flex min-h-target items-center"
            >
              <bdi>{m.label}</bdi>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <section
      aria-labelledby={id}
      className="mt-6"
      data-testid="lump-slot"
      data-group={group}
      data-grouped={grouped ? "" : undefined}
    >
      <SectionTitle k="macro.heading" id={id} />
      {lump.note ? (
        <p lang="en" dir="ltr">
          {lump.note}
        </p>
      ) : (
        <EmptyState title="empty.explanation" why="empty.explanationWhy" />
      )}
      <dl className="mt-3 grid gap-y-1 text-small">
        <T as="dt" k="lump.grouping" className="text-ink-muted" />
        <dd lang="en" dir="ltr" data-testid="lump-label">
          {sentences.map((s, i) => (
            <span key={i}>
              {i > 0 && " "}
              {s}
            </span>
          ))}
        </dd>
        <T as="dt" k="lump.members" className="mt-1 text-ink-muted" />
        <dd>{members}</dd>
      </dl>
      {lump.ownerDecision === "pending" && (
        <T
          as="p"
          k="lump.ownerPending"
          className="mt-2 text-small text-ink-muted"
          data-testid="owner-pending"
        />
      )}
      {isLumpGroup(group) && (
        <div className="mt-3">
          <T as="p" k="lump.control" id={`${id}-control`} className="text-small font-semibold" />
          <RadioGroup.Root
            aria-labelledby={`${id}-control`}
            value={grouped ? "grouped" : "split"}
            onValueChange={(v) => {
              const on = v === "grouped";
              shellStore.getState().setLumped(group, on);
              shellStore.getState().announce(t(on ? "lump.announceGrouped" : "lump.announceSplit"));
            }}
            className="mt-1 flex flex-wrap gap-2"
          >
            {(["split", "grouped"] as const).map((v) => (
              <RadioGroup.Item
                key={v}
                value={v}
                className="tt-button inline-flex items-center gap-2 data-[state=checked]:border-accent data-[state=checked]:font-semibold"
              >
                <span
                  aria-hidden="true"
                  className="inline-block size-3 rounded-full border border-current data-[on]:bg-accent"
                  data-on={(v === "grouped") === grouped ? "" : undefined}
                />
                <T k={v === "split" ? "lump.split" : "lump.grouped"} />
              </RadioGroup.Item>
            ))}
          </RadioGroup.Root>
          <T as="p" k={grouped ? "lump.viewGrouped" : "lump.viewSplit"} className="mt-2 text-small" />
          <T as="p" k="lump.later" className="mt-1 text-small text-ink-muted" />
        </div>
      )}
    </section>
  );
}
