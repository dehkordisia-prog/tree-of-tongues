// The legend for the speaker glyph (docs/specs/app-shell.md 5.3). Real HTML text with a small
// drawn sample beside each line; the text carries every fact, the samples are decoration (aria-hidden).
// Copy is English and lives here until the shell moves it into the locale files.

import { useId, useState } from "react";

import { formatFigureRange } from "./describe";
import { GLYPH_MIN_FIGURE, GLYPH_SCALE, glyphRadius } from "./glyph";

const million = (n: number) => formatFigureRange(n, n);

export const LEGEND_COPY = {
  toggle: "Legend",
  title: "How to read a language circle",
  disc: "Inner disc: first-language speakers (L1), drawn at the lowest figure.",
  ring: "Ring: total speakers, drawn at the lowest figure.",
  band: "Translucent band: sources disagree. It runs from the lowest to the highest figure of that kind.",
  dashed: "Dashed ring: speakers, kind not stated. Shown only when there is no first-language or total figure.",
  dotted: "Dotted ring: no speaker figure we can draw yet. Its size means nothing.",
  family: "Families show no speaker total. We never add up figures across languages.",
  estimates: "Speaker numbers are estimates from Wikidata, each with its source and year. We show the range and never average. Open a language to see every source.",
  packing: "Where a circle sits and how big its space is follow the tree: the number of entries below, not speakers.",
  area: (full: string, min: string) =>
    `Inside its own space, a disc grows with speakers: area is proportional to the figure. ${full} or more fills the space. Figures under ${min} share the smallest size.`,
  sample: {
    full: "100 million or more",
    ten: "10 million",
    small: "under the minimum",
  },
} as const;

const S = 22; // sample box, px
const C = S / 2;
const unit = S / 2 - 1; // slot radius in the sample

function Sample({ children }: { children: React.ReactNode }) {
  return (
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden="true" className="shrink-0 text-ink">
      <circle cx={C} cy={C} r={unit} fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.5} strokeWidth={1} />
      {children}
    </svg>
  );
}

export function TreeLegend({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const panelId = useId();
  const full = million(GLYPH_SCALE.FULL_AT);
  const min = million(GLYPH_MIN_FIGURE);
  const r = (v: number) => glyphRadius(v) * unit;
  const row = "flex items-start gap-2";
  return (
    <div className="absolute bottom-4 start-4 flex max-h-[calc(100%-2rem)] max-w-[calc(100%-2rem)] flex-col items-start gap-2">
      {open && (
        <section
          id={panelId}
          aria-label={LEGEND_COPY.title}
          data-testid="tree-legend"
          tabIndex={0}
          className="min-h-0 max-h-[60vh] w-80 max-w-full overflow-auto rounded-md border border-line bg-surface p-3 text-small shadow-overlay"
        >
          <h2 className="mb-2 font-semibold">{LEGEND_COPY.title}</h2>
          <ul className="flex flex-col gap-2">
            <li className={row}>
              <Sample>
                <circle cx={C} cy={C} r={r(30_000_000)} fill="currentColor" fillOpacity={0.9} />
              </Sample>
              <span>{LEGEND_COPY.disc}</span>
            </li>
            <li className={row}>
              <Sample>
                <circle cx={C} cy={C} r={r(30_000_000)} fill="none" stroke="currentColor" strokeWidth={1.5} />
              </Sample>
              <span>{LEGEND_COPY.ring}</span>
            </li>
            <li className={row}>
              <Sample>
                <circle
                  cx={C}
                  cy={C}
                  r={(r(30_000_000) + r(60_000_000)) / 2}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeWidth={r(60_000_000) - r(30_000_000)}
                />
                <circle cx={C} cy={C} r={r(30_000_000)} fill="none" stroke="currentColor" strokeWidth={1.5} />
              </Sample>
              <span>{LEGEND_COPY.band}</span>
            </li>
            <li className={row}>
              <Sample>
                <circle cx={C} cy={C} r={r(30_000_000)} fill="none" stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 2" />
              </Sample>
              <span>{LEGEND_COPY.dashed}</span>
            </li>
            <li className={row}>
              <Sample>
                <circle cx={C} cy={C} r={GLYPH_SCALE.MIN_R * unit} fill="none" stroke="currentColor" strokeWidth={1} strokeDasharray="1 1.6" />
              </Sample>
              <span>{LEGEND_COPY.dotted}</span>
            </li>
          </ul>
          <p className="mt-3">{LEGEND_COPY.packing}</p>
          <p className="mt-2">{LEGEND_COPY.area(full, min)}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-ink-muted" aria-label="Size reference">
            {(
              [
                [LEGEND_COPY.sample.full, GLYPH_SCALE.FULL_AT],
                [LEGEND_COPY.sample.ten, 10_000_000],
                [LEGEND_COPY.sample.small, 1],
              ] as const
            ).map(([label, v]) => (
              <li key={label} className="flex items-center gap-1">
                <Sample>
                  <circle cx={C} cy={C} r={r(v)} fill="currentColor" fillOpacity={0.9} />
                </Sample>
                <span>{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2">{LEGEND_COPY.family}</p>
          <p className="mt-2 text-ink-muted">{LEGEND_COPY.estimates}</p>
        </section>
      )}
      <button
        type="button"
        className="min-h-target shrink-0 rounded-md border border-line-strong bg-surface px-3 text-small"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={onToggle}
        data-testid="tree-legend-toggle"
      >
        {LEGEND_COPY.toggle}
      </button>
    </div>
  );
}

export function useLegend(): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  return [open, () => setOpen((o) => !o)];
}
