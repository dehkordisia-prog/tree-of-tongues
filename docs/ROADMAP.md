# Roadmap

Six phases, each ending at a gate you can test. The kickoff prompt (KICKOFF_PROMPT.md) covers Phases 0 and 1; paste the prompts below to start each later phase. Every phase starts in plan mode and closes only when its gate passes. New ideas go to the Backlog section at the end, not into the current phase.

| Phase | What ships | Gate to pass |
| --- | --- | --- |
| 0. Foundations | Pipeline for Glottolog, CLDR and Wikidata; design tokens, fonts; tree and map spikes | Builds reproduce from raw data; spike results logged in docs/DECISIONS.md; licenses filed |
| 1. First slice | Tree, Map and Profile for the 100 languages of the reference chart; search; deep links; gold-standard Persian, Turkish and English | Owner approves the pilot trio; budgets and WCAG 2.2 AA met; qa-gatekeeper PASS |
| 2. Time | Time slider across lenses, keyframes, language river; six story maps; culture shelves | Every keyframe cites a source; no-data states instead of guesses; qa-gatekeeper PASS |
| 3. Sound and words | IPA chart, audio pipeline, concept maps, word journeys, loan flows; Writing module; Hear it then pilot | Every clip badged and licensed; reconstructions pass linguist-reviewer; qa-gatekeeper PASS |
| 4. Depth and play | Grammar module, games, passport, Polyglot Mirror; Persian and Turkish interface | Owner approves every UI string; games tested on mobile; qa-gatekeeper PASS |
| 5. Scale and launch | Every Glottolog language, Lab and Compare, sign languages, offline mode, SEO | Release gate passed; rights report complete; owner signs off |

## Phase 2 prompt: Time

```markdown
Phase 2: Time. Read docs/ROADMAP.md (Phase 2) and the Time, Map and Culture shelf parts of docs/SPEC.md. Start in plan mode.

1. historical-linguist: keyframes for Indo-European, Turkic, Semitic, Sinitic, Bantu and Austronesian, plus the stages of Persian, Turkish and English: approximate areas per period with uncertainty, and speaker estimates as ranges. Every keyframe cites sources.
2. cartographer: time-aware layers (historical borders labeled approximate, language areas by period, speaker dots that migrate) and "no data for this period" states.
3. viz-engineer: the Time lens: era bands, the language river (descent and contact), speaker-over-time charts with uncertainty.
4. content-writer with cartographer: six story maps (Indo-European dispersal, the Bantu expansion, Austronesian voyages, the spread of Arabic, Turkic migrations, the Persianate world), each pausable and with a text alternative.
5. content-writer: culture shelves (3 to 5 artifacts) for the 100 languages; rights-auditor clears every image.

Gate: every keyframe cites a source; no-data states instead of guesses; qa-gatekeeper PASS. Show me screenshots of each story-map step.
```

## Phase 3 prompt: Sound, words and writing

```markdown
Phase 3: Sound, words and writing, plus the Hear it then pilot. Read docs/ROADMAP.md (Phase 3) and the Sounds, Words, Writing and Hear it then parts of docs/SPEC.md. Start in plan mode.

1. audio-engineer with rights-auditor: the audio pipeline and licensed sources; an IPA chart where every symbol plays; sound pages (languages that have the sound, where on Earth); spectrogram and pitch views.
2. data-curator: ingest PHOIBLE, ASJP, WOLD, Concepticon and kaikki with provenance.
3. viz-engineer: concept maps (one meaning across languages, colored by cognate class), animated word journeys across map and time, a loan-flow chord diagram.
4. script-typographer: the Writing module (script family tree, letter pages, stroke order, transliteration playground, undeciphered room).
5. historical-linguist with audio-engineer: Hear it then for English (Old English to today, including 1750), Persian (Classical with ē, ō and [w]; modern Dari; Tehran) and Turkish (Ottoman to today), with evidence per feature and commissioned or licensed recordings.

Gate: every clip badged and licensed; reconstructions pass linguist-reviewer; qa-gatekeeper PASS.
```

## Phase 4 prompt: Depth and play

```markdown
Phase 4: Depth and play. Read docs/ROADMAP.md (Phase 4) and the Grammar and Play parts of docs/SPEC.md. Start in plan mode.

1. Grammar module: WALS and Grambank maps, the language DNA glyph, typological twins, glossed example sentences (Leipzig Glossing Rules).
2. Play: guess the language (audio), family puzzle, cognate detective, script sprint, time-traveler quiz; an explorer passport and curated trails stored in the browser.
3. Polyglot Mirror: readers pick the languages they speak and see shared words, loan flows and shared grammar.
4. script-typographer: Persian (RTL) and Turkish interfaces; I review every string.
5. Extend Hear it then to Arabic, Latin and the Romance languages, and Mandarin.

Gate: I approve every UI string; games tested on mobile; qa-gatekeeper PASS.
```

## Phase 5 prompt: Scale and launch

```markdown
Phase 5: Scale and launch. Read docs/ROADMAP.md (Phase 5). Start in plan mode.

1. data-curator: basic profiles for every Glottolog language, with honest "no data yet" states and coverage badges.
2. Lab and Compare: compare up to four languages, a lexical distance matrix and network, a DuckDB query builder with CSV export.
3. Sign languages: video clips where licensed, plus sign-language family views.
4. Performance hardening, offline mode (PWA), prerendered entity pages with share images.
5. rights-auditor: release compliance report, a complete credits page and a public page listing every source and license.
6. qa-gatekeeper: the full release gate.

Gate: release gate passed; rights report complete; I sign off on launch.
```

## Risks and honest limits

| Risk | What goes wrong | Mitigation |
| --- | --- | --- |
| Accidental commercialization | Ads, paid tiers or sponsorships would void the non-commercial licenses the app relies on | Non-commercial charter in docs/DECISIONS.md; rights-auditor flags any feature that would monetize |
| Sparse historical data | Beautiful maps that are wrong | Keyframes only where sourced, uncertainty drawn as feathered edges, "no data for this period" states, reviewer gate |
| Uncertain reconstructions | Readers hear a scholar's best guess as fact | Reconstruction badge, evidence per feature, confidence levels, named sources; nothing before about 1860 is ever called a Recording |
| Disagreeing speaker numbers | Political heat and false precision | Each source shown with its year, as a range; never averaged |
| Names, borders, language versus dialect | Offended communities, lost trust | Glottolog default with labeled alternative lenses, neutral border styling, attributed positions, reviewer checks |
| AI-written errors | One viral mistake undoes credibility | No fact without a source, linguist-reviewer gate, owner approval for the pilot trio |
| Scope creep | The project never ships | Phase gates; every phase ships something usable; new ideas go to the Backlog |
| Performance | Tens of thousands of nodes, maps and audio make phones stutter | Spikes before building, budgets checked in CI, level of detail |
| Costs | Paid APIs and TTS quietly add up | Static-first hosting, no paid service without owner approval |
| Data sovereignty | Restricted Indigenous or archival material gets published | Archive access protocols, community-authored descriptions, nothing sacred |

What the app cannot honestly promise: the true sound of any language before recording began (the oldest surviving recording of a human voice dates from 1860), exact speaker counts, or sharp historical borders. Its job is to show the best evidence and how sure we are.

## Backlog
Add ideas here with a date and one line each. Review at the start of every phase.
