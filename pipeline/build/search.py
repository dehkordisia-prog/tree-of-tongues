"""Search documents in two tiers (docs/specs/app-shell.md section 7). Plain JSON documents, no index.

Every name comes from a table built from Glottolog, CLDR or Wikidata. Nothing is typed by hand here.
The web app feeds these documents to MiniSearch. Document fields (a missing key means unknown or empty):

  id           Glottocode, ISO 639-3 code (macrolanguage-candidate) or CLDR territory code (country)
  kind         language | dialect | family | country | macrolanguage-candidate
  name         English display name: CLDR English, else Wikidata English label, else the Glottolog name.
               A candidate that contains the word "Farsi" is skipped (D-004).
  glottolog_name  the Glottolog primary name, verbatim (source data, not a UI label)
  endonyms     [{name, lang, script}] names in the language's own language
  localized    [{name, lang, script}] Persian and Turkish names that are not endonyms (CLDR, Wikidata)
  alt          other names, deduplicated, in the build's sort order
  aliases      [{name, alias: true}] names with the word "Farsi" (D-004): search aliases only
  iso639_3, glottocode, wikidata_qid, level, parent, family (top-level ancestor id)
  in_scope     true for the Phase 1 scope languages and their candidate nodes
  candidate_glottocodes   (macrolanguage-candidate) family-level nodes that carry the ISO code
  source_ids   sources of the names above
"""

from __future__ import annotations

import re
from collections import defaultdict
from pathlib import Path

import polars as pl
import yaml

from pipeline import common
from pipeline.build import outputs

FARSI = re.compile(r"\bfarsi\b", re.IGNORECASE)
LOCALIZED_LANGS = ("fa", "tr")
KINDS = ("language", "dialect", "family", "country", "macrolanguage-candidate")
LEVEL_KIND = {"family": "family", "language": "language", "dialect": "dialect"}
FORMAT = (
    "documents is a list of search documents sorted by id. Fields are described in pipeline/build/search.py; "
    "a missing key means unknown or empty. Names come from Glottolog, CLDR and Wikidata only. "
    "Tier 1 holds the Phase 1 scope nodes, their ancestors, macrolanguage candidates linked to them and "
    "countries. Tier 2 holds every other Glottolog languoid. No id appears in both tiers."
)


def has_farsi(text: str) -> bool:
    return bool(FARSI.search(text))


def scope_nodes(scope_path: Path) -> tuple[set[str], set[str], dict[str, str], dict[str, list[str]]]:
    """(in-scope nodes, listed family nodes). Contested entries contribute every candidate node."""
    doc = yaml.safe_load(scope_path.read_text(encoding="utf-8"))
    in_scope: set[str] = set()
    for entry in doc["languages"]:
        if entry.get("glottocode"):
            in_scope.add(entry["glottocode"])
        if entry.get("mechanical_candidate"):
            in_scope.add(entry["mechanical_candidate"])
        in_scope.update(c["glottocode"] for c in entry.get("candidates") or [])
    families = {f["glottocode"] for f in doc.get("families") or []}
    # Editorial names from the scope list (D-004, linguist-reviewed), keyed by the entry's decided node.
    display: dict[str, str] = {}
    alternates: dict[str, list[str]] = {}
    for entry in doc["languages"]:
        gc = entry.get("glottocode")
        if gc and entry.get("display_name"):
            display[gc] = entry["display_name"]
        if gc and entry.get("alternate_names"):
            alternates[gc] = list(entry["alternate_names"])
    return in_scope, families, display, alternates


def _entry(name: str, lang: str | None, script: str | None) -> dict:
    out: dict = {"name": name}
    if lang:
        out["lang"] = lang
    if script:
        out["script"] = script
    return out


def _pick_display(gl_name: str, rows: list[dict]) -> tuple[str, str]:
    """Display name and its source id: CLDR English, then Wikidata English, then the Glottolog name.

    Candidates containing the word Farsi are skipped (D-004). If none is left, the Glottolog name stays
    and `pipeline validate` reports it.
    """

    def en(source: str) -> list[str]:
        return sorted(
            {
                r["name"]
                for r in rows
                if r["source_id"] == source
                and r["lang"] == "en"
                and r["type"] != "alias"
                and "-alt-" not in r["locator"]
            }
        )

    candidates = [(n, common.CLDR) for n in en(common.CLDR)]
    candidates += [(n, common.WIKIDATA) for n in en(common.WIKIDATA)]
    candidates.append((gl_name, common.GLOTTOLOG))
    for text, sid in candidates:
        if not has_farsi(text):
            return text, sid
    return gl_name, common.GLOTTOLOG


def _language_doc(lang: dict, rows: list[dict]) -> dict:
    display, display_src = _pick_display(lang["name"], rows)
    sources = {display_src, common.GLOTTOLOG}
    endonyms: dict[tuple, dict] = {}
    localized: dict[tuple, dict] = {}
    alt: dict[str, None] = {}
    aliases: dict[str, None] = {}
    # rows are pre-sorted; the first sight of a name wins, so the output is deterministic
    for r in rows:
        text = r["name"]
        if text == display and r["type"] != "endonym":
            continue
        if has_farsi(text):
            aliases.setdefault(text)
            sources.add(r["source_id"])
        elif r["type"] == "endonym":
            endonyms.setdefault((text, r["lang"]), _entry(text, r["lang"], r["script"]))
            sources.add(r["source_id"])
        elif r["lang"] in LOCALIZED_LANGS:
            localized.setdefault((text, r["lang"]), _entry(text, r["lang"], r["script"]))
            sources.add(r["source_id"])
        elif text != lang["name"]:
            alt.setdefault(text)
            sources.add(r["source_id"])
    doc: dict = {
        "id": lang["glottocode"],
        "kind": LEVEL_KIND[lang["level"]],
        "name": display,
        "glottolog_name": lang["name"],
        "glottocode": lang["glottocode"],
        "level": lang["level"],
    }
    if lang["iso639_3"]:
        doc["iso639_3"] = lang["iso639_3"]
    if lang["wikidata_qid"]:
        doc["wikidata_qid"] = lang["wikidata_qid"]
    if lang["parent_glottocode"]:
        doc["parent"] = lang["parent_glottocode"]
    if endonyms:
        doc["endonyms"] = list(endonyms.values())
    if localized:
        doc["localized"] = list(localized.values())
    if alt:
        doc["alt"] = list(alt)
    if has_farsi(lang["name"]):
        aliases.setdefault(lang["name"])  # the Glottolog name stays in glottolog_name; search also finds it
    if aliases:
        doc["aliases"] = [{"name": a, "alias": True} for a in aliases]
    doc["source_ids"] = sorted(sources)
    return doc


def _apply_scope_names(doc: dict, display_name: str, alternates: list[str]) -> None:
    """Use the scope list's display_name as the English name; the earlier name becomes an alternate.

    Alternate names that contain the word Farsi become flagged aliases (D-004).
    """
    if has_farsi(display_name):
        raise SystemExit(f"STOP: scope display_name {display_name!r} contains Farsi (D-004)")
    if doc["name"] != display_name:
        previous = doc["name"]
        doc["name"] = display_name
        if not has_farsi(previous) and previous != doc["glottolog_name"]:
            doc["alt"] = sorted({*doc.get("alt", []), previous})
    doc["display_name_source"] = "content/scope/phase-1-languages.yaml"
    aliases = {a["name"] for a in doc.get("aliases", [])}
    alt = set(doc.get("alt", []))
    for name in alternates:
        if has_farsi(name):
            aliases.add(name)
        elif name != display_name:
            alt.add(name)
    if alt:
        doc["alt"] = sorted(alt)
    if aliases:
        doc["aliases"] = [{"name": a, "alias": True} for a in sorted(aliases)]


def _country_docs(territory_codes: set[str], names: dict[str, tuple[dict[str, str], str]]) -> list[dict]:
    """One document per CLDR territory code that has language data and an English name."""
    en, _ = names["en"]
    docs = []
    for code in sorted(territory_codes):
        if code not in en:
            continue  # CLDR has no English name for this code; nothing is guessed
        doc: dict = {"id": code, "kind": "country", "name": en[code]}
        alt = sorted({t for k, t in en.items() if k.startswith(code + "-alt-") and t != en[code]})
        if alt:
            doc["alt"] = alt
        localized = [
            _entry(names[loc][0][code], loc, None) for loc in LOCALIZED_LANGS if code in names[loc][0]
        ]
        if localized:
            doc["localized"] = localized
        doc["source_ids"] = [common.CLDR]
        docs.append(doc)
    return docs


def build_search(
    build_dir: Path,
    tabs: dict[str, pl.DataFrame],
    territory_names: dict[str, tuple[dict[str, str], str]],
    cldr_languages: dict[str, tuple[dict[str, str], str]],
    scope_path: Path,
    licenses: dict[str, dict],
) -> dict[str, int]:
    langs = {r["glottocode"]: r for r in tabs["languoids"].sort("glottocode").to_dicts()}
    in_scope, listed_families, scope_display, scope_alternates = scope_nodes(scope_path)
    missing = sorted((in_scope | listed_families) - set(langs))
    if missing:
        raise SystemExit(f"STOP: scope list names Glottocodes that are not in Glottolog: {missing}")

    rows: dict[str, list[dict]] = defaultdict(list)
    names = tabs["names"].sort("glottocode", "source_id", "lang", "name", "type", "locator", nulls_last=True)
    for r in names.to_dicts():
        rows[r["glottocode"]].append(r)

    def ancestors(gc: str) -> list[str]:
        out, seen = [], {gc}
        cur = langs[gc]["parent_glottocode"]
        while cur in langs and cur not in seen:
            out.append(cur)
            seen.add(cur)
            cur = langs[cur]["parent_glottocode"]
        return out

    retired = {gc for gc, r in langs.items() if r["retired"]}
    # A scope entry may name a retired node (e.g. a contested candidate). It is still not searchable;
    # the build reports it so the scope owner can see it.
    retired_in_scope = sorted(retired & (in_scope | listed_families))
    in_scope = in_scope - retired
    listed_families = listed_families - retired
    tier1_nodes = in_scope | listed_families
    for gc in sorted(tier1_nodes):
        tier1_nodes = tier1_nodes | set(ancestors(gc))

    docs: dict[str, dict] = {}
    for gc, lang in langs.items():
        doc = _language_doc(lang, rows.get(gc, []))
        doc["family"] = (ancestors(gc) or [gc])[-1]
        if gc in scope_display and gc in tier1_nodes:
            _apply_scope_names(doc, scope_display[gc], scope_alternates.get(gc, []))
        if gc in in_scope:
            doc["in_scope"] = True
        docs[gc] = doc

    # Macrolanguage candidates: an ISO 639-3 code that the build attaches to a family-level node.
    # Glottolog carries no macrolanguage flag (languoids.is_macrolanguage is null), so this is a
    # candidate signal only. Membership would need a sourced table, which is not ingested yet.
    by_code: dict[str, set[str]] = defaultdict(set)
    for gc, lang in langs.items():
        if lang["level"] == "family" and lang["iso639_3"] and gc not in retired:
            by_code[lang["iso639_3"]].add(gc)
    for r in tabs["xrefs"].filter(pl.col("scheme") == "iso639-3").to_dicts():
        if langs[r["glottocode"]]["level"] == "family" and r["glottocode"] not in retired:
            by_code[r["code"]].add(r["glottocode"])
    iso1_of: dict[str, set[str]] = defaultdict(set)  # gc -> ISO 639-1 codes the build holds for the node
    for r in tabs["xrefs"].filter(pl.col("scheme") == "iso639-1").to_dicts():
        iso1_of[r["glottocode"]].add(r["code"])
    macro: list[dict] = []
    for code, nodes in sorted(by_code.items()):
        members = sorted(nodes)
        base = docs[members[0]]
        doc = {
            k: v
            for k, v in base.items()
            if k in ("name", "endonyms", "localized", "alt", "aliases", "source_ids")
        }
        # The macrolanguage's own name is CLDR's name for its ISO code (via the node's ISO 639-1 code
        # when the build holds one), not the Glottolog family name.
        keys = [*sorted({c for m in members for c in iso1_of[m]}), code]
        for key in keys:
            if key in cldr_languages["en"][0]:
                en_name = cldr_languages["en"][0][key]
                if en_name != doc["name"]:
                    doc["alt"] = sorted({*doc.get("alt", []), doc["name"]})
                doc["name"] = en_name
                doc["alt"] = [a for a in doc.get("alt", []) if a != en_name]
                loc = [
                    _entry(cldr_languages[lc][0][key], lc, None)
                    for lc in LOCALIZED_LANGS
                    if key in cldr_languages[lc][0]
                ]
                if loc:
                    doc["localized"] = loc
                doc["source_ids"] = sorted({*doc["source_ids"], common.CLDR})
                break
        doc.update(
            {
                "id": code,
                "kind": "macrolanguage-candidate",
                "iso639_3": code,
                "candidate_glottocodes": members,
            }
        )
        macro.append(doc)

    codes = {t for t in tabs["territories"]["iso3166"].to_list()}
    countries = _country_docs(codes, territory_names)

    tier1 = [docs[gc] for gc in sorted(tier1_nodes)] + countries
    # Retired (Bookkeeping) nodes stay in languoids.parquet and bundles but are not searchable.
    tier2 = [docs[gc] for gc in sorted(docs) if gc not in tier1_nodes and gc not in retired]
    for doc in macro:
        (tier1 if set(doc["candidate_glottocodes"]) & tier1_nodes else tier2).append(doc)
    stats = _write(build_dir, tier1, tier2, licenses)
    stats["countries_without_english_name"] = len(codes) - len(countries)
    stats["retired_excluded"] = len(retired)
    stats["retired_in_scope"] = retired_in_scope
    return stats


def _write(
    build_dir: Path, tier1: list[dict], tier2: list[dict], licenses: dict[str, dict]
) -> dict[str, int]:
    sizes: dict[str, int] = {}
    for tier, docs in ((1, tier1), (2, tier2)):
        used = sorted({s for d in docs for s in d["source_ids"]})
        doc = {
            "schema": 1,
            "tier": tier,
            "format": FORMAT,
            "licenses": {s: licenses[s]["license"] for s in used},
            "count": len(docs),
            "documents": sorted(docs, key=lambda d: d["id"]),
        }
        path = build_dir / "search" / f"tier{tier}.json"
        outputs.dump_json(doc, path)
        sizes[f"tier{tier}_bytes"] = path.stat().st_size
        sizes[f"tier{tier}_docs"] = len(docs)
    return sizes
