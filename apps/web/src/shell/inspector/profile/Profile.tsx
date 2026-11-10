// Profile prose in the Inspector (content/languages/{glottocode}.md, parsed at build time by
// src/data/profile/profile.ts). This file only walks the JSON tree: no Markdown code ships.
//
//   - Citations are numbered chips with the shared popover (author, title, year, link, access).
//   - TODO(verify) arrives as an Unverified chip that links to the explanation above the tabs.
//   - Arabic-script spans get lang="fa" dir="rtl" in <bdi>; transcriptions get lang="und-fonipa".
//   - The prose is English for now, so its container says lang="en" dir="ltr" in every interface.

import type { ParseKeys } from "i18next";
import { createContext, useContext, useId, type ReactNode } from "react";
import { Link } from "react-router";

import type { Block, Inline, Profile, ProfileSource, Section } from "@/data/profile/types";
import { directionOf } from "@/i18n/direction";
import { useShellHref } from "@/state/useShellHref";
import { parseSelection } from "@/state/url";

import { T, useT } from "../../T";
import { CitePopover } from "../Citation";
import { SectionTitle } from "../parts";

export const UNVERIFIED_ID = "profile-unverified";

const SourcesCtx = createContext<Map<number, ProfileSource>>(new Map());

export function ProfileProvider({ profile, children }: { profile: Profile | null; children: ReactNode }) {
  const map = new Map((profile?.sources ?? []).map((s) => [s.n, s]));
  return <SourcesCtx.Provider value={map}>{children}</SourcesCtx.Provider>;
}

/* ------------------------------------------------------------ status */

/** Draft banner and the Unverified explanation, above the tabs so every tab shares them. */
export function ProfileStatus({ profile }: { profile: Profile }) {
  const t = useT();
  const pending = profile.reviews.filter(
    (r) => !/^(done|approved|pass|passed|complete|completed)$/i.test(r.status),
  );
  const roleName = (role: string) => {
    const k = `profile.role.${role}` as ParseKeys;
    const v = t(k);
    return v === k ? role : v;
  };
  if (!profile.draft && profile.unverified === 0) return null;
  return (
    <div className="mt-4 grid gap-2" data-testid="profile-status">
      {profile.draft && (
        <div
          role="note"
          className="rounded-md border-2 border-dashed border-conf-low bg-raised p-3"
          data-testid="draft-banner"
        >
          <T as="p" k="profile.draft" className="font-semibold" />
          {pending.length > 0 && (
            <T
              as="p"
              k="profile.reviewsPending"
              o={{ list: pending.map((r) => roleName(r.role)).join(", ") }}
              className="mt-1 text-small text-ink-muted"
            />
          )}
        </div>
      )}
      {profile.unverified > 0 && (
        <div
          id={UNVERIFIED_ID}
          tabIndex={-1}
          className="rounded-md border border-line p-3 text-small outline-offset-2"
        >
          <T as="p" k="profile.unverifiedTitle" className="font-semibold" />
          <T
            as="p"
            k="profile.unverifiedWhy"
            o={{ count: profile.unverified }}
            className="mt-1 text-ink-muted"
          />
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- inlines */

function UnverifiedChip() {
  const t = useT();
  return (
    <a
      href={`#${UNVERIFIED_ID}`}
      aria-label={t("profile.unverifiedName")}
      data-unverified=""
      onClick={(e) => {
        // Scroll to the explanation without a hash navigation (the router owns the URL).
        e.preventDefault();
        const el = document.getElementById(UNVERIFIED_ID);
        el?.scrollIntoView({ block: "nearest" });
        el?.focus({ preventScroll: true });
      }}
      className="tt-hit mx-0.5 inline-flex items-center rounded-sm border border-dashed border-conf-low px-1.5 align-baseline text-caption font-semibold text-ink no-underline hover:bg-raised"
    >
      {t("profile.unverified")}
    </a>
  );
}

function ProfileCite({ n, loc }: { n: number; loc: string | null }) {
  const t = useT();
  const src = useContext(SourcesCtx).get(n);
  const title = src?.title ?? src?.key ?? String(n);
  return (
    <CitePopover
      kind="profile"
      label={<span aria-hidden="true">[{n}]</span>}
      ariaLabel={t("profile.citeName", { n, title })}
      title={t("profile.cite", { n })}
      triggerClassName="tt-hit inline-flex items-center rounded-sm px-0.5 align-baseline text-caption text-link hover:underline"
    >
      {src && <SourceDetails src={src} loc={loc} />}
    </CitePopover>
  );
}

function SourceRow({ k, children }: { k: ParseKeys; children: ReactNode }) {
  return (
    <>
      <T as="dt" k={k} className="text-ink-muted" />
      <dd className="min-w-0 break-words" dir="auto">
        {children}
      </dd>
    </>
  );
}

function SourceDetails({ src, loc }: { src: ProfileSource; loc?: string | null }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {src.author && <SourceRow k="profile.author">{src.author}</SourceRow>}
      {src.title && (
        <SourceRow k="profile.title">
          <Inlines nodes={src.titleInline} />
        </SourceRow>
      )}
      <SourceRow k="cite.year">{src.year ?? <T k="cite.noYear" />}</SourceRow>
      {src.container && <SourceRow k="profile.published">{src.container}</SourceRow>}
      {src.publisher && <SourceRow k="profile.publisher">{src.publisher}</SourceRow>}
      {loc !== undefined && <SourceRow k="cite.locator">{loc ?? <T k="profile.noLocator" />}</SourceRow>}
      {src.url && (
        <SourceRow k="profile.link">
          <a href={src.url} rel="noreferrer noopener" target="_blank" dir="ltr" className="break-all">
            {src.url}
          </a>
        </SourceRow>
      )}
      {src.retrieved && (
        <SourceRow k="cite.retrieved">
          <span dir="ltr">{src.retrieved}</span>
        </SourceRow>
      )}
      <SourceRow k="profile.access">
        <span data-access={src.access}>
          <T k={`profile.accessValue.${src.access}` as ParseKeys} />
        </span>
      </SourceRow>
      {src.note.length > 0 && (
        <SourceRow k="cite.notes">
          <Inlines nodes={src.note} />
        </SourceRow>
      )}
    </dl>
  );
}

function InternalOrExternal({ href, children }: { href: string; children: ReactNode }) {
  const shellHref = useShellHref();
  if (href.startsWith("/")) {
    const [path] = href.split(/[?#]/);
    const { selection, isShell } = parseSelection(path ?? href);
    if (isShell && selection) return <Link to={shellHref(selection)}>{children}</Link>;
    return <a href={href}>{children}</a>;
  }
  return (
    <a href={href} rel="noreferrer noopener" target="_blank">
      {children}
    </a>
  );
}

export function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (typeof n === "string") return n;
        switch (n.t) {
          case "em":
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            );
          case "strong":
            return (
              <strong key={i}>
                <Inlines nodes={n.c} />
              </strong>
            );
          case "code":
            return (
              <code key={i} className="text-small">
                {n.v}
              </code>
            );
          case "link":
            return (
              <InternalOrExternal key={i} href={n.href}>
                <Inlines nodes={n.c} />
              </InternalOrExternal>
            );
          case "cite":
            return <ProfileCite key={i} n={n.n} loc={n.loc} />;
          case "unverified":
            return <UnverifiedChip key={i} />;
          case "fa":
            return (
              <bdi key={i} lang="fa" dir={directionOf("fa")}>
                {n.v}
              </bdi>
            );
          case "ipa":
            return (
              <span key={i} lang="und-fonipa" className="font-ipa">
                {n.v}
              </span>
            );
          case "br":
            return <br key={i} />;
        }
      })}
    </>
  );
}

/* ------------------------------------------------------------ blocks */

/** A list item that is one paragraph renders its text directly (no <p> inside the <li>). */
function Item({ blocks }: { blocks: Block[] }) {
  const only = blocks.length === 1 ? blocks[0] : null;
  if (only?.t === "p") return <Inlines nodes={only.c} />;
  return <Blocks blocks={blocks} />;
}

function Blocks({ blocks, section }: { blocks: Block[]; section?: string }) {
  const t = useT();
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case "h": {
            const Tag = `h${Math.min(6, Math.max(3, b.level))}` as "h3";
            return (
              <Tag key={i} id={b.id} className="mt-5 font-display text-body font-semibold">
                <Inlines nodes={b.c} />
              </Tag>
            );
          }
          case "p":
            return (
              <p key={i}>
                <Inlines nodes={b.c} />
              </p>
            );
          case "list": {
            const items = b.items.map((it, k) => (
              <li key={k}>
                <Item blocks={it} />
              </li>
            ));
            return b.ordered ? (
              <ol key={i} start={b.start === 1 ? undefined : b.start} className="list-decimal ps-6">
                {items}
              </ol>
            ) : (
              <ul key={i} className="list-disc ps-6">
                {items}
              </ul>
            );
          }
          case "table":
            return (
              <div
                key={i}
                className="tt-table-scroll overflow-x-auto"
                role="region"
                aria-label={t("profile.table", { section: section ?? "" })}
                tabIndex={0}
              >
                <table className="w-full border-collapse text-small">
                  <thead>
                    <tr>
                      {b.head.map((c, k) => (
                        <th
                          key={k}
                          scope="col"
                          className="border-b border-line-strong py-1 pe-3 text-start align-bottom font-semibold"
                        >
                          <Inlines nodes={c} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {b.rows.map((r, k) => (
                      <tr key={k} className="border-b border-line align-baseline">
                        {r.map((c, m) => (
                          <td key={m} className="py-1 pe-3">
                            <Inlines nodes={c} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-s-4 border-line-strong ps-4 italic">
                <Blocks blocks={b.c} section={section} />
              </blockquote>
            );
          case "hr":
            return <hr key={i} className="border-line" />;
        }
      })}
    </>
  );
}

export function ProfileSection({ section, title }: { section: Section; title?: ParseKeys }) {
  return (
    <section
      aria-labelledby={section.id}
      className="tt-prose mt-6 first:mt-0"
      lang="en"
      dir="ltr"
      data-profile-section={section.id}
    >
      {title ? (
        <T as="h2" id={section.id} k={title} className="mb-2 font-display text-title-sm" />
      ) : (
        <h2 id={section.id} className="mb-2 font-display text-title-sm">
          {section.title}
        </h2>
      )}
      <Blocks blocks={section.blocks} section={section.title} />
    </section>
  );
}

/** The Hook (SPEC 5, item 1): one lead paragraph at the top of Overview, without its editorial heading. */
export function ProfileHook({ section }: { section: Section }) {
  return (
    <div className="tt-prose mb-6 text-lead" lang="en" dir="ltr" data-testid="profile-hook">
      <Blocks blocks={section.blocks} section={section.title} />
    </div>
  );
}

export function ProfileSections({ sections }: { sections: Section[] }) {
  if (!sections.length) return null;
  return (
    <div className="mb-6 grid" data-testid="profile-prose">
      {sections.map((s) => (
        <ProfileSection key={s.id} section={s} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- sources */

export function ProfileSources({ profile }: { profile: Profile }) {
  const id = useId();
  if (!profile.sources.length) return null;
  return (
    <section aria-labelledby={id} className="mb-8" data-testid="profile-sources">
      <SectionTitle k="profile.sourcesTitle" id={id} />
      <T as="p" k="profile.sourcesIntro" className="text-small text-ink-muted" />
      <ol className="mt-3 grid gap-3" lang="en" dir="ltr">
        {profile.sources.map((s) => (
          <li
            key={s.key}
            id={`profile-source-${s.n}`}
            className="rounded-md border border-line p-3 text-small"
          >
            <p className="font-semibold">
              <span className="me-2 text-ink-muted">[{s.n}]</span>
              {s.title ? <Inlines nodes={s.titleInline} /> : s.key}
            </p>
            <SourceDetails src={s} />
            {s.locators.length > 0 && (
              <p className="mt-1">
                <T k="sources.used" className="text-ink-muted" />: {s.locators.join("; ")}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
