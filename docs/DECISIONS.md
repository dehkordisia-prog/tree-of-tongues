# Decisions log

Append only. One entry per decision: ID, date, decision, why, alternatives, revisit when.

- D-001 (2026-11-10). Glottocode is the primary key for every languoid. Why: stable, open (CC BY 4.0), covers families, languages and dialects. Alternatives: ISO 639-3 (no families or dialects), Wikidata QIDs (less curated classification). Revisit: never.
- D-002 (2026-11-10). Classification follows Glottolog by default. Traditional groupings, such as the Ethnologue-style tree in reference/infographic.png (for example Niger-Congo including Mande), appear only as a labeled alternative lens. Why: open data with documented criteria. Revisit: if users ask for more lenses.
- D-003 (2026-11-10). Every clip carries one of three badges: Recording, Reconstruction, Synthetic. Why: honesty about what users hear. Revisit: never.
- D-004 (2026-11-10). The English UI names the language "Persian"; "Farsi" exists only as a search alias. Owner decision.
- D-005 (2026-11-10). Speaker figures are never averaged. Each source is stored and shown with its year; disagreements appear as ranges. Why: estimates differ by method and date.
- D-006 (pending). Tree renderer: PixiJS or deck.gl, decided by the Phase 0 spike results (fps, memory, text quality).
- D-007 (2026-11-10). Non-commercial forever: no ads, no paid tiers, no paid features, no sponsorship tied to content. The atlas is a contribution to people who love languages. Consequence: non-commercial (NC) sources such as the Speech Accent Archive, MMS-TTS and NC Glottography datasets are usable; any monetization would void them. Owner decision.
- D-008 (2026-11-10, confirmed by owner). Open by default, public on GitHub from day one: code under the MIT license; original writing under CC BY-SA 4.0; project recordings uploaded to Wikimedia Commons; data files keep each source's license. Why: others can learn from, reuse and improve the atlas.
- D-009 (2026-11-10). Third-party reference images (such as the 100 most-spoken languages chart) stay local in reference/ and are never committed, because the repository is public.
- D-010 (2026-11-10). Toolchain pins for Phase 0: React 19.3.1, React Router 8.5.1 (framework mode, `ssr: false` plus `prerender: true`), Vite 8.3.6, Tailwind 4.3.5, PixiJS 8.22.0, deck.gl 9.4.1, MapLibre 6.16.0, Vitest 5.1.0, Playwright 1.65.0; Python 3.12 with polars 2.1.0 and pycldf 2.1.1. Versions are exact pins in package.json and pyproject.toml. Why: reproducible builds. Revisit: at the start of each phase.
- D-011 (2026-11-10). TypeScript is pinned to 6.0.3, not 7.0. Why: typescript-eslint 8.72 supports TypeScript below 6.1 only. Alternatives: TypeScript 7 without type-aware linting. Revisit: when typescript-eslint supports 7.
- D-012 (2026-11-10). Supply-chain guard: pnpm's minimum release age check stays on, and we pin releases at least three days old instead of adding exclusions. Why: most malicious npm releases are caught within days. Revisit: never.
- D-013 (2026-11-10). Vector tiling (tippecanoe, PMTiles) is deferred to Phase 2 and will run in WSL or CI. Phase 0 maps read GeoJSON. Why: tippecanoe has no native Windows build, and Phase 0 data is small enough for GeoJSON. Revisit: Phase 2.
- D-014 (2026-11-10). Fonts are self-hosted and the app makes no third-party requests at runtime. Why: privacy (CLAUDE.md rule 11) and offline use. Revisit: never.
