# Review: English display labels for Glottolog's Farsic nodes

Reviewer: linguist-reviewer. Date: 2026-11-10. Scope: D-030 (with D-004, D-023, D-028, D-029). Status: proposal. The labels stay provisional until the owner approves them.

## Proposed labels

| Node | Glottolog name | English display label | Screen-reader and details gloss |
| --- | --- | --- | --- |
| fars1254 | Farsic-Caucasian Tat | **Persian and Caucasian Tat** | "Glottolog family Farsic-Caucasian Tat: the Persian group plus Caucasian Tat (Muslim Tat and Judeo-Tat)." |
| fars1255 | Farsic | **Persian group** | "Glottolog family Farsic: Iranian Persian, Judeo-Persian and the Eastern Persian group. This is not the atlas's Persian lens." |
| east2745 | Eastern Farsic | **Eastern Persian group** | "Glottolog family Eastern Farsic: Dari, Hazaragi, Aimaq, Dehwari, Pahlavani and the Tajikic group." |
| sout2645 | Fars Dialects | no change | No change needed. "Fars" here is the province, not "Farsi", so D-004 does not apply. Optional gloss: "Southwestern Iranian varieties of Fars province (ISO 639-3 fay)." |
| taji1250 | Tajikic | no change | The name does not contain "Farsi". Its members are Tajik and Bukharic (checked against Glottolog JSON). |

Breadcrumbs:
- `Indo-European › … › Modern Southwestern Iranian › Persian and Caucasian Tat › Persian group › Iranian Persian`
- `… › Persian group › Eastern Persian group › Tajikic › Tajik`

Each step down the path narrows the group. No node is shown as plain "Persian", which D-029 keeps for the macrolanguage.

## Why

- **fars1254.** Under D-030, "Persian group" alone would be wrong here because the node also contains Caucasian Tat. Naming both parts states the membership exactly. "Caucasian" stays because "Tat" or "Tati" also names unrelated Northwestern Iranian varieties in Iran. Glottolog's own name makes the same distinction. (The Glottolog code for the Northwestern Tati group was not checked, so treat that point as unverified.)
- **fars1255.** "Persian group" is the owner's example and it fits. All members are widely described as varieties of Persian: Western Farsi, Judeo-Persian and the eastern varieties. The word "group" marks it as a genealogical node, so it is not confused with the macrolanguage (D-029) or the Persian lens (D-028). The lens has 3 members and this node has more. The gloss says so.
- **east2745.** Hazaragi and Aimaq are usually described as eastern varieties of Persian close to Dari. Dehwari and Pahlavani are listed the same way. So "Eastern Persian" does not mislead about who is in the node. The word "group" is required: "Eastern Persian" on its own is also used loosely for Dari, and a bare label would make Dari look like the parent of Hazaragi and Tajik. Sensitivity point: some Tajik and Hazara speakers name their language without the word "Persian". The label describes a genealogical grouping, not what speakers call their language. Each language page keeps its own name and endonym.
- **Consistency.** fars1255 and east2745 use the same pattern: "[qualifier] Persian group". fars1254 uses "X and Y" because it joins two groups.

## Evidence (retrieved 2026-11-10)

- Glottolog 5.3 pages for fars1254, east2745 and sout2645, plus JSON for taji1250 and cauc1242. These confirm the names, levels and members. https://glottolog.org/resource/languoid/id/fars1254 , https://glottolog.org/resource/languoid/id/east2745 , https://glottolog.org/resource/languoid/id/sout2645 , https://glottolog.org/resource/languoid/id/taji1250.json , https://glottolog.org/resource/languoid/id/cauc1242.json
- Glottolog cites Windfuhr 2009, Korn 2016, Korn 2019 and Cathcart and Chundra Aroor 2015 for the fars1254 grouping, and Kieffer 1983 for east2745. These works were not opened. Unverified whether they use the terms "Persian group" or "Eastern Persian".
- Windfuhr and Perry 2009, "Persian and Tajik", in *The Iranian Languages*, pp. 416 to 544 (catalog entry only, text not opened): https://grambank.clld.org/sources/sWindfuhrPerryPersianTajik
- Wikipedia (interim source under D-033) lists Aimaq, Bukharian, Dari, Dehwari, Hazaragi, Pahlavani and Tajik under "Eastern Persian": https://en.wikipedia.org/wiki/Eastern_Persian . Intended replacement: Windfuhr and Perry 2009.
- Wikipedia (interim) describes Caucasian Tat as Southwestern Iranian, close to Persian but not fully mutually intelligible with it, and gives "Caucasian Persian" as an alternate name: https://en.wikipedia.org/wiki/Tat_language_(Caucasus) . The Jewish Languages Project places Judeo-Tat in the same branch: https://www.jewishlanguages.org/judeo-tat-juhuri
- "Persian group" as an exact phrase for Glottolog's Farsic: no published usage found. Label it as the atlas's own wording.

## Alternatives rejected

- **"Persian group" for fars1254.** It includes Caucasian Tat, so this breaks D-030.
- **"Persian-Tat group".** Plain "Tat" is ambiguous with the Northwestern Tati varieties.
- **"Persic" or "Persid".** Some sources use "Persic" for all of Southwestern Iranian (for example https://translatewiki.net/wiki/Languages_by_language_family/Modern_Southwestern_Iranian ), so it is ambiguous. It also does not follow D-030's "built on Persian" rule.
- **"Persian languages" or "Eastern Persian languages".** These would settle the language-versus-dialect question for Dari, Tajik and Hazaragi. That question is contested and must stay contested.
- **"Persian varieties".** Too close to the Persian lens, and it does not read as a tree node.
- **Bare "Eastern Persian".** It collides with the loose use of the term for Dari.

## Persian (fa) and Turkish (tr)

- **The "Farsi" ban is English only.** In Persian, fārsi is the endonym. Turkish uses its own standard name for the language. No wording is proposed in either; the owner writes it.
- **The accuracy rules apply in every locale:**
  - fars1254 must name Caucasian Tat.
  - fars1255 and east2745 need a "group" word, so they are not read as the language itself or the lens.
  - The Glottolog names stay in the details panel.

## Follow-up (minor)

Check that the "Farsi" search alias (D-031) does not prefix-match "Fars Dialects" (sout2645) and show "Alias: Farsi" on it. Orchestrator check against apps/web/src/search/engine.ts: "fars dialects" does not start with "farsi", and the fuzzy fallback matches it by name, not by alias, so no alias reason is produced. Covered by a test in apps/web/src/search/persian.test.ts.
