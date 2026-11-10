# Phase 1 plan: first vertical slice

Status: drafted overnight on 2026-11-10 without owner review. The owner asked for work to continue without approvals; everything here is provisional and listed in docs/reports/2026-11-10-overnight.md.

## Context
Phase 0 built the foundations: pipeline, licenses, design system, fonts and RTL, and two spikes. Phase 1 turns them into the first real slice (docs/ROADMAP.md): Tree, Map and Profile for the 100 languages of the reference chart, search, deep links, and gold-standard profiles for Persian, Turkish and English.

**Gate:** owner approves the pilot trio; budgets and WCAG 2.2 AA met; qa-gatekeeper PASS.

**Overnight limits:**
- Nothing is approved by the owner overnight, so the gate cannot close.
- All Persian and Turkish text is marked for review.
- The development machine has little memory, so at most two agents work at once and no headed GPU browser runs unattended.

## Steps

### 1. Scope list (data-curator, then linguist-reviewer)
- Transcribe the 100 language names from the reference chart from full-resolution crops of reference/infographic.png, which stays local and is never committed.
- Map each to a Glottocode, with ISO 639-3 and Wikidata QID as cross-references.
- Write content/scope/phase-1-languages.yaml. Each entry has the chart name, glottocode, Glottolog name and level, the mapping method, a confidence level and notes.
- **Not used:** the chart's speaker numbers. They come from Ethnologue, which we cannot redistribute.
- **Edge cases:** chart entries that are macrolanguages or varieties (Arabic varieties, Chinese varieties, Persian, Pidgins, Western Punjabi, Lahnda) get an explicit mapping decision. These feed the Lumper/Splitter toggle.
- **linguist-reviewer:** reviews every mapping. Unresolved ones stay "contested" with both readings.

### 2. Pipeline additions (data-curator, rights-auditor first where new sources appear)
- Emit the country-to-languages territory index from the pipeline, replacing scripts/build-territory-index.mjs.
- Build the MiniSearch index at build time over English names, endonyms, alternate names, ISO 639-3 codes and Glottocodes. Include search aliases such as "Farsi", flagged as an alias.
- Words tab (40-item Swadesh list):
  - Source: ASJP v21 (CC BY 4.0). rights-auditor files it before ingest.
  - Store forms with doculect, source and confidence.
  - Rows without IPA stay without IPA; the pipeline never generates any.
- Speakers: Wikidata P1098 statements for the 100 languages with references, shown per source and year, never averaged (D-005). Where Wikidata has nothing, the UI shows "no data yet".
- Sounds tab:
  - Greeting and numbers 1 to 10 only where a licensed recording exists: Wikimedia Commons and Lingua Libre, per-file license.
  - rights-auditor clears each file. audio-engineer handles the files.
  - Everything else says "no recording yet".
  - No synthetic audio in Phase 1.

### 3. App shell (ux-designer specs, viz-engineer and others build)
- One Zustand store for selection, lens, year and zoom, synced to the URL (SPEC section 1). Back, forward and shared links restore the view.
- Lens switcher (Tree, Map), the Inspector (right panel on desktop, bottom sheet on mobile), and global search (Cmd+K or Ctrl+K).
- Entity routes: /language/:glottocode and /family/:id, prerendered for the 100 languages and their families.
- Locale moves into the store (removes the session-sticky ?lang behavior).

### 4. Tree (viz-engineer)
- Production tree from the spike, renderer per D-021 (PixiJS, provisional until the benchmark runs).
- Scope: the 100 languages, their family paths, and context nodes.
- Bubbles show L1 inside total speakers, from sourced figures only. Languages without a figure get a "no data" ring of fixed size, never a guessed size.
- Click-to-focus flights, breadcrumbs, semantic zoom, keyboard path and live region (from the spike).
- Layout: test a collapsed-chain or treemap-style layout against circle packing, which wastes space (spike finding).
- Lumper/Splitter toggle for Arabic, Chinese and Persian, with an Inspector note on why linguists disagree. The note's text is written by content-writer and reviewed by linguist-reviewer.

### 5. Map (cartographer)
- Production map from the spike. A language shows where it is spoken today, with share and official status per country. A country shows its languages. Every number carries its source.
- Borders policy D-019. Open points wait for the owner.

### 6. Profiles (content-writer, then linguist-reviewer, historical-linguist for history, then rights-auditor)
- Tabs: Overview, Speakers, Where, Writing, Sounds, Words, Family, Sources (SPEC section 5 template).
- 100 basic profiles built from data, with honest "no data yet" states.
- Gold-standard drafts for Persian, Turkish and English (SPEC section 6 targets). Every fact cited; anything unverified marked TODO(verify).
- Persian model: provisional answer to the overnight question. Persian is a labeled macrolanguage grouping Iranian Persian (west2369), Dari and Tajik; Glottolog's tree stays the default. linguist-reviewer checks it; the owner decides.
- Persian and Turkish wording in the UI waits for owner review.

### 7. Quality (qa-gatekeeper)
- Tests for every feature. axe on every route.
- Keyboard paths through Tree, Map and Profile.
- Screenshots for the owner at 1440x900 and 390x844, English and Persian.
- Lighthouse budgets.
- The renderer benchmark when the owner can run it.

## Order tonight
1. Phase 0 gate fixes.
2. Step 1 (scope list), then step 2 (pipeline), with step 3 (app shell) in parallel.
3. Steps 4 to 6 after that, as far as the night allows.
4. Every step: commit, push to phase-1, check CI, update the overnight report.
