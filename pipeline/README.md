# Pipeline

Python 3.12, run with uv from the repo root.

```text
uv run pipeline fetch [--only <source-id>]      download raw sources into data/raw/<source-id>/<date>/
uv run pipeline build [--raw-dir D] [--build-dir D] [--scope F]   normalize and write data/build/
uv run pipeline validate [--build-dir D] [--licenses F]   exit 1 on any failure
```

Validate on the checked-in fixture (used by CI and tests):

```text
uv run pipeline build --raw-dir tests/pipeline/fixtures/raw --build-dir <tmp> --scope tests/pipeline/fixtures/scope.yaml
uv run pipeline validate --build-dir <tmp>
```

The fixture is fictional (codes `test0001`..., ISO codes in the private-use range `qaa`-`qtz`).

## Rules enforced in code

- A source must be `cleared*` in data/LICENSES.yaml before fetch or build touches it.
- Raw files are immutable: an existing dated file is skipped, never overwritten. `data/raw/MANIFEST.yaml` (committed) lists url, version or DOI, retrieved_at, sha256 and bytes per file.
- Builds are deterministic: sorted rows, fixed column order, no wall-clock values. `retrieved_at` is copied from the raw manifest.
- Unknown stays null. Speaker statements are never merged or averaged.

## Sources and where they come from

| Source id | Fetched from |
| --- | --- |
| glottolog-5.3 | Zenodo record 18840967 (DOI 10.5281/zenodo.18840967), md5 checked against Zenodo |
| cldr-49 | unicode-org/cldr-json tag 49.0.0: `cldr-core/supplemental/territoryInfo.json`, `cldr-localenames-full/main/{en,fa,tr}/{languages,territories}.json`, repo `LICENSE` |
| wikidata | WDQS, queries in `pipeline/fetch/queries/*.rq`, one request at a time, paged |
| natural-earth-5.1.1 | official GitHub repo nvkelso/natural-earth-vector, tag v5.1.1, GeoJSON (110m and 50m countries, 50m breakaway and disputed areas) |

## Confidence rules

Defined in the docstring of `pipeline/build/tables.py`. In short: Glottolog classification high; CLDR names high; Glottolog name lists and Wikidata labels medium; CLDR territory shares medium; Wikidata speaker statements medium with a reference, low without one, when deprecated, or when the Glottocode is shared by several items; shared-Glottocode cross-references are `contested`; items that reached a node by ISO match are `low`.

## Data dictionary (data/build/*.parquet)

Every fact table also has: `source_id`, `locator`, `retrieved_at` (UTC ISO), `license`, `confidence` (high, medium, low, contested), `notes`.

| Table | Columns and meaning |
| --- | --- |
| languoids | `glottocode` (PK), `level` (family, language, dialect), `parent_glottocode` (last element of Glottolog's classification path; null for roots), `name` (Glottolog English name), `iso639_3`, `wikidata_qid` (null if the Glottocode is claimed by several items), `macroarea` (Glottolog's `;`-joined string), `latitude`, `longitude` (6 decimals), `endangerment` (Glottolog AES label), `is_macrolanguage` (always null: Glottolog does not carry it), `is_isolate`, `category`, `retired` (true for Glottolog Bookkeeping nodes; kept here and in bundles, left out of search) |
| names | `glottocode`, `name`, `lang` (BCP-47 of the name, null if unstated), `script` (ISO 15924, detected from the characters, null if mixed or unknown), `mapped_via` (CLDR rows only: how the CLDR code reached the Glottocode, see below; null for other sources), `type` (endonym: name is in the languoid's own language; exonym: in another language; alias: language unstated or alternate form) |
| xrefs | `glottocode`, `scheme` (iso639-3, iso639-1, wikidata), `code` |
| speakers | `speaker_id` (`wd:<statement id>`), `glottocode`, `kind` (L1, L2 only when the P518 qualifier says so in words; otherwise unknown), `value`, `value_low`, `value_high` (null: Wikidata gives none), `year` (from P585, null if absent or ambiguous), `place` (null), `method` (P459), `part` (P518 values, which may be places), `rank`, `references` (JSON list: stated_in, stated_in_label, url, retrieved), `has_reference`, `disagrees_gt_25pct` (the (glottocode, kind) group spans more than 25 percent, (max-min)/max, deprecated rows ignored; years may differ), `attached_via` (null when the statement sits on the node its Wikidata item names; `wikidata_p1394_to_family` when a language item is attached to a family, which is Wikidata's claim about the language and not a family figure; `wikidata_iso_match` when the item reached its node by ISO 639-3 match) |
| territories | `glottocode`, `iso3166` (CLDR territory code), `cldr_code`, `population_share` (percent of territory population, 0 to 100), `territory_population`, `official_status`, `year` (null: CLDR does not date these), `mapped_via` (see below) |
| sources | one row per source from LICENSES.yaml with retrieval time |

Other outputs: `bundles/{glottocode}.json` (under 50 KB), `tree.json` (format described in its `format` field), `geo/*.geojson`, `territory_index.json`, `search/tier1.json`, `search/tier2.json`, `coverage.md`, `manifest.json` (sha256 and licenses of every output; `validate` fails on any file it does not list), `NOTICE.md` and the verbatim Unicode license for CLDR.

### tree.json speaker summary

The node tuples keep their nine columns (`l1_max`, `l1_source`, `any_max`, `any_source` unchanged). A top-level `speakers` object is keyed by node index as a string (the index into `nodes`) and holds only languages and dialects with at least one figure; families never appear (D-022). Each entry maps a kind (`l1`, `total`, `unstated`, `l2`) to `[min, max, count, first_year, last_year]`, present only when that kind has a figure. `unstated` is kind `unknown`. Count is the number of figure rows (each statement with its own year, not distinct references; matches "N sources" in D-025). The years are the earliest and latest non-null year (null if no row has one). Only non-deprecated rows with no `attached_via` and a non-null value count. Nothing is summed or averaged. The same text is in the file's `format` field.

### territory_index.json

`{format, provenance, territories}`. `territories[iso3166]` is a list of `[glottocode, population_share, official_status]` sorted by share, descending (null shares last). `provenance` (`source_id`, `locator_template`, `retrieved_at`, `confidence`, `notes`, `license`, `weak_mapping_note`) applies to every row except that weak rows have confidence low. Each row is `[glottocode, population_share, official_status, weak_mapping, mapped_via]`; `weak_mapping` is true when `mapped_via = wikidata_p218_iso_fallback`. Rows are copied from the territories table; nothing is averaged. The build stops if the rows ever have more than one provenance group.

### search/tier1.json and search/tier2.json

`{schema, tier, format, licenses, count, documents}`, documents sorted by id, plain JSON for MiniSearch. Tier 1 holds the Phase 1 scope nodes (every candidate of contested entries), their ancestors, the families listed in the scope file, macrolanguage candidates linked to them, and countries (CLDR territories that have language rows and an English name). Retired (Bookkeeping) nodes are in neither tier. Tier 2 holds every other live Glottolog languoid and the remaining macrolanguage candidates. No id is in both tiers. Fields (a missing key means unknown or empty): `id`, `kind` (language, dialect, family, country, macrolanguage-candidate), `name` (English display name), `glottolog_name`, `endonyms` and `localized` (`{name, lang, script}`), `alt`, `aliases` (`{name, alias: true}`), `iso639_3`, `glottocode`, `wikidata_qid`, `level`, `parent`, `family`, `in_scope`, `candidate_glottocodes`, `display_name_source`, `source_ids`.

Name rules: the display name is CLDR English, else a Wikidata English label that is not an alias, else the Glottolog name; for in-scope nodes the scope file's `display_name` wins and is marked by `display_name_source`. Any name with the word Farsi is only ever an alias (D-004); `glottolog_name` keeps the Glottolog string verbatim and is source data, not a UI label. A macrolanguage candidate is an ISO 639-3 code that the build attaches to a family-level node; its name is CLDR's name for the code (through the node's ISO 639-1 code). Glottolog has no macrolanguage flag, so this is a candidate signal only.

### Wikidata attachment

Wikidata never overrides Glottolog. Rules, in order (code: `resolve_wikidata`):

1. Retired and bookkeeping nodes (Glottolog category `Bookkeeping`; the "(Retired)" name suffix is only on a minority) never receive an item. The CLDF has no replacement field, so none is used; a recorded replacement would be attached with method `replacement of retired node`. An item with no live route stays unattached and is listed in `coverage.md`.
2. A QID sits on one node (the language-level node wins over its family).
3. If no P1394 node is language-level, a unique ISO 639-3 match to a live language-level node is used. That item may be broader than the node, so its speaker rows are low confidence with `attached_via = wikidata_iso_match` and the note "Wikidata item may cover more than this Glottolog node", `tree.json` ignores them, and its labels are aliases.
4. A direct P1394 attachment always beats an ISO match on the same node. The loser stays in xrefs (low, with a note) and its speaker rows are kept but never used for sizing.
5. A language item that stays on a family is Wikidata's claim: the family keeps its Glottolog name, `languoids.wikidata_qid` is null, the labels are aliases, speaker rows carry `attached_via`, and `tree.json` ignores them.

`pipeline/fetch/queries/deprecated_p1394.rq` fetches P1394 statements with deprecated rank (`languoids.rq` sees only truthy ones). When the chosen node is such a value, the xref and speaker notes say so and give the reason.

`coverage.md` lists every case.

CLDR codes are tied to Glottocodes only through a unique ISO 639-3 match, or a two-letter code that Wikidata (P218) ties to exactly one Glottocode. `mapped_via` records the path: `glottolog_iso639_3` (three-letter code equals Glottolog's ISO code), `wikidata_p218` (two-letter code on a Wikidata item attached by P1394) or `wikidata_p218_iso_fallback` (two-letter code on an item that reached its node only by ISO 639-3 match). Rows on the last path are kept but get confidence low and the note "CLDR code mapped through a Wikidata item that may cover more than this Glottolog node"; in-scope nodes are not exempt. `coverage.md` lists the affected codes.

Script-qualified (`sr_Latn`) and region variants (`en-GB`) are not languoids and are listed in coverage.md.

## Phase 1 scope list

`content/scope/phase-1-languages.yaml` lists the 100 languages of the first slice, mapped to Glottolog 5.3 (only names and ranks come from a local third-party chart; no figures). Contested entries have `glottocode: null` until linguist-reviewer decides; `mechanical_candidate` and `candidates` hold the options. `tests/pipeline/test_scope.py` validates it; the existence check against `data/build/languoids.parquet` skips when data/build is absent.
