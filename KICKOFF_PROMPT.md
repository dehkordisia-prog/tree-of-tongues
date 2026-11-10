# Kickoff: Tree of Tongues

You are the lead engineer, product designer and orchestrator for Tree of Tongues, an interactive atlas of the world's languages for people who love languages.

Read first: CLAUDE.md, then docs/SPEC.md, docs/ARCHITECTURE.md, docs/DATA_SOURCES.md, docs/CONTENT_STYLE.md and docs/ROADMAP.md. Look at reference/infographic.png: the 100 most-spoken languages as a family tree, bubbles sized by total speakers (outer) and native speakers (inner). It sets the v1 scope and the starting visual idea; do not copy its design.

## What we are building
One world canvas with three linked lenses: Tree (genealogy), Map (geography) and Time (history). Zoom from families to branches to languages to stages and dialects, then into words, sounds, letters and sources. Every object opens into something deeper. Sound everywhere: real recordings first; reconstructions and synthetic speech only when clearly badged.

## This session: Phase 0 (foundations) and Phase 1 (first vertical slice)
Start in plan mode. Propose the plan, wait for my approval, then build.

Phase 0, foundations
1. Scaffold the repo as described in docs/ARCHITECTURE.md. Check current stable versions with Context7 before pinning.
2. With data-curator: a pipeline that fetches Glottolog (CLDF), CLDR territory-language data and Wikidata speaker figures into data/raw/ (dated, checksummed), normalizes them to the data model in docs/SPEC.md and emits data/build/ (Parquet plus JSON bundles). Every fact keeps source, license, retrieval date and confidence.
3. With rights-auditor: create data/LICENSES.yaml for every ingested source, including attribution, share-alike and no-derivatives terms.
4. With ux-designer and script-typographer: design tokens, a type system with Noto by script, RTL support from day one, and a one-page docs/DESIGN.md.
5. Two spikes, measured with Chrome DevTools: (a) viz-engineer: zoomable tree of all Glottolog languoids at 60 fps with semantic zoom; (b) cartographer: MapLibre map with language points, a country choropleth and a time-slider stub. Report fps and memory, choose the rendering approach from the evidence and log it in docs/DECISIONS.md.

Phase 1, first vertical slice (exit criteria in docs/ROADMAP.md)
- Tree: the infographic's 100 languages and their families; bubbles sized by L1 and total speakers; click-to-focus with an animated camera; breadcrumbs; semantic zoom; a Lumper/Splitter toggle for Arabic, Chinese and Persian.
- Map: pick a language to see where it is spoken today, with speakers and official status per country; pick a country to see its languages.
- Profile: tabs for Overview, Speakers, Where, Writing, Sounds (greeting and numbers 1 to 10 where licensed audio exists), Words (40-item Swadesh list), Family, Sources. Gold-standard depth for Persian, Turkish and English.
- Search (Cmd+K) across English names, endonyms, alternate names, ISO 639-3 codes and Glottocodes.
- Deep links for every state: selection, lens, year, zoom.

## How to work
- Delegate using the map in CLAUDE.md. Reader-facing content flows content-writer, then linguist-reviewer (plus historical-linguist for anything historical), then rights-auditor, then merge.
- After each UI milestone, show me Playwright screenshots (1440x900 and 390x844) with a three-line summary.
- Ask me only about decisions that are expensive to reverse: stack changes, paid services, licensing trade-offs. Decide everything else, log it in docs/DECISIONS.md and keep going.
- Never invent a number, date, form, IPA or source. Unknown is a valid value and shows as "no data yet".
- Small commits with clear messages; keep docs/ current.

## Done for this session
pnpm dev runs; Tree, Map and Profile work for the 100 languages; the Persian, Turkish and English profiles pass linguist-reviewer; tests, lint, content lint and accessibility checks pass; the budgets in docs/ARCHITECTURE.md are met or the gap is reported with a plan.
