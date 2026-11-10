# Overnight report, 10 to 11 November 2026

Owner: Siavash. Written by Claude (orchestrator). Updated as work lands; newest status first in each section.

## Status at a glance
| Item | State |
| --- | --- |
| Phase 0 branch | `phase-0`, pushed; not merged into main (your call in the morning) |
| Phase 0 gate | in progress |
| Phase 1 branch | not started |
| CI on phase-0 | green on every push so far |

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
- Type and scripts: self-hosted fonts, Persian in Naskh and Nastaliq, RTL with `?lang=fa`, Turkish casing. Han font fetched at build, not stored in git (D-015, your decision).

## Screenshots
Taken with `node scripts/screenshots.mjs <folder>` after `pnpm build`: every page at 1440x900 and 390x844, in English (night and parchment) and Persian (night, right to left). The run fails on any console error, so these double as a smoke test. All files are in [2026-11-10-overnight/](2026-11-10-overnight/), named `<page>-<width>-<lang>-<theme>.jpg`.

### Phase 0 (taken after the design and font commit, 0d0b97e)
| Page | 1440, English | 390, English | 1440, Persian (RTL) | 390, Persian (RTL) |
| --- | --- | --- | --- | --- |
| Start `/` | ![](2026-11-10-overnight/home-1440-en-night.jpg) | ![](2026-11-10-overnight/home-390-en-parchment.jpg) | ![](2026-11-10-overnight/home-1440-fa-night.jpg) | ![](2026-11-10-overnight/home-390-fa-night.jpg) |
| Design `/design` | ![](2026-11-10-overnight/design-1440-en-night.jpg) | ![](2026-11-10-overnight/design-390-en-parchment.jpg) | ![](2026-11-10-overnight/design-1440-fa-night.jpg) | ![](2026-11-10-overnight/design-390-fa-night.jpg) |
| Tree spike | placeholder until the spike lands | | | |
| Map spike | placeholder until the spike lands | | | |

What to look at:
- Persian start page: the tagline and "سامانهٔ طراحی" are translated; the other labels fall back to English and keep their own left-to-right order. Untranslated strings stay English until you approve wording.
- Design page in Persian: the page mirrors (navigation and theme toggle flip), English copy keeps its punctuation in place.

## Provisional decisions (made overnight, please confirm or overrule)
- D-017: themes use CSS `light-dark()`; very old browsers fall back to default colors.
- D-018: Tongues Serif fixes its optical-size axis at 36. First-paint fonts rose from about 80 KB to 132 KB; Lighthouse still passes.

## Questions for you
1. Persian and Turkish UI strings in `apps/web/src/i18n/fa.json` and `tr.json`: all marked "awaiting owner review".
2. Nastaliq digits ۴ ۶ ۷: Noto Nastaliq Urdu follows Urdu shapes. Acceptable for Persian?
3. Persian sample words on `/design` (Scripts section).

## Blocked
Nothing yet.
