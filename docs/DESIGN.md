# Design system

An observatory at night (deep ink, luminous family colors), with a parchment theme for daylight. A museum installation crossed with a scientific atlas. The living specimen is the `/design` route. Source of truth: `apps/web/src/design/tokens.ts`. `tokens.css` mirrors it, and `tokens.test.ts` fails if the two drift or if any contrast pair drops below AA.

## Principles
1. Color is never alone. Every family also has a pattern, a marker shape and a two-letter label. Every badge has a label, an icon and a border style.
2. Motion explains. The camera moves to show where you are in the hierarchy. Transitions keep context. Reduced motion crossfades instead.
3. Text first. Text meets 4.5:1 and marks meet 3:1, on canvas, surface and raised, in both themes. Tests enforce it.
4. Direction neutral. Logical properties only. RTL ships from day one.
5. No dead ends. Every screen has at least three Go deeper exits, empty states that teach, loading skeletons, and errors that name a next step.

## Tokens

| Group | Tokens (Tailwind utility) | Values |
| --- | --- | --- |
| Surfaces | `--tt-canvas` (`bg-canvas`), `--tt-surface`, `--tt-raised` | Night `#0A0F1E` `#121A2E` `#1A2440`; Parchment `#F5EEDC` `#FBF6EA` `#FFFDF7` |
| Text | `--tt-ink` (`text-ink`), `--tt-ink-muted`, `--tt-link`, `--tt-accent`, `--tt-danger` | See the UI table below |
| Lines | `--tt-line` (decorative), `--tt-line-strong` (component borders, 3:1) | |
| Status | `--tt-conf-{high,medium,low,contested}`, `--tt-badge-{recording,reconstruction,synthetic}` | |
| Family | `--tt-fam-<id>` (mark), `--tt-fam-<id>-ink` (text) | `bg-fam-turkic`, `text-fam-turkic-ink` |
| Type | `text-caption` 13, `text-small` 14, `text-body` 16, `text-lead` 18, `text-title-sm` 20, `text-title` 25, `text-headline` 28 to 36 (fluid), `text-hero` 36 to 56 (fluid) | Line heights 1.1 to 1.6 |
| Fonts | `--font-display` (`font-display`), `--font-ui` (`font-ui`), `--font-ipa` (`font-ipa`) | Stacks live in `src/design/fonts.css` |
| Space | 4 px grid (Tailwind `--spacing: 0.25rem`); steps 4, 8, 12, 16, 24, 32, 48, 64, 96; `px-gutter` = clamp(16, 4vw, 40) | |
| Radii | `rounded-xs` 2, `-sm` 4, `-md` 8, `-lg` 12, `-xl` 20, `-pill` | |
| Elevation | `shadow-raised` (cards), `shadow-overlay` (Inspector, palette, sheets); `--tt-scrim` | Night adds a top highlight, since shadows vanish on ink |
| Focus | 3 px solid `--tt-focus`, 2 px offset, on `:focus-visible` | |
| Targets | `min-h-target` / `min-w-target` = 44 px | Every control |
| Motion | `--tt-dur-ui-fast` 200, `--tt-dur-ui` 280, `--tt-dur-ui-slow` 400, `--tt-dur-flight-short` 600, `--tt-dur-flight` 900, `--tt-dur-flight-long` 1200, `--tt-dur-crossfade` 200 (ms) | |
| Easing | `ease-standard` (0.2, 0, 0, 1), `ease-enter` (0, 0, 0.2, 1), `ease-exit` (0.4, 0, 1, 1), `ease-flight` (0.65, 0, 0.35, 1) | |

Default Tailwind colors are removed (`--color-*: initial`). Use tokens.

## UI colors (computed; minimum over canvas, surface and raised)

| Token | Role | Night | Min ratio | Parchment | Min ratio |
| --- | --- | --- | --- | --- | --- |
| --tt-line-strong | mark (3:1) | #6B79A3 | 3.56 | #8C7A5B | 3.59 |
| --tt-ink | text | #E8ECF6 | 12.96 | #22180E | 15.05 |
| --tt-ink-muted | text | #A9B3CC | 7.30 | #5A4A36 | 7.35 |
| --tt-link | text | #9CC2FF | 8.44 | #1F4FA8 | 6.61 |
| --tt-accent | text | #FFD166 | 10.62 | #845600 | 5.47 |
| --tt-focus | mark (3:1) | #FFD166 | 10.62 | #1A3FB0 | 7.61 |
| --tt-danger | text | #FF8A80 | 6.71 | #A8261B | 6.13 |
| --tt-conf-high | text | #7EE0A1 | 9.53 | #1E7A3C | 4.64 |
| --tt-conf-medium | text | #F2C333 | 9.21 | #845600 | 5.47 |
| --tt-conf-low | text | #A9B3CC | 7.30 | #5A4A36 | 7.35 |
| --tt-conf-contested | text | #FF9EC4 | 7.98 | #9C2A7A | 5.99 |
| --tt-badge-recording | text | #7EE0A1 | 9.53 | #1E7A3C | 4.64 |
| --tt-badge-reconstruction | text | #F2C333 | 9.21 | #845600 | 5.47 |
| --tt-badge-synthetic | text | #B9A8FF | 7.37 | #5B3FB0 | 6.52 |

`--tt-line` (#2A3656 / #DCCFB0) is decorative only and never carries meaning.

## Family palette

Hue logic follows the reference chart. Marks are for fills, strokes and nodes (3:1). Inks are for text in the family color (4.5:1). In Night one value serves both. Ratios are WCAG 2.x, computed and truncated to two decimals, against canvas / raised.

| Family | Pattern | Marker | Night (mark and ink) | Canvas / raised | Parchment mark | Canvas / raised | Parchment ink | Canvas / raised |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Indo-European (IE), red | solid | circle | #FD5150 | 5.88 / 4.72 | #A21600 | 6.84 / 7.78 | #A21600 | 6.84 / 7.78 |
| Sino-Tibetan (ST), blue | hatch-45 | square | #568DFB | 5.99 / 4.81 | #2731BE | 7.99 / 9.09 | #2731BE | 7.99 / 9.09 |
| Afro-Asiatic (AA), amber | hatch-135 | triangle | #F2C333 | 11.48 / 9.21 | #B67A06 | 3.14 / 3.57 | #916104 | 4.63 / 5.27 |
| Austronesian (AN), rose | dots | diamond | #FD92C2 | 9.15 / 7.34 | #CC5C84 | 3.34 / 3.80 | #B1446D | 4.63 / 5.27 |
| Niger-Congo (NC), orange | horizontal | triangle-down | #FA871F | 7.77 / 6.23 | #BE4E09 | 4.23 / 4.82 | #B44803 | 4.69 / 5.33 |
| Dravidian (DR), sky | vertical | hexagon | #6ECFF8 | 10.85 / 8.71 | #00628A | 5.82 / 6.62 | #00628A | 5.82 / 6.62 |
| Turkic (TK), violet | crosshatch | pentagon | #AD9FFF | 8.34 / 6.69 | #6A4AD0 | 5.17 / 5.89 | #6A4AD0 | 5.17 / 5.89 |
| Japonic (JP), teal | grid | star | #71F6E4 | 14.54 / 11.67 | #278974 | 3.69 / 4.19 | #0A7964 | 4.61 / 5.25 |
| Koreanic (KO), magenta | rings | cross | #D85AD2 | 5.73 / 4.60 | #A737A4 | 4.87 / 5.54 | #A737A4 | 4.87 / 5.54 |
| Kra-Dai (KD), green | zigzag | plus | #ABE98E | 13.43 / 10.78 | #015C0C | 7.15 / 8.13 | #015C0C | 7.15 / 8.13 |
| Uralic (UR), brown | checker | bowtie | #C5A487 | 8.21 / 6.59 | #85624D | 4.71 / 5.36 | #85624D | 4.71 / 5.36 |
| Other families and isolates (OT), neutral | outline | ring | #8D8D8E | 5.75 / 4.62 | #57595C | 6.07 / 6.90 | #57595C | 6.07 / 6.90 |

Color vision check: Machado, Oliveira and Fernandes (2009) matrices at full severity, applied in linear RGB; distance in OKLab (about 0.02 is a just-noticeable step). Closest pair of marks per condition:

| Condition | Night | Parchment |
| --- | --- | --- |
| Typical | 0.106 (JP, KD) | 0.088 (UR, OT) |
| Protanopia | 0.076 (ST, TK) | 0.055 (NC, KD) |
| Deuteranopia | 0.074 (DR, TK) | 0.059 (JP, UR) |
| Tritanopia | 0.074 (NC, KO) | 0.057 (AA, AN) |

Twelve hues at fixed contrast cannot all stay apart under dichromacy. The palette was tuned to maximize the worst case, and the pattern, marker and label carry the rest. Tests hold the floors at 0.07 (Night) and 0.05 (Parchment). Legends always show pattern and label together with the color.

## Motion
- UI transitions: 200 to 400 ms, `ease-standard` (enter: `ease-enter`, exit: `ease-exit`). Panels move at most 16 px.
- Camera flights: 600 to 1200 ms, `ease-flight`, length scales with zoom levels crossed (`flightDuration()`). The camera shows hierarchy: zoom in to descend, pull back to ascend, pan for siblings. An interrupted flight starts from where the camera is, never from the old target.
- Blooms (children unfolding): spring stiffness 220, damping 26, mass 1 (damping ratio 0.88, no visible bounce); siblings stagger 24 ms, capped at 12 steps. Panels settle with stiffness 120, damping 20.
- Nothing loops forever. No autoplay.
- Reduced motion (`prefers-reduced-motion`, or `data-motion="reduce"` on `<html>` or a subtree): flights and blooms become a 200 ms crossfade (the camera jumps behind the fade), UI keeps opacity only, `--tt-motion-distance` becomes 0. In code, call `motionFor(kind, reduced)` and use `usePrefersReducedMotion()` (hydration-safe; prefer it over `useReducedMotion` from motion/react).

## Theming
- Every color is `light-dark(parchment, night)`. `<html>` without `data-theme` follows `prefers-color-scheme`. `data-theme="night"` or `"parchment"` forces a theme. Requires `light-dark()` (Chrome 123, Safari 17.5, Firefox 120). Older browsers fall back to browser defaults, which stay readable.
- The choice persists in `localStorage["tt-theme"]` (try/catch). `THEME_INIT_SCRIPT` in `src/design/theme.ts` runs in `<head>` before paint, so there is no flash. `ThemeToggle` is a native radio group: System, Night, Parchment.

## RTL rules
- Logical properties only: `margin-inline-start`, `padding-inline`, `inset-inline-end`, `border-inline-start`, `inline-size`, `block-size`. In Tailwind: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`. Never `ml-*`, `pl-*`, `left-*`, `text-left`.
- Motion that implies direction (a panel arriving from the side) uses the block axis or flips with `dir`. Time runs in the reading direction of the UI language; the time slider mirrors in Persian.
- Icons that point (arrows, chevrons, "next") mirror under `[dir="rtl"]`. Icons that depict objects (microphone, waveform) do not.

## Type and scripts
Display: Tongues Serif. UI: Tongues Sans. Both are our own renamed web subsets of Adobe's Source Serif 4 and Source Sans 3 (the OFL reserves the name "Source"; see D-016 and scripts/build_fonts.py). IPA: Charis (any element with a -fonipa language tag gets it). Persian: Noto Naskh Arabic by default, Noto Nastaliq Urdu as an opt-in style. Devanagari: Noto Sans Devanagari. Han: Noto Sans SC, loaded in slices through ensureCjkFonts(). All fonts are self-hosted OFL files under public/fonts/, with unicode-range so a face downloads only when its characters appear. First paint needs about 130 KB of fonts (the two Latin slices, preloaded). Every multilingual span needs lang and dir. Use logical properties only. Never letter-space Arabic script. Persian copy uses ، ؛ ؟ « », ZWNJ in compounds and Persian digits.

## Canvases (PixiJS, deck.gl)
```ts
import { currentTheme, familyColor, onThemeChange, markerPath, motionFor, prefersReducedMotion } from "@/design/tokens";
import { createPatternCanvas } from "@/design/patterns";

let theme = currentTheme();
const ie = familyColor("indo-european", theme);   // { hex, num: 0xFD5150, rgba: [253, 81, 80, 255] }
// PixiJS: graphics.fill(ie.num); Texture.from(createPatternCanvas("hatch-45", ie.hex, devicePixelRatio))
// deck.gl: getFillColor: ie.rgba; markers: new Path2D(markerPath.circle) or Graphics.svg()
const stop = onThemeChange((t) => { theme = t; /* recolor */ });
const plan = motionFor("flight", prefersReducedMotion()); // { mode, duration, ease }
```
Canvas text labels use the `ink` role; nodes and fills use `mark`. Below 12 px, drop the pattern and rely on marker shape and label.

## Component inventory
| Component | Status | Notes |
| --- | --- | --- |
| Badge (Recording, Reconstruction, Synthetic) | Built: `SoundBadge` | Solid, dashed, dotted border; mic, asterisk, waveform icon. Synthetic names the engine via `detail`. |
| Confidence chip | Built: `ConfidenceChip` | High, Medium, Low, Contested; bar meter icon; visible label. |
| Theme toggle | Built: `ThemeToggle` | Needs i18n strings before it ships outside `/design`. |
| Family swatch and marker | Built: `FamilySwatch`, `FamilyMarker` | Decorative; always beside a name. |
| Inspector | Spec | Side panel at 1024 px and up (`shadow-overlay`, 400 ms max enter); bottom sheet on phones with peek, half and full stops. |
| Breadcrumbs | Spec | Family path; each crumb a 44 px target; the camera flies on select; collapses the middle on phones. |
| Time slider | Spec | Bottom scrubber on phones; keyboard: arrows step, Page keys jump a century; labels BCE and CE; approximate dates marked. |
| Lens switcher | Spec | Radio group (Tree, Map, Time); crossfade between lenses, the selection stays. |
| Citation chip | Spec | Inline; source and year visible, details (locator, retrieval date, license, confidence) on hover, focus or tap. |
| Audio button | Spec | 44 px; always paired with a badge; never autoplays; one global mute. |
| Go deeper cards | Spec | Three per view: Related, Contrast, Surprise. |
| Command palette | Spec | Ctrl or Cmd K; search reaches any languoid in three interactions or fewer. |

Every screen: three Go deeper exits; empty states that teach (say what belongs here and how to get it); skeletons in `--tt-surface` shapes, no shimmer under reduced motion; errors say what failed and offer one next step.
