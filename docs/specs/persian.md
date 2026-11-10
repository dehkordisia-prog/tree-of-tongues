# Spec: Persian lens, Farsic labels, the Farsi alias and Persian digits in Nastaliq

Status: draft, 2026-11-10. Written by the orchestrator from the owner's decisions D-028 to D-033. Implements those decisions; amends docs/specs/app-shell.md where noted. Items marked **(P)** are provisional choices made in this spec; the owner may overrule them.

Tests written with this spec are marked pending (Vitest `it.skip`, Playwright `test.fixme`, pytest `skip`) and each one names this spec. The implementer removes the mark when the behavior lands. A pending test that still fails after the work is a bug in the work or in the test, never a reason to delete the test.

| Part | Decisions | Pending tests |
| --- | --- | --- |
| 1. Persian lens | D-028, D-029, D-033 | tests/pipeline/test_persian_lens.py, apps/web/src/data/persianLens.test.ts |
| 2. Farsic display labels | D-030 | apps/web/src/data/names.test.ts |
| 3. "Alias: Farsi" in search | D-031, D-004 | apps/web/src/search/persian.test.ts |
| 4. Persian digits in Nastaliq | D-032 | apps/web/src/design/fonts.test.ts, tests/e2e/nastaliq-digits.spec.ts |

## 1. Persian lens (D-028, D-029)

### 1.1 What it is
- One entity, id `persian`, named "Persian" in English (D-029). It is the scope list's lumper group `persian`: Iranian Persian (west2369), Dari (dari1249) and Tajik (taji1245).
- It is labeled everywhere as the atlas's own grouping. It is not an ISO macrolanguage (ISO's fas has no Tajik) and not a Glottolog node (Glottolog's nearest ancestor, Farsic fars1255, has more members).
- Glottolog's tree stays the default view (D-002). The lens is opt-in through the existing Split or Grouped control (?lump=persian, D-026).

### 1.2 Route **(P)**
- `/group/persian`, not `/macrolanguage/fas`. Why: the lens is our grouping, and keying it by ISO's code would say ISO defines it. This amends app-shell.md 2.1 for Persian only. Arabic and Chinese keep the app-shell plan until their own decisions.
- `/macrolanguage/fas` redirects with replace to `/group/persian`, so links written against app-shell.md keep working.
- Prerendered with the other entity pages. Level chip: "Grouping". Header subline: "Our grouping: Iranian Persian, Dari and Tajik."

### 1.3 Three views, side by side
The group Inspector, and the "Why linguists disagree" slot on each member, show one compact table: who is in Persian according to whom.

| View | Members | Source |
| --- | --- | --- |
| This atlas (default label "Our grouping") | Iranian Persian, Dari, Tajik | D-028, scope list |
| ISO 639-3 macrolanguage fas | Iranian Persian (pes), Dari (prs) | Interim (D-033): Wikipedia, "ISO 639 macrolanguage". Intended replacement: SIL's code tables, once the owner clears their terms (overnight question 7) |
| Glottolog 5.3 | No node for Persian. Nearest ancestor: Persian group (Farsic, fars1255), which also holds Judeo-Persian, Hazaragi, Aimaq, Dehwari, Pahlavani and Bukharic | Glottolog 5.3 |

- Every member name links to its page. The Glottolog row links to fars1255.
- The table is a real `<table>` with a caption ("Who counts as Persian"), so screen readers get row and column headers.
- Data: a new `views` block on `lumper_groups.persian` in content/scope/phase-1-languages.yaml, each view with members, source, locator, retrieval date, confidence and, for interim sources, `interim: true` and `replace_with`. linguist-reviewer checks it before merge. No member list is typed into app code.

### 1.4 Figures for Persian as a whole
- **Which rows.** CLDR 49 territory rows for code `fa`, and Wikidata speaker statements on Persian (Q9168). Today the CLDR rows are left unmapped and the Wikidata rows sit on fars1254 with `attached_via = wikidata_p1394_to_family`.
- **Where they go.** They attach to the group, never to a member. The pipeline reads the attachment from the scope list (`lumper_groups.persian.attach: {cldr: [fa], wikidata: [Q9168]}`), not from code.
- **Tables.** speakers and territories gain a nullable `group_id`. Each row has exactly one of `glottocode` and `group_id`. validate fails on a row with both or neither, and on a group id that is not in the scope list.
- **Bundle.** The pipeline writes data/build/groups/persian.json (schema 1): `id`, `label`, `members`, `views`, `speakers`, `territories`, `sources`. It is listed in manifest.json, and validate checks it like the other bundles.
- **Moved, not copied.** The rows leave fars1254's bundle. In their place it gets a pointer: "Wikidata attaches Persian (Q9168) here. Its figures are shown on Persian, the atlas's grouping." west2369, dari1249 and taji1245 never receive these rows (test).
- **Labels.**
  - Every such figure carries the scope label: "Figure for Persian as a whole, not for Iranian Persian alone." The wording goes to content-writer and then linguist-reviewer; this sentence is a placeholder.
  - A CLDR share for Afghanistan under `fa` is shown as CLDR states it. The atlas does not relabel it as Dari.
- **Never summed.** The group shows only figures stated for Persian itself. It never adds its members' figures (app-shell.md 5).
- **Tajik.** CLDR's `tg` rows already map to Tajik directly and stay there.

### 1.5 Member pages
- Iranian Persian keeps its own fields. Where it has no own figure, "No data yet" stays, and beneath it a labeled block appears: "Persian as a whole" with the group's figures and a link to /group/persian. Same for Dari and Tajik.
- Breadcrumb in the split view is Glottolog's (section 2 labels). In the grouped view, the Persian crumb sits between Persian group (fars1255) and the member (app-shell.md 6.3).
- The owner-pending note in the Lumper slot goes away. In the scope list, `owner_decision: pending` becomes `owner_decision: D-028`, and the owner_decisions entries `persian_grouping` and `farsic_family_labels` get `status: decided` and `decision: D-028` and `D-030`. The existing tests that expect "pending" (tests/pipeline/test_scope.py, apps/web/src/data/scope.test.ts) change with it.

### 1.6 Search
- "Persian" finds the group as its own result, in the Macrolanguages group renamed "Groupings" **(P)**, whatever the lump state (app-shell.md 6.3). The result shows "Our grouping" as its path.
- Iranian Persian is still found by "Persian" through its alternate name.

### 1.7 Acceptance
- /group/persian shows the three views, the figures with source, year and scope label, and links to all three members, plus at least three deeper links (nerd contract 1).
- No figure from CLDR `fa` or Q9168 appears on west2369, dari1249 or taji1245 as their own.
- validate passes on the real build, and fails on the broken cases in 1.4.

## 2. Farsic display labels (D-030)

Proposed by linguist-reviewer (docs/reviews/farsic-labels.md). Provisional until the owner approves.

| Glottocode | Glottolog name (details only) | English display label |
| --- | --- | --- |
| fars1254 | Farsic-Caucasian Tat | Persian and Caucasian Tat |
| fars1255 | Farsic | Persian group |
| east2745 | Eastern Farsic | Eastern Persian group |
| sout2645 | Fars Dialects | unchanged ("Fars" is the province) |
| taji1250 | Tajikic | unchanged |

- **Where labels live.** As `display_name` with `display_name_decision: D-030` on these families in the scope list's `families` block. The pipeline copies them into the `name` field of tree.json, bundles and search documents, and keeps `glottolog_name` beside them. apps/web/src/data/names.ts `LABEL_FALLBACKS` then holds only what the scope list cannot carry yet; the west2369 fallback goes once the pipeline emits its display name.
- **Details.**
  - The Inspector header shows the display label.
  - The details list shows "Glottolog name: Farsic" with Glottolog as its source.
  - The screen-reader gloss is the reviewer's sentence for each node.
- **Coverage.** Every surface that names a languoid uses the display label: tree labels, breadcrumbs, search results, family paths in search, Go deeper cards, sisters, screen-reader text and page titles.
- **Locales.** Persian and Turkish labels are the owner's to write. Until then, those UIs fall back to the English display label, never to Glottolog's name. The rules in the review hold in every locale: fars1254 names Caucasian Tat, and the other two carry a word for "group".

## 3. "Alias: Farsi" in search (D-031)

Most of this already exists (apps/web/src/search/engine.ts, source.ts, `search.matchAlias`). This part pins the behavior down with tests and closes two gaps.

- A result shows "Alias: Farsi" only when the alias was what matched. A query that matched the name, an endonym or a code never shows the alias line.
- "Farsi" is never a result's name, family path or crumb, in any tier (already validated in the pipeline; now also tested in the app adapter).
- **Who carries the alias.** "Farsi" and "fārsi" are aliases of the Persian group (section 1) and of Iranian Persian. A "Farsi" query returns both, and each shows "Alias: Farsi".
- **Glottolog names that contain the alias** ("Western Farsi"). They still match. **(P)** The match line reads "Glottolog name: Western Farsi" instead of "Alias: Western Farsi", because it is Glottolog's name, not an alias the atlas chose. New key `search.matchGlottolog`. The owner may prefer the plain alias line; it is a one-key change.
- **Display-labeled families** (section 2). A query that matches only their Glottolog name ("Farsic", "Eastern Farsic") shows the display label as the result and "Glottolog name: Farsic" as the match line.
- **Fars Dialects.** The "Farsi" query must not label it with an alias (linguist-reviewer follow-up). Today it is reached only by the fuzzy name rule. A test holds that.

## 4. Persian digits in Nastaliq (D-032)

### 4.1 Finding (checked 2026-11-10 with fontTools 4.68 on the shipped woff2 files)
- **Noto Nastaliq Urdu 3.007.**
  - U+06F4, U+06F6 and U+06F7 map to glyphs named FourUrdu, SixUrdu and SevenUrdu.
  - The font lists a FAR (Persian) language system, but its GSUB has no `locl` feature at all. So it has no Persian digit forms to switch to.
- **Noto Naskh Arabic 2.021.**
  - The Urdu and Kashmiri language systems use `locl` to swap U+06F4 and U+06F7 for `.locl` glyphs (and U+06F6 to the Arabic-Indic six).
  - The FAR system's `locl` changes no digit.
  - So the default digit glyphs are the Persian forms. This is an inference from the feature tables; the browser check in 4.4 confirms it visually.
- **Result.** The owner's fallback applies: inside Persian Nastaliq text, digits come from the Naskh font.

### 4.2 Implementation
- **Digit face.** A new face in apps/web/src/design/fonts.css: family "Tongues Persian Digits". Its src is the same Naskh woff2 file (no extra download when Naskh is already loaded), with `unicode-range: U+06F0-06F9`. Western digits and Arabic-Indic digits (U+0660 to U+0669) are not in the range.
- **Scope: Persian only.** Urdu is a scope language and Urdu readers expect the Urdu forms.
  - New stack `--font-arabic-nastaliq-fa: "Tongues Persian Digits", "Noto Nastaliq Urdu", "Noto Naskh Arabic", "Tongues Sans", system-ui, serif;`
  - Applied by `.script-nastaliq:lang(fa)`. `--font-arabic-nastaliq` is unchanged, so `.script-nastaliq:lang(ur)` keeps Urdu digits.
- **Specimen.** In ScriptSpecimen.tsx, the Nastaliq note no longer says the owner should check the digits. It says "Digits come from Noto Naskh Arabic, in Persian forms (D-032)."
- **Licenses.** No new font file, so no new license entry. rights-auditor confirms that reusing the OFL Naskh file under a second family name in CSS needs no notice beyond the existing one. It does not rename the font file itself.

### 4.3 Risks
- Mixing faces inside a word is harmless for digits, which do not join. A number set in a different face from its letters may sit at a slightly different size; ux-designer checks the specimen at text-2xl.
- If a later Nastaliq font with Persian `locl` digits is cleared, drop the digit face and keep the `:lang(fa)` rule (D-032 revisit).

### 4.4 Acceptance
- On /design with ?lang=fa, the Nastaliq specimen's digit line renders ۴ ۶ ۷ with Noto Naskh Arabic (Chromium's platform-fonts report through CDP), and its letters with Noto Nastaliq Urdu.
- An Urdu Nastaliq sample (lang="ur") still renders its digits with Noto Nastaliq Urdu.
- Screenshot of both lines reviewed by the owner.

## 5. Order of work (tonight or the next session with memory)
1. data-curator: section 1.4 and section 2 in the pipeline; fixture additions; un-skip tests/pipeline/test_persian_lens.py; real rebuild and validate.
2. content-writer, then linguist-reviewer: the scope label sentence (1.4), the views block sources (1.3), the screen-reader glosses (2).
3. Engineering: the group route and Inspector (1.2, 1.3, 1.5), search (1.6, 3), digits (4). ux-designer specs the three-views table first. Un-skip the app tests.
4. qa-gatekeeper: browser checks in English and Persian at 1440 and 390, axe, and the e2e digit test.
5. Owner: approve the labels (2), the scope sentence (1.4) and the (P) items: the route, "Groupings", and the "Glottolog name:" match line.
