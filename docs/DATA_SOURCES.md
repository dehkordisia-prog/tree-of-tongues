# Data and media sources

Open, versioned datasets cover the backbone; audio and historical maps are the hard part. Licenses were checked on 10 November 2026. rights-auditor re-verifies each one before ingest and records it in data/LICENSES.yaml.

| Source | Gives us | License | Use in the app |
| --- | --- | --- | --- |
| Glottolog 5.3 (March 2026), https://zenodo.org/records/18840967 | Classification of 8,500+ languages plus families and dialects, coordinates, endangerment, references | CC BY 4.0 | Backbone and primary keys |
| Glottography, https://openhumanitiesdata.metajnl.com/articles/10.5334/johd.459 | 13,000+ speaker-area polygons for 5,300 languages, digitized from 29 published atlases | Varies by dataset; some are CC BY-NC 4.0 | Language areas on the map, source always shown |
| Wikidata | Names in hundreds of languages, speaker figures with year qualifiers, ISO codes, links to media | CC0 for structured data; linked images and audio on Commons keep their own licenses | Names, speaker estimates, cross-links; each linked media file needs its own license record |
| Unicode CLDR | Language share per territory with official status; localized language and script names | Unicode License v3 | "Where is it spoken" and "what is spoken here" |
| WALS Online, https://github.com/cldf-datasets/wals | Typological features for about 2,600 languages | CC BY 4.0 | Grammar maps, DNA glyph |
| Grambank, https://github.com/grambank/grambank | 195 grammatical features for 2,400+ languages | CC BY 4.0 | Grammar module |
| PHOIBLE 2.0, https://phoible.org/ | 3,020 phoneme inventories for 2,186 languages | CC BY-SA 3.0 | Sound inventories, "where is this sound" |
| ASJP v21, https://asjp.clld.org (CLDF v21.1, DOI 10.5281/zenodo.22957986) | 40-item wordlists for 11,540 doculects, written in ASJPcode (a simplified transcription, not IPA) | CC BY 4.0 | Concept maps, lexical distance; forms always labeled "ASJPcode", never shown as IPA |
| WOLD, https://github.com/lexibank/wold | Loanword status in 41 languages | CC BY 4.0 (CLDF release) | Loan flows |
| NorthEuraLex | 1,016 concepts across 107 Eurasian languages, in IPA | Verify before use | Deep cognate views for Eurasia |
| Lexibank and Concepticon | Standardized wordlists and concept IDs | Per dataset, mostly CC BY 4.0 | Words module backbone |
| kaikki.org (Wiktextract), https://kaikki.org/dictionary/rawdata.html | Machine-readable Wiktionary: etymologies, IPA, translations | CC BY-SA and GFDL, as Wiktionary | Word journeys, etymology graph |
| Common Voice, https://datacollective.mozillafoundation.org | Read-sentence recordings in 100+ languages | CC0; since October 2025 downloaded through a Mozilla Data Collective account | Sentence audio |
| Lingua Libre (https://lingualibre.org) and Wikimedia Commons | 1.4 million+ word recordings in 315+ languages | Varies per file (CC0, CC BY or CC BY-SA); recorded per clip under the rule in data/LICENSES.yaml (`audio-wikimedia-commons`) | Word audio |
| Speech Accent Archive, https://accent.gmu.edu | One English paragraph read by speakers of many native languages | CC BY-NC-SA 4.0 | Accent explorer; usable because the project is non-commercial, and clips we cut stay CC BY-NC-SA |
| Meta MMS-TTS, https://huggingface.co/facebook/mms-tts | Speech synthesis for 1,100+ languages | CC BY-NC 4.0 | Synthetic audio for languages with no recording, always badged |
| Seeing Speech, https://www.seeingspeech.ac.uk/ | MRI, ultrasound and animations of IPA sounds | CC BY-NC-ND 4.0; no AI training or automated transformation | Show unmodified with credit, or link; no editing, re-encoding or AI processing |
| Natural Earth | Modern boundaries and coastlines | Public domain | Basemap |
| historical-basemaps, https://github.com/aourednik/historical-basemaps | World borders in time slices from prehistory to today | GPL-3.0 | Historical borders, labeled approximate |
| UNESCO World Atlas of Languages, https://en.wal.unesco.org/ | Status data for 8,000+ languages by country | Site terms of use; verify | Reference and outbound links |
| Ethnologue (29th edition, 2026), https://www.ethnologue.com | Speaker figures, EGIDS vitality | Paid, no redistribution | Cited only under a subscription; source of the reference chart |
| Noto and SIL fonts; KanjiVG | Fonts for every script and IPA; kanji stroke order | SIL OFL 1.1; CC BY-SA 3.0 | Typography, Writing module |
| Commissioned recordings | Native speakers and phoneticians reading fixed texts, including reconstructions | CC BY or CC BY-SA, shared on Wikimedia Commons | Gold-standard audio for the pilot trio, given back to the commons |

## Consequences
1. The project is non-commercial forever, so non-commercial sources are fair game: the Speech Accent Archive, MMS-TTS voices for 1,100+ languages and every Glottography dataset. The condition is permanent: no ads, paid tiers or sponsorship deals, or those licenses stop covering you.
2. Share-alike sources (PHOIBLE, kaikki, Lingua Libre, the Speech Accent Archive) oblige derived files to carry the same license; keep each in its own files with its license beside it.
3. The best audio for the pilot comes from recordings you commission or volunteers make. Put them on Wikimedia Commons (single words through Lingua Libre) under CC BY or CC BY-SA, so every dictionary and app benefits too. For Classical Persian, a Dari speaker reading Hafez sits naturally beside a Tehran speaker (both labeled as modern Recordings), with a phonetician's reconstruction as the third voice.

## Numbers that need care
Turkey has published no census language data since 1965, so figures for Kurdish, Zazaki or Arabic in Turkey come from surveys and estimates that disagree. Store and show each with its year and source; never average them.

## How to use each source
- CLDF datasets (Glottolog, WALS, Grambank, PHOIBLE, ASJP, WOLD, Lexibank): download the versioned release from Zenodo, read with pycldf, record the DOI in data/raw/MANIFEST.yaml.
- Wikidata: SPARQL queries kept in pipeline/fetch/queries/, results dated; respect the query service limits.
- CLDR: JSON release from the unicode-org/cldr-json repository; territoryInfo gives language population shares and official status.
- Audio: fetch Commons and Lingua Libre files by category through the Commons API; keep the file page URL and license per clip.
- Never scrape Ethnologue, Omniglot, Forvo or Seeing Speech.
