# Architecture

Static-first: a Python pipeline turns open sources into versioned files, and a static web app reads them from object storage, so there is no server to run until Phase 5.

## Flow and gates
Open sources → (rights-auditor clears each license) → Python pipeline → (linguist-reviewer gates the content) → Build artifacts → (every branch gets a preview URL) → Static hosting → (qa-gatekeeper: tests, accessibility, budgets) → Web app.

- Open sources: Glottolog 5.3, Wikidata, CLDR, CLDF datasets (WALS, Grambank, PHOIBLE, ASJP), Glottography polygons, audio archives, commissioned recordings, content/.
- Python pipeline: fetch, normalize, validate, build, with provenance on every row; audio: loudness, trim, Opus encoding, waveform peaks, word alignment.
- Build artifacts: Parquet tables, a JSON bundle per language, PMTiles areas by period, Opus audio with peaks, a search index, a manifest of versions and licenses.
- Static hosting: Cloudflare Pages for the app shell and prerendered entity pages; R2 for audio, tiles and Parquet, read with HTTP range requests.
- Web app: Tree (PixiJS), Map (MapLibre and deck.gl), Time; one store, the URL as truth; Inspector, DuckDB-WASM, MiniSearch, Web Audio; works offline as a PWA.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| App framework | React with React Router in framework mode (SPA plus build-time prerender) on Vite | Keeps one canvas mounted across routes, yet every language gets a static, shareable page |
| Tree renderer | PixiJS (WebGL or WebGPU) with d3-hierarchy for layout | Tens of thousands of nodes with crisp text at 60 fps; final pick after the Phase 0 spike |
| Map | MapLibre GL with deck.gl layers and self-hosted PMTiles | Open source, vector, time-filtered layers, no per-view tile fees |
| State | Zustand plus URL search params | One selection for all lenses; every view is a link |
| In-browser data | DuckDB-WASM over Parquet; JSON bundles for profiles | Powers the Lab's queries without a backend |
| Search | MiniSearch index built at build time | Fuzzy search across names in many scripts |
| Motion | Motion for UI, GSAP for story-map timelines | GSAP has been free for commercial use since April 2025 (https://gsap.com/community/standard-license/) |
| Audio | Web Audio API with wavesurfer.js | Spectrograms, pitch contours, precise timing |
| Localization | i18next with ICU messages, CSS logical properties | Persian (RTL) and Turkish interfaces |
| Pipeline | Python 3.12, uv, pycldf, polars, geopandas, tippecanoe and PMTiles, ffmpeg | Native tooling for CLDF data and vector tiles |
| Hosting | Cloudflare Pages and R2 | Static pages plus large files served by range requests |
| Testing | Vitest, Playwright, axe-core, Lighthouse CI; pytest and pandera | Every promise in the spec is checked automatically |

Check current stable versions with Context7 before pinning anything.

## Budgets

| Budget | Target |
| --- | --- |
| Initial JavaScript for the app shell (gzip) | 250 KB or less |
| Largest Contentful Paint, mid-range phone on 4G | 2.5 s or less |
| Interaction to Next Paint | 200 ms or less |
| Tree zoom and pan | 60 fps on desktop with every languoid loaded; 45 fps or more on a mid-range phone |
| Map pan and zoom | 60 fps on desktop |
| Memory after five minutes of exploring | 500 MB or less on desktop |
| Audio start after a tap (cached) | 150 ms or less |

## Repo layout

```text
apps/web/
  app/routes/        canvas layout route + entity pages
  src/canvas/tree/   PixiJS renderer, layouts, level of detail
  src/canvas/map/    MapLibre + deck.gl layers
  src/canvas/time/   time lens, language river, charts
  src/inspector/     profile tabs and cards
  src/audio/         player, waveform, spectrogram, IPA chart
  src/state/         Zustand stores, URL sync
  src/design/        tokens, components
  src/i18n/          en, fa, tr
pipeline/            fetch/ normalize/ build/ validate/ audio/
content/             languages/ families/ trails/ stories/ historical/ credits.md sources.bib
data/                raw/ (gitignored) build/ LICENSES.yaml
docs/ scripts/ tests/ reference/
```

## Build artifacts
- data/build/*.parquet: languoids, speakers, territories, areas, forms, phonemes, features, edges
- data/build/bundles/{glottocode}.json: one profile payload per languoid, under 50 KB each
- data/build/tiles/*.pmtiles: language areas by period, basemap
- data/build/audio/{id}.opus plus peaks JSON
- data/build/search/index.json
- data/build/manifest.json: versions, checksums and the license of every asset

## Environments
- Local: pnpm dev against local data/build.
- Preview: every branch deploys to its own preview URL.
- Production: main branch; assets on R2 with content-hashed names and long cache lifetimes.

## Privacy
No accounts until Phase 5; progress (passport, trails) lives in the browser; mic practice never leaves the device; analytics, if any, without third-party trackers.
