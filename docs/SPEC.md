# Product spec

Twelve modules share one canvas, and each has a depth ladder so a curious reader can always go one level further. Phases refer to docs/ROADMAP.md.

## 1. Information architecture
- One world canvas with three lenses: Tree (genealogy), Map (geography), Time (history). An Inspector panel (right side on desktop, bottom sheet on mobile) shows the selected entity.
- Global controls: search (Cmd+K), an always-visible time slider, lens switcher, classification lens (Glottolog by default, or traditional groupings), size metric (L1, total speakers, number of languages), color by (family, endangerment, script, word order, tone), sound on or off, UI language (English, then Persian and Turkish).
- Linked selection: one store for selection, lens, year and zoom. The URL is the source of truth, so back, forward and shared links restore the exact view.
- Every entity has its own prerendered page: /family/:id, /language/:glottocode, /country/:iso, /word/:id, /sound/:ipa, /script/:iso15924, /event/:id, /trail/:slug.
- Sign languages are languages: they appear in Tree and Map from Phase 1 (Glottolog lists them) and get video profiles in Phase 5.

## 2. Modules and depth ladders

| # | Module | What you do | Depth ladder | Phase |
| --- | --- | --- | --- | --- |
| 1 | Tree | Zoom and click through families | Galaxy of families → family bloom → language bubbles (L1 inside total) → stages and dialects → profile | 1 |
| 2 | Map | See where a language lives, now and then | World → language areas and country shares → dialect pins with audio → diaspora layer → source map | 1, 2 |
| 3 | Time | Scrub from prehistory to today | Era bands → language river (descent and contact) → stage cards with sample texts → events → evidence | 2 |
| 4 | Profile | Everything about one language | At a glance → tab → item detail → source | 1 |
| 5 | Culture shelf | The symbols of a language: 3 to 5 artifacts | Shelf → artifact card (image, date, why it matters) → related texts and audio → museum or archive source | 2 |
| 6 | Sounds | Hear, see and compare sounds | IPA chart → sound page (audio, articulation link, world map) → languages that have it → minimal pairs → spectrogram | 3 |
| 7 | Words | Concepts, cognates, journeys, loans | Concept map (one meaning, cognate classes colored) → word journey → loan flows → etymology graph → dictionary source | 3 |
| 8 | Writing | Scripts and their family tree | Script tree → script page → letter (stroke order, history) → transliteration playground → undeciphered room (Linear A, Indus, Rongorongo) | 3 |
| 9 | Hear it then | Historical pronunciation | Pick a text and a year → reconstructed reading beside today's → feature-by-feature diff → evidence per feature → scholarly source | 3 (pilot), 4 |
| 10 | Grammar | Structure and typology | Feature maps → language DNA glyph → typological twins → glossed example sentence | 4 |
| 11 | Play | Games and progress | Guess the language → family puzzle → cognate detective → script sprint → time-traveler quiz → passport and trails | 4 |
| 12 | Lab and Compare | Power tools | Compare up to 4 languages → distance matrix and network → query builder → CSV export | 5 |

Cross-cutting: the Polyglot Mirror (Phase 4) lets readers enter the languages they speak and see the bridges between them: shared words, loan flows, shared grammar.

## 3. Signature interactions
- The bloom: clicking a family flies the camera (smooth zoom interpolation, 800 to 1200 ms), dims siblings, unfolds children with a short stagger, updates the breadcrumb and slides in the family card. Esc or a breadcrumb reverses it.
- Semantic zoom: labels appear once a node is large enough to read, children render past a size threshold, dialects come last. The Phase 0 spike tunes the thresholds.
- Speaker dots: an optional stipple where one dot is 100,000 speakers. Dots reflow when the metric changes and migrate on the map when the year changes.
- Time scrub: all lenses update together. Values interpolate only between documented keyframes; outside them the UI says "no data for this period" instead of guessing.
- Lumper/Splitter: macrolanguages (Arabic, Chinese, Persian, Malay and others) collapse or expand with a morph, and the Inspector explains why linguists disagree.
- Classification lens: Glottolog by default; traditional groupings on demand and always labeled, such as Niger-Congo including Mande (as in the reference chart) or Altaic as a dotted hypothesis.
- Go deeper: every Inspector view ends with 3 to 6 cards (Related, Contrast, Surprise) chosen from graph proximity plus curated links.

## 4. Data model
Every fact row also carries source_id, locator, retrieved_at, license, confidence and notes.

| Entity | Key fields | Main sources |
| --- | --- | --- |
| Languoid | glottocode, level, parent, names (language, script, type: endonym, exonym, alias), iso639_3, wikidata_qid, macroarea, coordinates, endangerment, macrolanguage | Glottolog, Wikidata, CLDR |
| SpeakerEstimate | languoid, kind (L1, L2, total), value or range, year, place, method | Wikidata, census tables, published estimates |
| TerritoryShare | languoid, country, population share, official status, year | CLDR, national sources |
| Area | languoid, geometry, period (from, to), method, uncertainty | Glottography, historical-linguist keyframes |
| Stage | languoid, period, region, key features, sample texts | content/historical |
| Form | languoid, concept, native-script form, romanization, IPA, audio, cognate class, borrowed_from | ASJP, NorthEuraLex, Lexibank, WOLD, kaikki |
| Concept | concepticon_id, gloss, semantic field | Concepticon |
| EtymologyEdge | from form, to form, type (inherited, borrowed, calque), date, place, confidence | kaikki, WOLD, historical-linguist |
| Phoneme | IPA, features, inventories, audio, articulation links | PHOIBLE |
| FeatureValue | languoid, parameter, value | WALS, Grambank |
| Script | ISO 15924 code, direction, parent script, letters, users | Unicode, CLDR, curated |
| AudioClip | languoid, variety, badge, anonymous speaker info, transcript, translation, IPA, license | Commons, Lingua Libre, Common Voice, commissioned |
| Event | date or range, place, title, summary, languoids affected | Curated |
| Artifact | title, date, place, image and its license, why it matters | Wikimedia Commons, museum open access |
| Trail or Story | ordered steps: camera state, layers, narration, audio | content/ |
| Source | id, citation, URL, license, retrieved_at | All |

## 5. Profile template (gold standard)
1. Hook: one surprising true sentence.
2. At a glance: endonym, family path, speakers (L1 and L2, with sources), countries, scripts, status, ISO 639-3 and Glottocode.
3. Story: a timeline of stages, each with a short attested sample.
4. Sounds: inventory chart, signature sounds with audio, tone or stress notes.
5. Words: Swadesh 40 with audio; loanwords in and out; false friends.
6. Writing: scripts now and before; letter chart; reforms.
7. Grammar DNA: 8 to 12 headline features, each with an example.
8. Connections: closest relatives, contact languages, linguistic areas.
9. Culture shelf: 3 to 5 artifacts.
10. Hear it then, where available.
11. Open questions: what scholars still debate.
12. Go deeper: at least three links.
13. Sources.

## 6. Pilot depth: Persian, Turkish, English
These are targets; every fact still passes linguist-reviewer.
- Persian: Old Persian (Behistun inscription, about 520 BCE) → Middle Persian → Early New Persian → Classical → Iranian Persian, Dari, Tajik. Hear it then: Classical Persian kept ē and ō apart (šēr "lion", šīr "milk") and pronounced و as [w]; Dari keeps both, while Tehran Persian merged the vowels and moved to [v]. Word journeys: pardis to paradise, shakar to sugar, kushk to köşk to kiosk, pāy-jāma to pajama. Culture shelf: Behistun, the Shahnameh, Nastaliq calligraphy, the Divan of Hafez, the Persian garden.
- Turkish: Orkhon inscriptions (8th century) → Dīwān Lughāt al-Turk (Mahmud al-Kashgari, 1070s) → Ottoman Turkish in Perso-Arabic script → the 1928 alphabet law → the language reform. Features: vowel harmony, agglutination, the evidential -miş. Bridges to Persian: pencere, hafta, şehir, dost. Oddity: the whistled Turkish of Kuşköy (UNESCO, 2017).
- English: Old English (Beowulf) → Middle English (Chaucer) → Early Modern (Shakespeare, Original Pronunciation) → the 18th century (Johnson's Dictionary, 1755) → today. The Great Vowel Shift becomes an animated sound-change rule, and "Hear it in 1750" plays beside today.

## 7. Design and motion direction
- Mood: an observatory at night (deep ink background, luminous family colors), with a parchment light theme.
- Family colors keep the reference chart's hue logic as homage (Indo-European red, Sino-Tibetan blue, Afro-Asiatic amber, Austronesian rose, Niger-Congo orange, Dravidian sky, Turkic violet, Japonic teal, Koreanic magenta, Kra-Dai green, Uralic brown), tuned for contrast, with pattern or label as a second channel for color-blind readers.
- Type: a serif display face for headings, a humanist sans for UI, Noto for every script, an IPA-complete font for transcriptions.
- Motion: camera moves explain hierarchy; UI transitions 200 to 400 ms; camera flights 600 to 1200 ms; springs for blooms; nothing loops forever; reduced motion swaps flights for crossfades.
- Sound design: subtle, opt-in UI sounds; speech never autoplays; one global mute.
- Mobile: bottom-sheet Inspector, pinch zoom, time slider as a bottom scrubber.

## 8. Acceptance criteria
- Any languoid is reachable from search in at most three interactions; every view offers at least three exits.
- Every number shows its source and year on hover or tap.
- Every clip has a badge and a license entry.
- WCAG 2.2 AA, with a full keyboard path through Tree, Map, Time and Profile.
- The budgets in docs/ARCHITECTURE.md are met.
- The owner approves the Persian, Turkish and English profiles.

## 9. Content style
Summary of docs/CONTENT_STYLE.md: lead with the most surprising true fact; keep sentences short; show the language itself (native script, romanization, IPA, translation); write original prose with citations; no em dashes; "Persian" in English text; Persian UI copy uses Persian punctuation (، ؛ ؟ « »), ZWNJ in compounds and Persian digits; attribute contested positions instead of judging them.
