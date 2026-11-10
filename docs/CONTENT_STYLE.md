# Content style

## Voice
- Curious, warm and exact: a museum curator who loves telling stories.
- Lead with the most surprising true fact.
- Short sentences (under 25 words), one idea per paragraph.
- Specifics over adjectives: numbers with years, names, places, forms.
- Show the language itself: native script, romanization, IPA, translation. Example: آب (āb, /ɒːb/) "water".
- No filler, no hype words ("fascinating", "rich tapestry", "unlock"), no rhetorical questions as openers.

## Names
- English name first, then the endonym in native script with romanization.
- The language is "Persian" in English. "Farsi" exists only as a search alias; the romanized endonym is fārsi (فارسی).
- Follow Glottolog names in the tree and note common alternatives.
- Avoid loaded terms: "primitive", "exotic", "tribal language", or "dialect" used as a put-down.

## Punctuation and typography
- No em dashes. Use a comma, a colon, parentheses or two sentences. scripts/lint-content.mjs blocks em dashes in content/ and UI copy.
- Ranges: "1500 to 1700" in prose, "1500-1700" in tables.
- Dates: BCE and CE; "about 520 BCE" for approximate dates; "18th century".
- Persian UI copy: Persian punctuation (، ؛ ؟ « »), no space before a mark and one after, ZWNJ in compounds (می‌شود), Persian digits (۱۲۳).
- Turkish UI copy: standard Turkish spelling (TDK).

### Language marks
Mark every non-English phrase in a profile with its BCP 47 tag: `[ديوان لغات الترك]{lang=ar}`, `[тоҷикӣ]{lang=tg-Cyrl}`, `[cuneiform text]{lang=peo-Xpeo}`. Direction follows the script (Arabic, Hebrew, Syriac and Thaana are right to left); add `dir=rtl` or `dir=ltr` only to override it. Unmarked Arabic-script text is assumed to be Persian, so mark Arabic, Ottoman and Old Turkic in Arabic script explicitly; a malformed tag fails the build.

## Badges
- Recording: a real person; variety and consent noted.
- Reconstruction: a scholarly reconstruction; always shows evidence and confidence.
- Synthetic: machine-generated speech; names the engine.
- Data confidence chips: High, Medium, Low, Contested.

## Citations
- Every claim has a source; inline citation keys resolve in content/sources.bib.
- Quote at most one short line from any source. Never paste text from Wikipedia or other sites; write original summaries.
- Numbers show year and source. When sources disagree, show the range and each source.
- Mark anything unverified with TODO(verify) so linguist-reviewer sees it.

## Sensitive topics
- Language and identity are political. State facts, attribute positions ("Glottolog classifies...", "Some scholars argue..."), and avoid verdicts.
- Disputed borders: neutral rendering, following the policy in docs/DECISIONS.md.
- Endangered and Indigenous languages: follow community and archive protocols, prefer community-authored descriptions, no sacred or restricted material.

## Go deeper
Every page ends with at least three links: one Related, one Contrast, one Surprise.
