import { useId, type KeyboardEvent } from "react";

import { Txt } from "./Panels";
import { S } from "./strings";

export const MIN_YEAR = 1500;

/** Today's year. The slider has no historical layers in Phase 0, so only this year has data. */
export const PRESENT_YEAR = new Date().getFullYear();

export function isPresent(year: number): boolean {
  return year === PRESENT_YEAR;
}

interface Props {
  year: number;
  onChange(year: number): void;
}

/**
 * Stub of the Time scrub (docs/SPEC.md section 3). A native range input: arrow keys step one year,
 * Home and End jump to the ends, Page Up and Page Down jump a century (docs/DESIGN.md). In a right to
 * left page the browser mirrors the track, so time runs in the reading direction.
 */
export function TimeSlider({ year, onChange }: Props) {
  const id = useId();
  const clamp = (y: number) => Math.min(PRESENT_YEAR, Math.max(MIN_YEAR, y));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      onChange(clamp(year + (e.key === "PageUp" ? 100 : -100)));
    }
  };

  const present = isPresent(year);
  return (
    <div className="flex flex-col gap-1 px-gutter py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <label htmlFor={id} className="text-small font-semibold">
          <Txt>{S.timeLabel}</Txt>
        </label>
        <output htmlFor={id} className="min-w-[5ch] text-body tabular-nums" lang="en" dir="ltr">
          {year}
        </output>
        <input
          id={id}
          type="range"
          min={MIN_YEAR}
          max={PRESENT_YEAR}
          step={1}
          value={year}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          onKeyDown={onKeyDown}
          aria-describedby={`${id}-help`}
          aria-valuetext={present ? `${S.timePresent}, ${year}` : `${year}. ${S.timeNoData}`}
          className="h-target min-w-40 flex-1 cursor-pointer accent-link"
        />
        <button
          type="button"
          onClick={() => onChange(PRESENT_YEAR)}
          disabled={present}
          className="min-h-target rounded-md border border-line-strong bg-surface px-3 text-small hover:bg-raised disabled:cursor-default disabled:opacity-60"
        >
          <Txt>{S.timePresent}</Txt>
        </button>
      </div>
      <Txt as="p" id={`${id}-help`} className="text-caption text-ink-muted">
        {S.timeHelp}
      </Txt>
      <div role="status" className="min-h-[2.5rem] text-small">
        {present ? null : (
          <Txt as="p">
            <strong className="text-accent">{S.timeNoData}</strong> <span className="text-ink-muted">{S.timeNoDataDetail}</span>
          </Txt>
        )}
      </div>
    </div>
  );
}
