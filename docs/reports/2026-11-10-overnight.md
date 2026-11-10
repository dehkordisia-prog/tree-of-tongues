# Overnight report, 10 to 11 November 2026

Owner: Siavash. Written by Claude (orchestrator). Updated as work lands; newest status first in each section.

## Status at a glance
| Item | State |
| --- | --- |
| Phase 0 branch | `phase-0`, pushed; not merged into main (your call in the morning) |
| Phase 0 gate | ready for your review, with one item open: the renderer benchmark (see Blocked). qa-gatekeeper found 0 blocking, 2 must-fix and 3 minor issues; all fixed or noted below |
| Phase 1 branch | `phase-1`, based on `phase-0` |
| CI on phase-1 | Red for five pushes (17b3ddc to caf9bb1): the pipeline gained a `--scope` option defaulting to the real scope list, and CI's fixture build did not pass the fixture's scope file. I did not check CI after those pushes; I caught it at caf9bb1 and fixed the workflow in the next commit. Earlier red run: 840d51d (content lint), fixed by the next commit. |
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

### Phase 0 gate review (qa-gatekeeper, at b8b8c4d)
| Gate item | Result |
| --- | --- |
| Builds reproduce from raw data | Pass: two real builds byte-identical (data-curator); reproducibility test, font build check and font fetch check pass; `uv run pipeline validate` passes on the real data after fix 1 |
| Spike results logged in DECISIONS.md | Partly: D-019 to D-021 logged; fps and memory not measured (Blocked, item 1) |
| Licenses filed | Pass: 4 sources and 7 fonts, all cleared; credits complete |
| Commands, tests, lint, a11y | Pass: 98 unit, 19 pipeline, 28 browser and 15 accessibility tests; content lint |
| Budgets measurable here | Pass: app-shell JS about 137 KB gzip (budget 250); LCP 0.8 s on the Lighthouse mobile preset (budget 2.5); spike code lazy-loaded |
| Real-browser checks | Pass: 5 routes x English and Persian x 1440 and 390, no console errors, no overflow, no third-party requests; disputed areas never filled |

Fixed after the review:
1. `pipeline validate` failed on the real data because the map's stopgap territory index lives in data/build/derived/, outside the manifest. Validate now ignores derived/ (script-made indexes that add no facts) and still fails on any other unlisted file; a test covers both. Phase 1 moves the index into the pipeline.
2. No visible focus ring on the deck.gl tree canvas and the map canvas (WCAG 2.4.7). Both libraries reset outlines; an unlayered rule restores the ring, and a new accessibility test checks the computed outline on all three canvases.
3. English sentences on the Persian tree page had their punctuation flipped; each line now keeps its own direction.
4. D-019 to D-021 were dated a day late; corrected.

Noted for later (P2): browser tests run only in Chromium and only at 1440 wide; Lighthouse audits only `/`. Firefox and WebKit are not installed on this machine.

### Phase 1 (in progress on `phase-1`)
- Scope list: the 100 chart languages mapped to Glottolog (content/scope/phase-1-languages.yaml), reviewed by linguist-reviewer (D-023); names and ranks only, no figures from the chart.
- Pipeline: territory index and two-tier search index; Wikidata attachment hardened (no language item renames a Glottolog family; retired nodes skipped; ISO-fallback matches marked low confidence and never size the tree).
- Licenses: ASJP v21.1 cleared with conditions; Commons audio rule; Ethnologue and ISO 639-3 entries (see questions 7 and 8).
- App shell: routes for languages and families (410 prerendered pages), URL as the source of truth, Inspector with real data, Ctrl+K search. App-shell JS about 188 KB gzip.
- Gold-standard profile drafts: content/languages/west2369.md (Iranian Persian), nucl1301.md (Turkish), stan1293.md (English). Reviewed by a linguist-reviewer per profile and by the historical-linguist (reviews in docs/reviews/), then revised (07c6673). 148 sources, each marked opened, catalog or not opened; every citation resolves. Open claims stay TODO(verify): 40 in Persian, 28 in Turkish, 39 in English. Main reason: Encyclopaedia Iranica, the OED, the Middle English Dictionary, SIL and UNESCO refused automated access, so some claims still rest on Wikipedia or Wiktionary or on scholarly works seen only in catalogs. Still draft; your review decides.
  - English review blockers fixed: the hook is now the single medieval copy of Beowulf (British Library catalogue); "they" from Old Norse is shown as the usual view next to Cole (2018), who argues a native origin; no Phase 3 audio is promised.
  - The profile prose is not yet rendered in the app; the Inspector shows data only. Rendering it (with citations as popovers and unverified claims visibly marked) is next.

### Decisions the profile writers left for you
- Persian: the "one pluricentric language" section (Tajik included, labeled our grouping); English labels for the Farsic family nodes; whether Wikipedia and Wiktionary may stand as interim sources where Iranica and scholarly grammars blocked automated access (every such entry names its intended replacement).
- Turkish: the hook (the 1928 law's four-week deadline for newspapers, or the whistled language of Kuşköy); whether UNESCO's estimate for the whistled language belongs in the data; the Turkish examples and glosses; keeping Dede Korkut on the culture shelf.
- English: Wiktionary as the source for the hook (they from Old Norse þeir) until the OED or Middle English Dictionary is reachable; showing Glottolog's placement of Old English as a sister branch; the Go deeper picks (Dutch and Swedish, Mandarin, Nigerian Pidgin).
- All three: culture-shelf images still need rights-auditor clearance.

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

### Phase 1 app shell (taken at 8f4dc68, after the hydration fix; no console errors on any page)
Files in [2026-11-10-overnight/phase-1/](2026-11-10-overnight/phase-1/).

| Page | 1440, English | 390, English | 1440, Persian (RTL) | 390, Persian (RTL) |
| --- | --- | --- | --- | --- |
| Start `/` | ![](2026-11-10-overnight/phase-1/home-1440-en-night.jpg) | ![](2026-11-10-overnight/phase-1/home-390-en-parchment.jpg) | ![](2026-11-10-overnight/phase-1/home-1440-fa-night.jpg) | ![](2026-11-10-overnight/phase-1/home-390-fa-night.jpg) |
| Turkish `/language/nucl1301` | ![](2026-11-10-overnight/phase-1/language-nucl1301-1440-en-night.jpg) | ![](2026-11-10-overnight/phase-1/language-nucl1301-390-en-parchment.jpg) | ![](2026-11-10-overnight/phase-1/language-nucl1301-1440-fa-night.jpg) | ![](2026-11-10-overnight/phase-1/language-nucl1301-390-fa-night.jpg) |
| Iranian Persian `/language/west2369` | ![](2026-11-10-overnight/phase-1/language-west2369-1440-en-night.jpg) | ![](2026-11-10-overnight/phase-1/language-west2369-390-en-parchment.jpg) | ![](2026-11-10-overnight/phase-1/language-west2369-1440-fa-night.jpg) | ![](2026-11-10-overnight/phase-1/language-west2369-390-fa-night.jpg) |
| English `/language/stan1293` | ![](2026-11-10-overnight/phase-1/language-stan1293-1440-en-night.jpg) | ![](2026-11-10-overnight/phase-1/language-stan1293-390-en-parchment.jpg) | ![](2026-11-10-overnight/phase-1/language-stan1293-1440-fa-night.jpg) | ![](2026-11-10-overnight/phase-1/language-stan1293-390-fa-night.jpg) |
| Indo-European `/family/indo1319` | ![](2026-11-10-overnight/phase-1/family-indo1319-1440-en-night.jpg) | ![](2026-11-10-overnight/phase-1/family-indo1319-390-en-parchment.jpg) | ![](2026-11-10-overnight/phase-1/family-indo1319-1440-fa-night.jpg) | ![](2026-11-10-overnight/phase-1/family-indo1319-390-fa-night.jpg) |

What to look at:
- Turkish: the Inspector shows its own name with its source, the family path, L1 speakers as a range with "5 sources, 2006 to 2021" (each source and year one tap away; never averaged), and where it is spoken with CLDR shares. The profile prose (the reviewed drafts) is not on the page yet; the Inspector shows data only.
- Iranian Persian: mostly "No data yet" (see question 1). The breadcrumb shows Glottolog's names for the Farsic nodes (question 1, last point).
- Persian layout: the shell mirrors (search, lens switcher and Inspector flip sides), the tree does not. UI labels are still English inside the RTL layout until you approve Persian wording.
- Known cosmetic issue: some tree labels overlap at certain zooms (for example "Southern Persian" and "Khuzestani"); label collision handling is a Phase 1 tree task.

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
   - My plan for Phase 1 (provisional until you decide): show Persian as a labeled macrolanguage grouping Iranian Persian (west2369), Dari and Tajik, which is exactly the Lumper/Splitter toggle in the spec; Glottolog's tree stays the default view.
   - linguist-reviewer checked it (D-023): accurate, with corrections. ISO's macrolanguage fas covers only Iranian Persian and Dari, not Tajik, so a three-way lens is our own grouping and is labeled that way. Glottolog's fars1254 is "Farsic-Caucasian Tat" (it also contains Caucasian Tat), so it is never shown as Persian; the pipeline stops Wikidata labels from renaming Glottolog families.
   - **Visible consequence today:** the Iranian Persian page (/language/west2369) shows "No data yet" for its own name, speakers, where it is spoken and scripts. The data exists but is filed under "Persian" as a whole: CLDR's `fa` covers both Iran and Afghanistan (Dari), and Wikidata's figures sit on its broader Persian item. Copying them onto Iranian Persian alone would put Afghanistan's numbers on the wrong language, so the page stays honest and empty until you choose the model. Your decision unlocks it: with the Persian lens (D-023), these rows attach to the lens, and the Iranian Persian page shows them clearly labeled as figures for Persian as a whole.
   - Still yours to decide: the English labels for the Glottolog family nodes Farsic, Eastern Farsic and Farsic-Caucasian Tat, which would otherwise show "Farsi" in the tree and breadcrumbs, against D-004. Options: a display label such as "Persian group" with the Glottolog name in the details, or Glottolog's names as they are.
2. Persian and Turkish UI strings in `apps/web/src/i18n/fa.json` and `tr.json`: all marked "awaiting owner review".
3. Nastaliq digits ۴ ۶ ۷: Noto Nastaliq Urdu follows Urdu shapes. Acceptable for Persian?
4. Persian sample words on `/design` (Scripts section).
5. The palette's "Niger-Congo" token: Glottolog calls the family Atlantic-Congo (atla1278). The spikes map the token to atla1278; the UI name gets settled with linguist-reviewer in Phase 1.
6. From the Phase 1 app shell spec (docs/specs/app-shell.md, section "Open questions"):
   - "Persian" as the name of the macrolanguage, with west2369 shown as "Iranian Persian"? (The wireframes assume yes; this retires the map spike's override that shows west2369 as "Persian".)
   - Some Wikidata speaker figures cite Ethnologue as their reference. Show them as "Wikidata, stated in Ethnologue"? rights-auditor checks first.
   - Ship country pages (/country/:iso) in Phase 1, or later?
   - Figures with no stated kind: dashed ring (more bubbles) or "no data" (stricter)?
   - May a search result show "Alias: Farsi" when that alias matched?
   - Default lens on the start page: Tree or Map?
   - Time slider wording in Phase 1: "Time travel comes in a later update. Everything shows today's data."
   - Traditional classification lens (Niger-Congo with Mande): Phase 1 or later?
   - Persian and Turkish pages: prerendered under /fa/ and /tr/ later, or English HTML with a client switch?

7. **ISO 639-3 code tables (needs a person):** SIL's site refused automated access, so rights-auditor could not read its terms. A 2020 quote of those terms says a product must not "provide a means to redistribute the code set". Until you read https://iso639-3.sil.org/code_tables/download_tables in a browser (or we write to iso639-3@sil.org), the atlas takes ISO codes only from Glottolog, Wikidata and ASJP, and macrolanguage links from CLDR, Wikidata and our reviewed scope list. We do not ship SIL's tables.
8. **Speaker figures that Wikidata cites to Ethnologue:** rights-auditor's rule, provisional: show them one at a time as "Wikidata, stated in Ethnologue (edition, year)", link only to the Wikidata statement, keep them in their own build file, and never include them in downloads or exports. Re-review past 1,000 such rows. Please confirm you are comfortable with this.

9. **Northern Sotho's display name:** Glottolog calls the language Pedi and the family Northern Sotho; Wikidata calls it Northern Sotho with aliases Sepedi and Pedi. Which name to use is a live question in South Africa. linguist-reviewer suggests "Northern Sotho (Sepedi)" with both names recorded. Today the scope list shows "Northern Sotho" with Pedi and Sepedi as alternates. Your call.

10. **Names of disputed places (D-024, with D-019):** country names now come from CLDR 49's default English, Persian and Turkish names, for example "Palestinian Territories" and "Falkland Islands". CLDR also has short and variant forms (Chromium shows "Palestine" and "Falkland Islands (Islas Malvinas)"). Which form should the atlas use for disputed places? It is a one-line change.

## Blocked
1. **Renderer benchmark (D-006): needs you.** `scripts/bench.mjs` opens a visible Chromium with the GPU for each of 10 runs (tree in PixiJS and deck.gl, normal and stress, plus the map; desktop and a 4x-throttled phone proxy). Claude Code stopped it before the first run finished because memory ran critically low. I must not restart it unattended. To run it, close other apps and run:
   ```powershell
   pnpm build
   node scripts/build-territory-index.mjs
   node scripts/bench.mjs docs/reports/2026-11-10-overnight/bench
   ```
   Results land in `docs/reports/2026-11-10-overnight/bench/bench.md`. Until then D-021 picks PixiJS provisionally, from text quality and size only.
   The results record the machine's CPU, RAM and GPU, so numbers from different computers stay comparable.
