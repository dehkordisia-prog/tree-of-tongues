// Citation chip (spec 4.6): the source short name and year always visible beside a number; details in
// a Radix Popover that opens on click, tap, Enter or Space, and on hover after 300 ms for fine
// pointers. Hoverable, persistent and dismissable with Esc (WCAG 1.4.13). 44 px hit area.

import { Popover } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ConfidenceChip, type Confidence } from "@/design/Badge";

import { T, useT } from "../T";

export interface CiteRow {
  /** Bold first line, for example the figure: "76,795,640". */
  value?: string;
  source: string;
  year: string | null;
  kind?: string;
  method?: string | null;
  statedIn?: { label: string; url: string | null } | null;
  /** Wikidata row without any reference. */
  noReference?: boolean;
  rank?: string;
  locator: string;
  retrieved: string;
  license: string | null;
  confidence: Confidence | string;
  notes?: string | null;
  url?: string | null;
}

export function CitationChip({ short, what, rows }: { short: string; what: string; rows: CiteRow[] }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const t = useT();
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clear();
    timer.current = window.setTimeout(() => setOpen(true), 300);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    clear();
    timer.current = window.setTimeout(() => setOpen(false), 200);
  };
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        clear(); // a pending hover timer must not reopen what a click or Esc just closed
        setOpen(o);
      }}
    >
      <Popover.Trigger
        className="tt-chip relative inline-flex items-center rounded-sm px-1 text-small text-ink-muted underline decoration-dotted underline-offset-4 hover:text-ink"
        aria-label={`${short}. ${t("cite.details", { what })}`}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        data-citation=""
      >
        {short}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          collisionPadding={12}
          sideOffset={4}
          onPointerEnter={clear}
          onPointerLeave={hoverClose}
          className="tt-popover z-50 max-h-[min(70dvh,32rem)] w-[min(92vw,24rem)] overflow-auto rounded-md border border-line-strong bg-raised p-4 text-small shadow-overlay"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{what}</p>
            <Popover.Close className="tt-icon-button -me-2 -mt-2" aria-label={t("cite.close")}>
              ×
            </Popover.Close>
          </div>
          <ul className="mt-2 grid gap-3">
            {rows.map((r, i) => (
              <li key={i} className="border-t border-line pt-2 first:border-t-0 first:pt-0">
                <CiteDetails row={r} />
              </li>
            ))}
          </ul>
          <Popover.Arrow className="fill-[var(--tt-line-strong)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Row({ k, children }: { k: Parameters<typeof T>[0]["k"]; children: ReactNode }) {
  return (
    <>
      <T as="dt" k={k} className="text-ink-muted" />
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

function CiteDetails({ row }: { row: CiteRow }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {row.value && <Row k="cite.value">{row.value}</Row>}
      <Row k="cite.source">
        {row.url ? (
          <a href={row.url} rel="noreferrer noopener" target="_blank">
            {row.source}
          </a>
        ) : (
          row.source
        )}
      </Row>
      <Row k="cite.year">{row.year ?? <T k="cite.noYear" />}</Row>
      {row.kind && <Row k="cite.kind">{row.kind}</Row>}
      {row.method && (
        <Row k="cite.method">
          <span dir="ltr" className="font-mono text-caption">
            {row.method}
          </span>
        </Row>
      )}
      {row.rank && <Row k="cite.rank">{row.rank}</Row>}
      {row.noReference ? (
        <Row k="cite.statedIn">
          <T k="cite.noReference" />
        </Row>
      ) : row.statedIn ? (
        <Row k="cite.statedIn">
          {row.statedIn.url ? (
            <a href={row.statedIn.url} rel="noreferrer noopener" target="_blank" dir="ltr">
              {row.statedIn.label}
            </a>
          ) : (
            <span dir="ltr">{row.statedIn.label}</span>
          )}
        </Row>
      ) : null}
      <Row k="cite.locator">
        <code dir="ltr" className="break-all text-caption">
          {row.locator}
        </code>
      </Row>
      <Row k="cite.retrieved">
        <span dir="ltr">{row.retrieved}</span>
      </Row>
      <Row k="cite.license">{row.license ?? <T k="glance.noData" />}</Row>
      <Row k="cite.confidence">
        {isConfidence(row.confidence) ? <ConfidenceChip level={row.confidence} /> : row.confidence}
      </Row>
      {row.notes && <Row k="cite.notes">{row.notes}</Row>}
    </dl>
  );
}

function isConfidence(c: string): c is Confidence {
  return c === "high" || c === "medium" || c === "low" || c === "contested";
}
