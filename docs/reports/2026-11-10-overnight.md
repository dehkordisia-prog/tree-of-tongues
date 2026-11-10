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
- Licenses: Glottolog 5.3, CLDR 49, Wikidata, Natural Earth cleared (rights-auditor, verified at the source). Seven fonts filed: five cleared, two (Source Serif 4, Source Sans 3) blocked until the renamed subsets land (D-016, your decision).
- Design system: night and parchment themes, 11 family colors plus a neutral, each with a pattern, marker and two-letter label; contrast computed and tested (WCAG AA in both themes).
- Type and scripts: self-hosted fonts, Persian in Naskh and Nastaliq, RTL with `?lang=fa`, Turkish casing. Han font fetched at build, not stored in git (D-015, your decision).

## Screenshots
Added as pages land.

## Provisional decisions (made overnight, please confirm or overrule)
None yet.

## Questions for you
1. Persian and Turkish UI strings in `apps/web/src/i18n/fa.json` and `tr.json`: all marked "awaiting owner review".
2. Nastaliq digits ۴ ۶ ۷: Noto Nastaliq Urdu follows Urdu shapes. Acceptable for Persian?
3. Persian sample words on `/design` (Scripts section).

## Blocked
Nothing yet.
