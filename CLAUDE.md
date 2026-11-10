# Tree of Tongues

Interactive atlas of the world's languages: a zoomable family tree, a time-aware world map and deep language profiles with real voices. Built for language lovers who will spend hours exploring. Free and non-commercial forever. Owner and final reviewer for Persian, Turkish and English content: Siavash.

## Read before working
- docs/SPEC.md: modules, depth ladders, data model, acceptance criteria
- docs/ARCHITECTURE.md: stack, repo layout, performance budgets
- docs/DATA_SOURCES.md: sources, licenses, how to use each
- docs/CONTENT_STYLE.md: voice, naming, badges, citations
- docs/ROADMAP.md: phases, exit criteria, risks
- docs/DECISIONS.md: decision log (append only)

## The nerd contract (non-negotiable)
1. No dead ends: every view links to at least three deeper or related views.
2. No fact without provenance: every number, date, form, IPA string and claim carries source, locator, retrieval date, license and confidence (high, medium, low, contested). Unknown is a valid value. Never fill gaps from memory.
3. Badge every sound: Recording (a real speaker), Reconstruction (scholarly, with evidence), Synthetic (TTS). Never present synthetic or reconstructed audio as a recording.
4. Contested stays contested: show competing hypotheses with evidence strength (PIE homeland, Altaic or Transeurasian, Japonic-Koreanic, language-versus-dialect cases).
5. Speaker numbers are estimates: show source and year; when sources disagree, show the range and each source.
6. Names: English name, endonym in native script, romanization, IPA. The English UI says "Persian"; "Farsi" appears only as a search alias or inside a romanized endonym (fārsi). Record alternate names.
7. Maps: neutral rendering of disputed territories; historical borders labeled approximate; never imply that a language belongs to a state.
8. Respect communities: follow archive access protocols; no sacred or restricted material; describe cultures through their own artifacts and voices.
9. Copy: no em dashes in UI copy or content (scripts/lint-content.mjs enforces this); short sentences; specifics over adjectives.
10. Performance and accessibility are features: budgets in docs/ARCHITECTURE.md; keyboard paths and screen-reader text for every visualization; prefers-reduced-motion respected.
11. Free forever: non-commercial, no ads, no paid tiers, no third-party tracking.

## Stack (details and rationale in docs/ARCHITECTURE.md)
- Web: TypeScript, React, React Router in framework mode (SPA plus build-time prerender of entity pages), Vite, Zustand, Tailwind CSS, Radix primitives, i18next.
- Rendering: PixiJS for the tree canvas, deck.gl plus MapLibre GL for maps, d3 for layout and zoom math only, Motion for UI transitions, GSAP for story-map timelines.
- In-browser data: DuckDB-WASM over Parquet; MiniSearch for search.
- Audio: Web Audio API, wavesurfer.js (waveform, spectrogram).
- Pipeline: Python 3.12 with uv, pycldf, polars, geopandas, shapely, tippecanoe and PMTiles, ffmpeg.
- Tests: Vitest, Playwright, axe-core, Lighthouse CI; pytest and pandera for data.
- Hosting: static site plus object storage with HTTP range requests (Cloudflare Pages and R2 suggested).

## Repo layout
- apps/web/: the app
- pipeline/: Python ETL (fetch, normalize, build, validate) and pipeline/audio/
- content/: authored content (profiles, trails, stories, historical/, credits.md, sources.bib)
- data/raw/: gitignored, immutable downloads listed in data/raw/MANIFEST.yaml
- data/build/: generated outputs; data/LICENSES.yaml: one entry per source and asset class
- LICENSE (MIT, code), LICENSE-CONTENT.md (CC BY-SA 4.0, writing), CONTRIBUTING.md
- docs/, scripts/, tests/, reference/ (local only)

## Commands (created in Phase 0; keep this list true)
- pnpm dev, pnpm build, pnpm test, pnpm e2e, pnpm lint, pnpm lint:content, pnpm check:a11y, pnpm check:perf
- uv run pipeline fetch | build | validate | audio

## Git workflow
- Each phase works on its own branch: phase-0, then phase-1 and so on.
- Push the phase branch to GitHub after every commit.
- Merge into main only when the phase gate in docs/ROADMAP.md passes. Never commit to main directly.

## Data rules
- Before ingesting any source, rights-auditor records it in data/LICENSES.yaml: license, attribution, share-alike, non-commercial and no-derivatives terms, restrictions.
- Prefer versioned dumps and APIs (CLDF releases on Zenodo, Wikidata SPARQL, CLDR JSON). Respect robots.txt and terms. No scraping of Ethnologue, Omniglot, Forvo, Seeing Speech or any site whose terms forbid it.
- Raw downloads are immutable, dated and checksummed; builds are reproducible from raw plus code.
- IDs: Glottocode is the primary key for languoids; ISO 639-3, Wikidata QID and CLDR codes are cross-references.
- Non-commercial forever: no ads, no paid tiers, no sponsorship tied to content. That is why non-commercial (NC) licenses are usable here; anything that monetizes would void them.
- Keep each share-alike or no-derivatives source in its own files, with its license beside it.
- Open by default: code under MIT (LICENSE), original writing under CC BY-SA 4.0 (LICENSE-CONTENT.md), project recordings on Wikimedia Commons; data files keep each source's license.
- reference/ holds third-party images for local use only; never commit them.

## Delegation map
Use subagents proactively. Subagents cannot call each other; you orchestrate.

| Work | Agent |
| --- | --- |
| Datasets, pipeline, schemas, coverage reports | data-curator |
| Any linguistic claim, number, IPA or classification before merge | linguist-reviewer |
| Historical stages, reconstructions, sound changes, word journeys, map keyframes | historical-linguist |
| Profiles, trails, story scripts, UI microcopy | content-writer |
| Maps, historical layers, story maps | cartographer |
| Tree, zoom, WebGL, charts, transitions | viz-engineer |
| Audio pipeline, players, IPA chart, TTS labeling | audio-engineer |
| Design system, motion, layout, design reviews | ux-designer |
| Scripts, fonts, RTL and bidi, localization | script-typographer |
| Licenses, attribution, credits | rights-auditor |
| Tests, performance, accessibility, release gate | qa-gatekeeper |

Content pipeline: content-writer drafts; linguist-reviewer checks (historical-linguist too for historical material); rights-auditor clears assets; then merge.
Engineering pipeline: ux-designer specs; the engineering agent builds; qa-gatekeeper verifies; then merge.

## Definition of done (every task)
- Seen working in a real browser (Playwright screenshot reviewed); keyboard accessible; no console errors.
- Tests added or updated; pnpm test, pnpm lint and pnpm lint:content pass.
- New facts have provenance; new assets have license entries.
- docs/ updated when behavior or decisions change; decisions appended to docs/DECISIONS.md.

## Never
- Invent data, quotes, IPA, audio or citations.
- Present a reconstruction as fact, or synthetic speech as a recording.
- Clone or imitate a real person's voice.
- Add a paid API or service without asking the owner.
- Add ads, paywalls, paid features or sponsorships: the project is non-commercial forever.
- Copy text beyond what its license allows; write original summaries and cite.
