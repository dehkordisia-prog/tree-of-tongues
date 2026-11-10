# Overnight report, 10 to 11 November 2026

Owner: Siavash. Written by Claude (orchestrator). Updated as work lands; newest status first in each section.

## Status at a glance
| Item | State |
| --- | --- |
| Phase 0 branch | `phase-0`, pushed; not merged into main (your call in the morning) |
| Phase 0 gate | in progress |
| Phase 1 branch | not started |
| CI on phase-0 | green, except one run (41f41c6, a lint error in the screenshot script) fixed by the next commit |
| Spikes | tree (PixiJS vs deck.gl) and map being built; measured one after the other by `scripts/bench.mjs` |

## How to open the app
```powershell
cd tree-of-tongues
git switch phase-0
pnpm install
uv sync
pnpm dev
```
Then open http://localhost:5173. Pages: `/` (start), `/design` (design system), `/spike/tree`, `/spike/map`. Add `?lang=fa` for Persian (right to left) or `?lang=tr` for Turkish.

If `uv` is "not recognized", open a new terminal: the installer added it to PATH after this terminal started.

## Done
### Phase 0
- Scaffold: pnpm workspace, React Router 8 SPA with prerender, Python pipeline package, CI. All eight commands in CLAUDE.md pass.
- Licenses: Glottolog 5.3, CLDR 49, Wikidata, Natural Earth cleared (rights-auditor, verified at the source). Seven fonts filed: five cleared. The two Source fonts were blocked (Reserved Font Name), so we now ship our own renamed subsets, Tongues Serif and Tongues Sans, built reproducibly from Adobe's releases (D-016, your decision). rights-auditor cleared both after a name-table check: no "Source" outside the copyright and trademark notices ([evidence](2026-11-10-overnight/font-name-tables.txt)). All seven fonts are now cleared.
- Checks on 0d0b97e: content lint, lint, 27 unit and 18 pipeline tests, 10 browser tests, 5 accessibility tests, Lighthouse, and the font build determinism check all pass.
- Design system: night and parchment themes, 11 family colors plus a neutral, each with a pattern, marker and two-letter label; contrast computed and tested (WCAG AA in both themes).
- Pipeline (`uv run pipeline fetch | build | validate`): Glottolog 5.3, CLDR 49, Wikidata and Natural Earth 5.1.1 downloaded into dated, checksummed files (data/raw/MANIFEST.yaml). Two builds are byte-identical. Counts from data/build/coverage.md:
  - 27,177 languoids: 4,853 families, 8,618 languages, 13,706 dialects; 26,696 with coordinates.
  - 2,413 Wikidata speaker statements, one row each, never merged: 1,623 with a reference, 790 without; 444 marked L1, 75 L2, 1,894 of unstated kind. 108 languoids flagged because their figures differ by more than 25 percent.
  - 1,341 CLDR territory rows for 699 languoids (CLDR gives no year).
  - Names: English for all, Persian for 1,554 languoids, Turkish for 3,997. 138 CLDR codes left unmapped rather than guessed.
  - Build takes about 6 minutes, mostly writing 27,177 bundle files (largest 26 KB, English).
- The app reads pipeline output in place at `/data/` (dev server and `scripts/serve.mjs`), never copying 90 MB into the build.
- Type and scripts: self-hosted fonts, Persian in Naskh and Nastaliq, RTL with `?lang=fa`, Turkish casing. Han font fetched at build, not stored in git (D-015, your decision).

## Screenshots
Taken with `node scripts/screenshots.mjs <folder>` after `pnpm build`: every page at 1440x900 and 390x844, in English (night and parchment) and Persian (night, right to left). The run fails on any console error, so these double as a smoke test. All files are in [2026-11-10-overnight/](2026-11-10-overnight/), named `<page>-<width>-<lang>-<theme>.jpg`.

### Phase 0 (taken after the design and font commit, 0d0b97e)
| Page | 1440, English | 390, English | 1440, Persian (RTL) | 390, Persian (RTL) |
| --- | --- | --- | --- | --- |
| Start `/` | ![](2026-11-10-overnight/home-1440-en-night.jpg) | ![](2026-11-10-overnight/home-390-en-parchment.jpg) | ![](2026-11-10-overnight/home-1440-fa-night.jpg) | ![](2026-11-10-overnight/home-390-fa-night.jpg) |
| Design `/design` | ![](2026-11-10-overnight/design-1440-en-night.jpg) | ![](2026-11-10-overnight/design-390-en-parchment.jpg) | ![](2026-11-10-overnight/design-1440-fa-night.jpg) | ![](2026-11-10-overnight/design-390-fa-night.jpg) |
| Tree spike `/spike/tree` | ![](2026-11-10-overnight/spike-tree-1440-en-night.jpg) | ![](2026-11-10-overnight/spike-tree-390-en-parchment.jpg) | ![](2026-11-10-overnight/spike-tree-1440-fa-night.jpg) | ![](2026-11-10-overnight/spike-tree-390-fa-night.jpg) |
| Map spike `/spike/map` | ![](2026-11-10-overnight/spike-map-1440-en-night.jpg) | ![](2026-11-10-overnight/spike-map-390-en-parchment.jpg) | ![](2026-11-10-overnight/spike-map-1440-fa-night.jpg) | ![](2026-11-10-overnight/spike-map-390-fa-night.jpg) |

Tree and map screenshots were retaken after the spikes landed (7243661).

What to look at:
- Persian start page: the tagline and "سامانهٔ طراحی" are translated; the other labels fall back to English and keep their own left-to-right order. Untranslated strings stay English until you approve wording.
- Design page in Persian: the page mirrors (navigation and theme toggle flip), English copy keeps its punctuation in place.
- Tree spike: all 27,177 languoids packed as circles; area is the number of entries below a node, not speakers (the page says so). Families take the design tokens' colors; groups without a token are gray. Known layout weakness: circle packing wastes space (a language is about 0.2 px at the world view) and lines small groups up in rows. The Phase 1 plan should test a collapsed or treemap-style layout. The "draw 54.6 ms" in the stats line comes from headless software rendering and is not a measurement.
- Map spike: about 8,300 language points from Glottolog coordinates, the family legend (each family also has a marker shape and label), the always-visible borders note, and the time slider stub. In Persian the controls mirror and the map does not; the slider runs right to left, as DESIGN.md specifies. UI text on the map is still English (awaiting your wording).
- Both spikes make zero requests outside localhost (tested).

## Provisional decisions (made overnight, please confirm or overrule)
- D-017: themes use CSS `light-dark()`; very old browsers fall back to default colors.
- D-018: Tongues Serif fixes its optical-size axis at 36. First-paint fonts rose from about 80 KB to 132 KB; Lighthouse still passes.
- D-019: borders policy for every map: disputed and breakaway areas hatched, never filled, never attributed to a state; "Borders are approximate..." always visible. Two open points inside it for you: self-declared names (show "Donetsk People's Republic" or a geographic name?) and whether Kosovo and Israel, which Natural Earth types as Disputed without a claim note, should get the dashed outline.
- D-020: a small shim lets deck.gl 9.4 run on MapLibre 6.
- D-021: PixiJS for the tree, provisionally and unmeasured (see Blocked).

## Questions for you
1. **How should the app model Persian?** (Most important; it shapes the Persian profile in Phase 1.)
   - Wikidata's Persian item (Q9168, `fa`) points to Glottolog `fars1254`, which in Glottolog 5.3 is a family ("Farsic-Caucasian Tat"), not a language.
   - Glottolog has no language-level entry for ISO `fas` (the macrolanguage). ISO `pes` maps to `west2369` "Western Farsi"; Dari and Tajik are separate languages.
   - Result today: CLDR territory shares and names for `fa` are left unmapped instead of being attached to a family, so Persian has no territory rows yet. Wikidata's speaker figures stay on `fars1254`, labeled as Wikidata's claim.
   - My plan for Phase 1 (provisional until you decide): show Persian as a labeled macrolanguage grouping Iranian Persian (west2369), Dari and Tajik, which is exactly the Lumper/Splitter toggle in the spec; Glottolog's tree stays the default view. linguist-reviewer checks this before anything ships.
2. Persian and Turkish UI strings in `apps/web/src/i18n/fa.json` and `tr.json`: all marked "awaiting owner review".
3. Nastaliq digits ۴ ۶ ۷: Noto Nastaliq Urdu follows Urdu shapes. Acceptable for Persian?
4. Persian sample words on `/design` (Scripts section).
5. The palette's "Niger-Congo" token: Glottolog calls the family Atlantic-Congo (atla1278). The spikes map the token to atla1278; the UI name gets settled with linguist-reviewer in Phase 1.

## Blocked
1. **Renderer benchmark (D-006): needs you.** `scripts/bench.mjs` opens a visible Chromium with the GPU for each of 10 runs (tree in PixiJS and deck.gl, normal and stress, plus the map; desktop and a 4x-throttled phone proxy). Claude Code stopped it before the first run finished because memory ran critically low. I must not restart it unattended. To run it, close other apps and run:
   ```powershell
   pnpm build
   node scripts/build-territory-index.mjs
   node scripts/bench.mjs docs/reports/2026-11-10-overnight/bench
   ```
   Results land in `docs/reports/2026-11-10-overnight/bench/bench.md`. Until then D-021 picks PixiJS provisionally, from text quality and size only.
   The results record the machine's CPU, RAM and GPU, so numbers from different computers stay comparable.
