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
