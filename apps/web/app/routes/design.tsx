import type { ReactNode } from "react";
import { Link } from "react-router";

import { ConfidenceChip, SoundBadge } from "@/design/Badge";
import { contrast, deltaOk, ratioLabel, simulateCvd, type Cvd } from "@/design/color";
import { FamilyMarker, FamilySwatch } from "@/design/FamilySwatch";
import { MotionDemo } from "@/design/MotionDemo";
import { patternLabel } from "@/design/patterns";
import { ScriptSpecimen } from "@/design/ScriptSpecimen";
import { ThemeToggle, useResolvedTheme } from "@/design/ThemeToggle";
import {
  duration,
  easing,
  families,
  focusRing,
  radius,
  space,
  spring,
  typeScale,
  ui,
  UI_ROLE,
  type ThemeName,
  type UiColor,
} from "@/design/tokens";

export function meta() {
  return [
    { title: "Design system · Tree of Tongues" },
    { name: "description", content: "Living specimen of the Tree of Tongues design tokens." },
  ];
}

const sections = [
  { id: "principles", label: "Principles" },
  { id: "color", label: "Color" },
  { id: "families", label: "Family palette" },
  { id: "color-vision", label: "Color vision" },
  { id: "type", label: "Type" },
  { id: "space", label: "Space and shape" },
  { id: "motion", label: "Motion" },
  { id: "badges", label: "Badges and chips" },
  { id: "focus", label: "Focus and targets" },
  { id: "scripts", label: "Scripts" },
  { id: "deeper", label: "Go deeper" },
] as const;

const themeLabel: Record<ThemeName, string> = { night: "Night", parchment: "Parchment" };

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 border-t border-line pt-10">
      <h2 id={`${id}-h`} className="text-headline">
        {title}
      </h2>
      {intro && <div className="mt-3 max-w-prose text-lead text-ink-muted">{intro}</div>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Ratio({ fg, bg, min }: { fg: string; bg: string; min: number }) {
  const r = contrast(fg, bg);
  return (
    <span className="tabular-nums">
      {ratioLabel(r)}:1{" "}
      <span className={r >= min ? "text-ink-muted" : "font-semibold text-danger"}>
        {r >= min ? `(needs ${min})` : `(below ${min})`}
      </span>
    </span>
  );
}

function UiSwatches({ theme }: { theme: ThemeName }) {
  const t = ui[theme];
  const keys = Object.keys(t) as UiColor[];
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {keys.map((k) => {
        const role = UI_ROLE[k];
        const min = role === "text" ? 4.5 : 3;
        return (
          <li key={k} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
            <span
              aria-hidden="true"
              className="size-10 shrink-0 rounded-md border border-line-strong"
              style={{ backgroundColor: `var(--tt-${kebab(k)})` }}
            />
            <div className="min-w-0 text-small">
              <p className="font-semibold text-ink">
                <code>--tt-{kebab(k)}</code>
              </p>
              <p className="text-ink-muted">
                {t[k]} · {role}
              </p>
              {(role === "text" || role === "mark") && (
                <p className="text-ink-muted">
                  On canvas <Ratio fg={t[k]} bg={t.canvas} min={min} />
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FamilyCards({ theme }: { theme: ThemeName }) {
  const t = ui[theme];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {families.map((fam) => {
        const c = fam.color[theme];
        return (
          <li key={fam.id} className="flex gap-4 rounded-lg border border-line bg-surface p-4 shadow-raised">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <FamilySwatch pattern={fam.pattern} color={`var(--tt-fam-${fam.id})`} size={56} />
              <FamilyMarker marker={fam.marker} color={`var(--tt-fam-${fam.id})`} size={20} />
            </div>
            <div className="min-w-0 text-small">
              <h3 className="text-title-sm" style={{ color: `var(--tt-fam-${fam.id}-ink)` }}>
                {fam.name}
              </h3>
              <p className="text-ink-muted">
                <abbr title={fam.name} className="no-underline">
                  {fam.abbr}
                </abbr>{" "}
                · {fam.hueName} · {patternLabel[fam.pattern]} · {fam.marker.replace("-", " ")} marker
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-ink">
                <dt className="text-ink-muted">Mark</dt>
                <dd>
                  {c.mark} · <Ratio fg={c.mark} bg={t.canvas} min={3} />
                </dd>
                <dt className="text-ink-muted">Ink</dt>
                <dd>
                  {c.ink} · <Ratio fg={c.ink} bg={t.canvas} min={4.5} />
                </dd>
              </dl>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const cvdRows: { kind: Cvd | "typical"; label: string; note: string }[] = [
  { kind: "typical", label: "Typical vision", note: "" },
  { kind: "protanopia", label: "Protanopia", note: "no long-wave (red) cones" },
  { kind: "deuteranopia", label: "Deuteranopia", note: "no medium-wave (green) cones" },
  { kind: "tritanopia", label: "Tritanopia", note: "no short-wave (blue) cones" },
];

function closestPair(theme: ThemeName, kind: Cvd | "typical") {
  const sim = (hex: string) => (kind === "typical" ? hex : simulateCvd(hex, kind));
  let best = { d: Infinity, a: "", b: "" };
  for (let i = 0; i < families.length; i++) {
    for (let j = i + 1; j < families.length; j++) {
      const fa = families[i]!;
      const fb = families[j]!;
      const d = deltaOk(sim(fa.color[theme].mark), sim(fb.color[theme].mark));
      if (d < best.d) best = { d, a: fa.name, b: fb.name };
    }
  }
  return best;
}

function ColorVision({ theme }: { theme: ThemeName }) {
  return (
    <div className="flex flex-col gap-6">
      {cvdRows.map((row) => {
        const pair = closestPair(theme, row.kind);
        return (
          <div key={row.kind}>
            <h3 className="text-title-sm">
              {row.label}
              {row.note && <span className="ms-2 text-small font-normal text-ink-muted">{row.note}</span>}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2" aria-label={`${row.label}, simulated family colors`}>
              {families.map((fam) => {
                const hex = fam.color[theme].mark;
                const shown = row.kind === "typical" ? hex : simulateCvd(hex, row.kind);
                return (
                  <li key={fam.id} className="flex w-12 flex-col items-center gap-1">
                    <FamilySwatch pattern={fam.pattern} color={shown} size={40} />
                    <abbr title={fam.name} className="text-caption text-ink no-underline">
                      {fam.abbr}
                    </abbr>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-small text-ink-muted">
              Closest pair: {pair.a} and {pair.b}, OKLab distance {pair.d.toFixed(3)}.
              {pair.d < 0.08 && " Close enough that the pattern and label carry the difference."}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default function Design() {
  const theme = useResolvedTheme();

  return (
    <div className="mx-auto max-w-7xl px-gutter py-8 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
      {/* Phones: one scrolling row, so the title stays near the top. Desktop: a sticky column. */}
      <nav
        aria-label="On this page"
        className="tt-bidi-plain -mx-gutter mb-6 border-b border-line lg:sticky lg:top-6 lg:mx-0 lg:mb-0 lg:self-start lg:border-0"
      >
        <p className="hidden text-small font-semibold text-ink-muted lg:block">On this page</p>
        <ul className="flex gap-x-1 overflow-x-auto px-gutter whitespace-nowrap lg:mt-2 lg:flex-col lg:overflow-visible lg:px-0">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="inline-flex min-h-target items-center rounded-md px-2 text-small text-ink no-underline hover:bg-surface hover:underline"
              >
                {s.label}
              </a>
            </li>
          ))}
          <li className="shrink-0 lg:mt-4">
            <Link to="/" className="inline-flex min-h-target items-center rounded-md px-2 text-small">
              Back to the start
            </Link>
          </li>
        </ul>
      </nav>

      <main className="tt-bidi-plain min-w-0">
        <header className="flex flex-col gap-4 pb-10">
          <p className="text-small font-semibold uppercase tracking-widest text-accent">Phase 0 workbench</p>
          <h1 className="text-hero">Design system</h1>
          <p className="max-w-prose text-lead text-ink-muted">
            An observatory at night, with a parchment theme for daylight. Every value here comes from{" "}
            <code>src/design/tokens.ts</code>. The contrast numbers are computed on this page, not typed in.
          </p>
          <ThemeToggle />
          <p className="text-small text-ink-muted" aria-live="polite">
            Showing the {themeLabel[theme]} theme.
          </p>
        </header>

        <div className="flex flex-col gap-14">
          <Section id="principles" title="Principles">
            <ul className="grid max-w-4xl gap-4 sm:grid-cols-2">
              {[
                ["Color is never alone", "Every family also has a pattern, a marker shape and a two-letter label."],
                ["Motion explains", "The camera moves to show where you are in the hierarchy. Reduced motion crossfades."],
                ["Text first", "Body text meets 4.5:1. Marks on the canvas meet 3:1. We check both themes in tests."],
                ["Direction neutral", "Logical properties only. A Persian page mirrors without new CSS."],
              ].map(([title, body]) => (
                <li key={title} className="rounded-lg border border-line bg-surface p-4">
                  <h3 className="text-title-sm">{title}</h3>
                  <p className="mt-1 text-ink-muted">{body}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="color"
            title="Color"
            intro={
              <p>
                Surfaces, text and status colors for the {themeLabel[theme]} theme. Ratios are against the canvas
                color. Decorative lines have no contrast requirement and never carry meaning alone.
              </p>
            }
          >
            <UiSwatches theme={theme} />
          </Section>

          <Section
            id="families"
            title="Family palette"
            intro={
              <p>
                Eleven families and one neutral for other families and isolates. The hue logic follows the reference
                chart. Marks are for fills and nodes; inks are for text in the family color.
              </p>
            }
          >
            <FamilyCards theme={theme} />
          </Section>

          <Section
            id="color-vision"
            title="Color vision"
            intro={
              <p>
                The same palette through simulated color vision deficiencies (Machado, Oliveira and Fernandes, 2009,
                full severity). Patterns stay distinct when hues merge.
              </p>
            }
          >
            <ColorVision theme={theme} />
          </Section>

          <Section id="type" title="Type" intro={<p>A serif display face for headings, a humanist sans for UI.</p>}>
            <ul className="flex flex-col divide-y divide-line">
              {(Object.entries(typeScale) as [string, (typeof typeScale)[keyof typeof typeScale]][])
                .slice()
                .reverse()
                .map(([name, step]) => (
                  <li key={name} className="flex flex-col gap-1 py-4 md:flex-row md:items-baseline md:gap-6">
                    <p className="w-44 shrink-0 text-small text-ink-muted">
                      <code>text-{name}</code>
                      <br />
                      {step.px} px · {step.leading} · {step.font}
                    </p>
                    <p
                      className={step.font === "display" ? "font-display" : "font-ui"}
                      style={{ fontSize: step.size, lineHeight: step.leading }}
                    >
                      Families, branches and languages
                    </p>
                  </li>
                ))}
            </ul>
            <p className="mt-4 text-small text-ink-muted">
              IPA uses <code>--font-ipa</code>:{" "}
              <span className="font-ipa text-body text-ink" lang="und-fonipa">
                [ɑ æ ʃ ʒ ŋ ɣ ʔ ˈ ː]
              </span>
            </p>
          </Section>

          <Section id="space" title="Space and shape" intro={<p>A 4 px grid. Radii stay small; the sky is the shape.</p>}>
            <div className="grid gap-8 lg:grid-cols-3">
              <div>
                <h3 className="text-title-sm">Spacing</h3>
                <ul className="mt-3 flex flex-col gap-2">
                  {Object.entries(space).map(([k, px]) => (
                    <li key={k} className="flex items-center gap-3 text-small">
                      <code className="w-16 shrink-0 text-ink-muted">{k}</code>
                      <span aria-hidden="true" className="h-3 rounded-xs bg-accent" style={{ inlineSize: px }} />
                      <span className="text-ink-muted">{px} px</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-title-sm">Radii</h3>
                <ul className="mt-3 grid grid-cols-3 gap-3">
                  {Object.entries(radius).map(([k, px]) => (
                    <li key={k} className="flex flex-col items-center gap-1 text-small">
                      <span
                        aria-hidden="true"
                        className="size-14 border-2 border-line-strong bg-surface"
                        style={{ borderRadius: Math.min(px, 28) }}
                      />
                      <code className="text-ink-muted">{k}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-title-sm">Elevation</h3>
                <ul className="mt-3 flex flex-col gap-3 text-small">
                  <li className="rounded-lg border border-line bg-canvas p-3">Canvas: the sky, flat</li>
                  <li className="rounded-lg border border-line bg-surface p-3 shadow-raised">
                    Surface with <code>shadow-raised</code>: cards
                  </li>
                  <li className="rounded-lg border border-line bg-raised p-3 shadow-overlay">
                    Raised with <code>shadow-overlay</code>: Inspector, palette
                  </li>
                </ul>
              </div>
            </div>
          </Section>

          <Section
            id="motion"
            title="Motion"
            intro={
              <p>
                UI transitions {duration.uiFast} to {duration.uiSlow} ms. Camera flights {duration.flightShort} to{" "}
                {duration.flightLong} ms. Blooms use a spring (stiffness {spring.bloom.stiffness}, damping{" "}
                {spring.bloom.damping}). Nothing loops. Reduced motion turns flights into a {duration.crossfade} ms
                crossfade.
              </p>
            }
          >
            <MotionDemo />
            <h3 className="mt-8 text-title-sm">Easings</h3>
            <ul className="mt-2 grid gap-2 text-small sm:grid-cols-2">
              {Object.entries(easing).map(([k, v]) => (
                <li key={k}>
                  <code>ease-{k}</code> <span className="text-ink-muted">cubic-bezier({v.join(", ")})</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="badges"
            title="Badges and chips"
            intro={
              <p>
                Every sound is badged. Every fact carries a confidence. Each badge has a label, an icon and a border
                style, so color is never the only signal.
              </p>
            }
          >
            <div className="flex flex-col gap-6">
              <div>
                <h3 className="text-title-sm">Sound</h3>
                <div className="mt-3 flex flex-wrap gap-3">
                  <SoundBadge kind="recording" />
                  <SoundBadge kind="reconstruction" />
                  <SoundBadge kind="synthetic" detail="engine name" />
                </div>
              </div>
              <div>
                <h3 className="text-title-sm">Confidence</h3>
                <div className="mt-3 flex flex-wrap gap-3">
                  <ConfidenceChip level="high" />
                  <ConfidenceChip level="medium" />
                  <ConfidenceChip level="low" />
                  <ConfidenceChip level="contested" />
                </div>
              </div>
              <div className="rounded-lg border border-line bg-raised p-4 shadow-raised">
                <p className="text-small text-ink-muted">On a raised surface</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <SoundBadge kind="recording" />
                  <SoundBadge kind="synthetic" />
                  <ConfidenceChip level="contested" />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="focus"
            title="Focus and targets"
            intro={
              <p>
                A {focusRing.width} px focus ring with a {focusRing.offset} px gap, in a color that meets 3:1 on every surface. Every control is at least
                44 by 44 px. Press Tab to see it.
              </p>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="tt-button">
                A button
              </button>
              <button type="button" className="tt-button tt-button-quiet">
                A quiet button
              </button>
              <a href="#focus" className="inline-flex min-h-target items-center px-2">
                A link
              </a>
            </div>
            <p className="mt-3 text-small text-ink-muted">
              Focus ring on canvas: <Ratio fg={ui[theme].focus} bg={ui[theme].canvas} min={3} />. On raised:{" "}
              <Ratio fg={ui[theme].focus} bg={ui[theme].raised} min={3} />.
            </p>
          </Section>

          <Section
            id="scripts"
            title="Scripts"
            intro={<p>Noto for every script, and an IPA-complete face for transcriptions.</p>}
          >
            <ScriptSpecimen headingLevel={3} />
          </Section>

          <Section id="deeper" title="Go deeper">
            <ul className="grid gap-4 sm:grid-cols-3">
              {[
                { to: "/spike/tree", kind: "Related", title: "Tree spike", body: "Where family colors meet the canvas." },
                { to: "/spike/map", kind: "Contrast", title: "Map spike", body: "Patterns and markers on a map." },
                { to: "/", kind: "Back", title: "All workbenches", body: "Every Phase 0 foundation in one list." },
              ].map((c) => (
                <li key={c.to}>
                  <Link
                    to={c.to}
                    className="group flex min-h-target flex-col gap-1 rounded-lg border border-line bg-surface p-4 text-ink no-underline shadow-raised transition-colors duration-(--tt-dur-ui-fast) ease-standard hover:border-line-strong"
                  >
                    <span className="text-caption font-semibold uppercase tracking-widest text-accent">{c.kind}</span>
                    <span className="font-display text-title-sm text-link group-hover:underline">{c.title}</span>
                    <span className="text-small text-ink-muted">{c.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </main>
    </div>
  );
}
