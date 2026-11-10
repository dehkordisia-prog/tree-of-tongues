# Pipeline

Python 3.12, run with uv from the repo root.

```text
uv run pipeline fetch [--only <source-id>]      download raw sources into data/raw/<source-id>/<date>/
uv run pipeline build [--raw-dir D] [--build-dir D]   normalize and write data/build/
uv run pipeline validate [--build-dir D] [--licenses F]   exit 1 on any failure
```

Validate on the checked-in fixture (used by CI and tests):

```text
uv run pipeline build --raw-dir tests/pipeline/fixtures/raw --build-dir <tmp>
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
| cldr-49 | unicode-org/cldr-json tag 49.0.0: `cldr-core/supplemental/territoryInfo.json`, `cldr-localenames-full/main/{en,fa,tr}/languages.json`, repo `LICENSE` |
| wikidata | WDQS, queries in `pipeline/fetch/queries/*.rq`, one request at a time, paged |
| natural-earth-5.1.1 | official GitHub repo nvkelso/natural-earth-vector, tag v5.1.1, GeoJSON (110m and 50m countries, 50m breakaway and disputed areas) |

## Confidence rules

Defined in the docstring of `pipeline/build/tables.py`. In short: Glottolog classification high; CLDR names high; Glottolog name lists and Wikidata labels medium; CLDR territory shares medium; Wikidata speaker statements medium with a reference, low without one, when deprecated, or when the Glottocode is shared by several items; shared-Glottocode cross-references are `contested`.

## Data dictionary (data/build/*.parquet)

Every fact table also has: `source_id`, `locator`, `retrieved_at` (UTC ISO), `license`, `confidence` (high, medium, low, contested), `notes`.

| Table | Columns and meaning |
| --- | --- |
| languoids | `glottocode` (PK), `level` (family, language, dialect), `parent_glottocode` (last element of Glottolog's classification path; null for roots), `name` (Glottolog English name), `iso639_3`, `wikidata_qid` (null if the Glottocode is claimed by several items), `macroarea` (Glottolog's `;`-joined string), `latitude`, `longitude` (6 decimals), `endangerment` (Glottolog AES label), `is_macrolanguage` (always null: Glottolog does not carry it), `is_isolate`, `category` |
| names | `glottocode`, `name`, `lang` (BCP-47 of the name, null if unstated), `script` (ISO 15924, detected from the characters, null if mixed or unknown), `type` (endonym: name is in the languoid's own language; exonym: in another language; alias: language unstated or alternate form) |
| xrefs | `glottocode`, `scheme` (iso639-3, iso639-1, wikidata), `code` |
| speakers | `speaker_id` (`wd:<statement id>`), `glottocode`, `kind` (L1, L2 only when the P518 qualifier says so in words; otherwise unknown), `value`, `value_low`, `value_high` (null: Wikidata gives none), `year` (from P585, null if absent or ambiguous), `place` (null), `method` (P459), `part` (P518 values, which may be places), `rank`, `references` (JSON list: stated_in, stated_in_label, url, retrieved), `has_reference`, `disagrees_gt_25pct` (the (glottocode, kind) group spans more than 25 percent, (max-min)/max, deprecated rows ignored; years may differ) |
| territories | `glottocode`, `iso3166` (CLDR territory code), `cldr_code`, `population_share` (percent of territory population, 0 to 100), `territory_population`, `official_status`, `year` (null: CLDR does not date these) |
| sources | one row per source from LICENSES.yaml with retrieval time |

Other outputs: `bundles/{glottocode}.json` (under 50 KB), `tree.json` (format described in its `format` field), `geo/*.geojson`, `coverage.md`, `manifest.json` (sha256 and licenses of every output), `NOTICE.md` and the verbatim Unicode license for CLDR.

CLDR codes are tied to Glottocodes only through a unique ISO 639-3 match, or a two-letter code that Wikidata (P218) ties to exactly one Glottocode. Script-qualified (`sr_Latn`) and region variants (`en-GB`) are not languoids and are listed in coverage.md.
