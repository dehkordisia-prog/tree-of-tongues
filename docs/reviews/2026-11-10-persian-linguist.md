# Linguist review: Persian profile (west2369)

Reviewer: linguist-reviewer, 2026-11-10. Draft: content/languages/west2369.md at d867c89. Verdict: changes required (0 blockers, 10 major, 17 minor). Encyclopaedia Iranica article pages, SIL and UNESCO WHC returned HTTP 403 again; those TODOs stay unless a replacement is given.

## Checked and correct
Glottolog path (eleven glottocodes; iran1271 is real); the Caucasian Tat sister; WALS 51A; LRC Lesson 7 (36 syllabic characters, five ideograms, left to right; line 36 "θātiy Dārayavauš xšāyaθiya", "Darius the King declares"; ten rebel kings); Glottolog alternative names and status; Shahnameh figures as Wikipedia gives them; Wiktionary فارسی pronunciations; Wikipedia's Dari article gives 1964 only (1958 only in the Persian language article); Middle Persian dates and heterograms; Kartir siglum KZ 1; ZWNJ in کتاب‌ها, می‌خورم, مشکل‌ها; Persian ک and ی; fars1254 never called Persian; no em or en dashes.

## Required fixes
1. Major. Paradise chain (l.234): "An Old Iranian compound meaning "walled around" is attested in Avestan as pairi.daēza-. A western Iranian form of it was borrowed into Elamite, Akkadian (pardēsu), Hebrew (pardēs) and Greek (parádeisos)." Source (tertiary): https://en.wiktionary.org/wiki/Reconstruction:Proto-Iranian/paridayjah; keep TODO(verify) for a scholarly locator (Iranica "Paradise" was 403).
2. Major. شیر IPA (l.405 to 406): "[ʃiːɾ]" in both cells (word-final /r/ is usually a flap; [ɹ] only before /t d s z ʃ ʒ l/), or phonemic "/ʃir/" with a note that length is not distinctive; note the cell departs from Wiktionary. Source https://en.wikipedia.org/wiki/Persian_phonology (Consonants).
3. Major. Closest relatives (l.330): "In Glottolog, Iranian Persian's closest relatives sit in the Farsic group: Judeo-Persian, and the Eastern Farsic languages Dari, Hazaragi, Tajik and Bukharic. Caucasian Tat is the next branch out." Sources: https://glottolog.org/resource/languoid/id/jude1257, /haza1239, /bukh1238.
4. Major. Contested framing (l.80): "Persian is often described as one language with three standard forms." Better source: Windfuhr and Perry 2009.
5. Major. "Farsi" in prose (l.67): delete "Farsi is kept as a search alias only" (keep the alias in data). Optionally state, as quoted source data, that Glottolog's own name for west2369 is "Western Farsi" (owner decision; needs lint-allow).
6. Major. India (l.190): "Under the Mughal emperors, Persian was the official language. In British India, Act XXIX of 1837 began its replacement in the courts by English and local languages." Source (secondary): U. Chandra, https://www.allahabadhighcourt.in/event/EmergenceEnglishUrduCourtLanguageUChandra.html; keep TODO(verify) for the Act's text (e.g. https://digi.ub.uni-heidelberg.de/diglit/clarke1854bd3/0470).
7. Major. Stress (l.216 to 218): "In nouns and adjectives, stress falls on the last syllable, plural endings included. Clitics such as the ezafe -e are never stressed. In verbs, the first prefix takes the stress, and the negative na- always does." Source wp-persian-phonology (citing Mace 2003); scholarly: Kahnemuyipour 2003.
8. Major. Ezafe origin (l.154): cite Haig 2011; keep TODO(verify) on the page locator for Middle Persian ī.
9. Major. Windfuhr and Perry (l.96): "Glottolog cites the chapter "Persian and Tajik" by Gernot Windfuhr and John R. Perry (2009), pages 417 to 421." What it says about Tajik stays TODO(verify). Source https://grambank.clld.org/sources/sWindfuhrPerryPersianTajik.
10. Major. Early New Persian (l.156, l.158): heading "Early New Persian (8th to 12th century)"; after l.158 add "Slightly older New Persian texts survive in Hebrew script (Early Judaeo-Persian)." Source Paul 2013; Judaeo-Persian clause via https://reichert-verlag.de/de/autor/p/paul_ludwig/9783895009693_a_grammar_of_early_judaeo_persian-detail; TODO(verify) page locator.
11. Minor. l.212: "The sounds written ق and غ are usually pronounced alike in standard Iranian Persian."
12. Minor. l.136: keep the heading; add "Most surviving Book Pahlavi texts were written down after the empire fell, in the 9th to 11th centuries."
13. Minor. l.150: "The stone has three Aramaic words: W, ANE and ZY. Readers said Persian ud, az and ī." Keep TODO(verify) and source it (e.g. MacKenzie 1971).
14. Minor. l.130: label "Transcription:" not "Transliteration:".
15. Minor. l.284: "36 phonetic signs (three for vowels, the rest for a consonant plus a vowel) and logograms for five words". Sources lrc-oldiranian-7; https://en.wikipedia.org/wiki/Old_Persian_cuneiform.
16. Minor. l.73 and l.196: "Article 15 of Iran's Constitution (1979, revised 1989) names Persian the official language and script." Source https://www.constituteproject.org/constitution/Iran_1989 (not opened; TODO(verify)).
17. Minor. l.198: add "Its legal standing since 2021 is unclear." TODO(verify) for a source.
18. Minor. l.102: keep 1964; "the 1964 Constitution names Pashto and Dari as official languages" (Article 35 unverified).
19. Minor. l.82: "The three standards are usually described as mutually intelligible, especially in formal use."
20. Minor. l.70: "A note on the Farsic nodes".
21. Minor. l.296: "Bukharian Jews traditionally wrote Bukhori, a closely related language in Glottolog, in the Hebrew alphabet."
22. Minor. Romanization note (l.54): "Modern Iranian readings mark ā only, as Wiktionary's â; i and u are unmarked." Normalize a'zā to aʿzā, naskh-e taʿliq to nasx-e taʿliq, chahār bāgh to čahār bāġ (or mark it as an English term).
23. Minor. Endonym IPA (l.68): "IPA (Iran, formal): [fɒːɹ.síː]" from Wiktionary فارسی, or phonemic /fɒrˈsi/ (tertiary, medium confidence).
24. Minor. l.366: "about 9% of its distinct words". Scholarly source to obtain: Moinfar 1970 (TODO(verify)).
25. Minor, one each: l.401 "Tehran merged" becomes "Iranian Persian merged"; l.310 add "in formal Persian" (colloquial definite -e, TODO); l.346 narrow "New Persian served for government" for the Ottoman state (TODO); l.384 Hafez: first half-line is Arabic (alā yā ayyuhā s-sāqī adir kaʾsan wa-nāwilhā), keep TODO for a citation; l.182 Golestan: note the variant "اعضای یک پیکرند" (Ganjoor has یکدیگرند); l.395 Fin Garden: keep TODO (UNESCO 403); l.63 hook: "English 'paradise' goes back to an old Iranian word for a walled enclosure."; l.292 Manichaean script: "traditionally credited to Mani".

## Replacement citations
@incollection{windfuhr_perry2009, author={Windfuhr, Gernot and Perry, John R.}, year={2009}, title={Persian and Tajik}, booktitle={The Iranian Languages}, editor={Windfuhr, Gernot}, publisher={Routledge}, address={London and New York}, pages={416--544}, url={https://grambank.clld.org/sources/sWindfuhrPerryPersianTajik}} (verified via Grambank)

@misc{paul2013_enp, author={Paul, Ludwig}, year={2013}, title={Persian Language i. Early New Persian}, howpublished={Encyclopaedia Iranica online}, url={https://www.iranicaonline.org/articles/persian-language-1-early-new-persian}} (existence and scope verified via the author page; article 403)

@article{kahnemuyipour2003, author={Kahnemuyipour, Arsalan}, year={2003}, title={Syntactic categories and Persian stress}, journal={Natural Language and Linguistic Theory}, volume={21}, number={2}, pages={333--379}, doi={10.1023/A:1023330609827}} (bibliography verified; body not read)

@incollection{haig2011, author={Haig, Geoffrey}, year={2011}, title={Linker, relativizer, nominalizer, tense-particle: On the Ezafe in West Iranian}, booktitle={Nominalization in Asian Languages}, editor={Yap, Foong Ha and Grunow-H{\aa}rsta, Karen and Wrona, Janick}, series={Typological Studies in Language 96}, publisher={John Benjamins}, pages={363--390}, url={https://www.benjamins.com/catalog/tsl.96.13hai}} (bibliography verified; claim unverified)

Not verified (keep TODO): Majidi and Ternes 1991 (JIPA 21(2); title contains the word Farsi, needs lint-allow); Lazard "Darī" (Iranica); Lazard 1992 grammar for rā; MacKenzie 1971; Moinfar 1970; Schmitt's Behistun edition; SIL for fas = pes + prs; Tajik 1989 and 1999 laws; Borger 1982.
