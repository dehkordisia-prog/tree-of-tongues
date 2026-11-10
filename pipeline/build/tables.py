"""Normalize raw sources into the fact tables.

CONFIDENCE RULES (assigned in code, nowhere else):
  languoids  Glottolog classification, level, parent, name        -> high
  names      Glottolog primary name                                -> high
             Glottolog names.csv (aggregated third-party lists)    -> medium
             CLDR localized language name                          -> high
             Wikidata label (crowd-edited)                         -> medium
  xrefs      Glottolog ISO 639-3                                   -> high
             Wikidata QID / ISO 639-1 / ISO 639-3 via P1394        -> medium
             a Glottocode shared by several Wikidata items         -> contested (each candidate)
  speakers   Wikidata P1098 with >= 1 reference, not deprecated    -> medium
             without a reference, or deprecated rank               -> low
             item shares its Glottocode with other Wikidata items  -> low
  territories CLDR territoryInfo shares (CLDR estimates, undated)  -> medium
Unknown stays null. Nothing is averaged, merged or imputed.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict

import polars as pl

from pipeline import common
from pipeline.build import readers
from pipeline.schemas import COLUMNS

LANG_RE = re.compile(r"^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$")

PL_TYPES: dict[str, pl.DataType] = {
    "latitude": pl.Float64,
    "longitude": pl.Float64,
    "is_macrolanguage": pl.Boolean,
    "is_isolate": pl.Boolean,
    "value": pl.Float64,
    "value_low": pl.Float64,
    "value_high": pl.Float64,
    "year": pl.Int32,
    "has_reference": pl.Boolean,
    "disagrees_gt_25pct": pl.Boolean,
    "population_share": pl.Float64,
    "territory_population": pl.Int64,
    "share_alike": pl.Boolean,
    "non_commercial": pl.Boolean,
    "no_derivatives": pl.Boolean,
}


def frame(table: str, rows: list[dict], sort_by: list[str]) -> pl.DataFrame:
    """Build a DataFrame with the schema column order and explicit dtypes, rows sorted for determinism."""
    cols = COLUMNS[table]
    schema = {c: PL_TYPES.get(c, pl.String) for c in cols}
    data = {c: [r.get(c) for r in rows] for c in cols}
    return pl.DataFrame(data, schema=schema).sort(sort_by, nulls_last=True, maintain_order=True)


# Script detection from the characters of a name (a property of the string itself, not outside knowledge).
_SCRIPT_PREFIXES = (
    ("LATIN", "Latn"),
    ("ARABIC", "Arab"),
    ("CYRILLIC", "Cyrl"),
    ("GREEK", "Grek"),
    ("HEBREW", "Hebr"),
    ("DEVANAGARI", "Deva"),
    ("BENGALI", "Beng"),
    ("TAMIL", "Taml"),
    ("TELUGU", "Telu"),
    ("THAI", "Thai"),
    ("GEORGIAN", "Geor"),
    ("ARMENIAN", "Armn"),
    ("HANGUL", "Hang"),
    ("HIRAGANA", "Hira"),
    ("KATAKANA", "Kana"),
    ("CJK", "Hani"),
    ("ETHIOPIC", "Ethi"),
    ("GUJARATI", "Gujr"),
    ("GURMUKHI", "Guru"),
    ("KANNADA", "Knda"),
    ("MALAYALAM", "Mlym"),
    ("KHMER", "Khmr"),
    ("LAO", "Laoo"),
    ("MYANMAR", "Mymr"),
    ("SINHALA", "Sinh"),
    ("TIBETAN", "Tibt"),
    ("MONGOLIAN", "Mong"),
    ("THAANA", "Thaa"),
    ("SYRIAC", "Syrc"),
)


def detect_script(text: str) -> str | None:
    """Return an ISO 15924 code if every letter of `text` belongs to one known script, else None."""
    found: set[str] = set()
    for ch in text:
        if not ch.isalpha():
            continue
        try:
            uname = unicodedata.name(ch)
        except ValueError:
            return None
        for prefix, code in _SCRIPT_PREFIXES:
            if uname.startswith(prefix):
                found.add(code)
                break
        else:
            return None
    return found.pop() if len(found) == 1 else None


def name_type(name_lang: str | None, own_codes: set[str]) -> str:
    """endonym if the name is written in the languoid's own language, exonym if in another, else alias."""
    if not name_lang:
        return "alias"
    base = name_lang.split("-")[0].lower()
    return "endonym" if base in own_codes else "exonym"


def _prov(
    source_id: str, locator: str, retrieved_at: str, licenses: dict[str, dict], confidence: str, notes=None
) -> dict:
    return {
        "source_id": source_id,
        "locator": locator,
        "retrieved_at": retrieved_at,
        "license": licenses[source_id]["license"],
        "confidence": confidence,
        "notes": notes,
    }


def build_languoids(
    gl: readers.GlottologData, retrieved_at: str, licenses: dict[str, dict], wd_qid: dict[str, str | None]
) -> list[dict]:
    sid = common.GLOTTOLOG
    rows = []
    for lang in gl.languages:
        gc = lang["glottocode"]
        cls = gl.values.get((gc, "classification"))
        parent = cls["value"].split("/")[-1] if cls and cls["value"] else None
        aes = gl.values.get((gc, "aes"))
        category = gl.values.get((gc, "category"))
        locator = f"languages.csv#{lang['id']}"
        if cls:
            locator += f";values.csv#{cls['row_id']}"
        rows.append(
            {
                "glottocode": gc,
                "level": lang["level"],
                "parent_glottocode": parent,
                "name": lang["name"],
                "iso639_3": lang["iso"],
                "wikidata_qid": wd_qid.get(gc),
                "macroarea": lang["macroarea"],
                "latitude": round(lang["latitude"], 6) if lang["latitude"] is not None else None,
                "longitude": round(lang["longitude"], 6) if lang["longitude"] is not None else None,
                "endangerment": gl.code_names.get(aes["code_id"]) if aes else None,
                "is_macrolanguage": None,  # Glottolog does not carry this; left null, never guessed.
                "is_isolate": lang["is_isolate"],
                "category": category["value"] if category else None,
                **_prov(sid, locator, retrieved_at, licenses, "high"),
            }
        )
    return rows


VIA_FAMILY = "wikidata_p1394_to_family"
VIA_ISO = "wikidata_iso_match"


def resolve_wikidata(
    wd_langs: dict[tuple[str, str], dict],
    known: set[str],
    levels: dict[str, str] | None = None,
    lang_by_iso: dict[str, list[str]] | None = None,
) -> tuple[dict[str, str | None], dict[str, set[str]], dict[str, list[tuple[str, dict]]], int, dict]:
    """Attach Wikidata items to Glottolog nodes.

    Returns (glottocode -> unique QID or None, glottocode -> candidate QIDs, per-glottocode entries,
    count of Glottocodes unknown to Glottolog, report).

    Rules, applied per item (QID):
    1. P1394 names a language-level node: the item goes there. Other P1394 nodes of the same item (its
       family, say) are dropped and listed in report["qid_conflicts"]. A QID never sits on two nodes.
    2. No P1394 node is language-level (the Glottocode is retired, or it is the language's parent): if the
       item's ISO 639-3 codes (P220) point to exactly one language-level node, the item goes there with
       method "ISO match" and is listed in report["iso_matches"]. Never guessed beyond that.
    3. Otherwise the item stays on its P1394 node. If that node is a family and the item is a language
       item (it carries an ISO 639-3 code), the entry is marked `via_family`: Wikidata's claim about a
       language, not a fact about the family. Its label is then an alias at most.
    Each returned entry carries `method`, `original` (P1394 values) and `via_family`.
    """
    levels = levels or {}
    lang_by_iso = lang_by_iso or {}
    items: dict[str, dict] = defaultdict(lambda: {"entries": {}, "iso3": set()})
    for (gc, qid), entry in sorted(wd_langs.items()):
        items[qid]["entries"][gc] = entry
        items[qid]["iso3"] |= set(entry["iso3"])

    by_gc: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    unknown: set[str] = set()
    report: dict = {"qid_conflicts": [], "iso_matches": [], "via_family": []}
    qid_targets: dict[str, list[str]] = {}
    for qid in sorted(items):
        info = items[qid]
        gcs = sorted(info["entries"])
        merged = {
            "iso3": set(info["iso3"]),
            "iso1": {c for e in info["entries"].values() for c in e["iso1"]},
            "labels": {},
            "retrieved_at": min(e["retrieved_at"] for e in info["entries"].values()),
        }
        for e in info["entries"].values():
            for lang, labels in e["labels"].items():
                merged["labels"].setdefault(lang, set()).update(labels)
        known_nodes = [g for g in gcs if g in known]
        unknown.update(g for g in gcs if g not in known)
        lang_nodes = [g for g in known_nodes if levels.get(g) == "language"]
        method, via_family = "P1394", False
        if lang_nodes:
            targets = lang_nodes
            dropped = [g for g in known_nodes if g not in lang_nodes]
            if dropped:
                report["qid_conflicts"].append(
                    {"qid": qid, "kept": lang_nodes, "dropped": dropped, "reason": "language-level node wins"}
                )
        else:
            iso_hits = sorted({g for code in info["iso3"] for g in lang_by_iso.get(code, [])})
            only_family_or_retired = all(levels.get(g) == "family" for g in known_nodes)
            if len(iso_hits) == 1 and only_family_or_retired:
                targets, method = iso_hits, "ISO match"
                report["iso_matches"].append(
                    {
                        "qid": qid,
                        "target": iso_hits[0],
                        "p1394": gcs,
                        "p1394_known": known_nodes,
                        "iso639_3": sorted(info["iso3"]),
                    }
                )
            else:
                targets = known_nodes
                via_family = bool(info["iso3"]) and any(levels.get(g) == "family" for g in known_nodes)
                if via_family:
                    report["via_family"].append(
                        {"qid": qid, "nodes": known_nodes, "iso639_3": sorted(info["iso3"])}
                    )
        qid_targets[qid] = targets
        for gc in targets:
            by_gc[gc].append((qid, {**merged, "method": method, "via_family": via_family, "original": gcs}))
    unique = {
        gc: (items_[0][0] if len(items_) == 1 and not items_[0][1]["via_family"] else None)
        for gc, items_ in by_gc.items()
    }
    candidates = {gc: {q for q, _ in items_} for gc, items_ in by_gc.items()}
    report["qid_targets"] = qid_targets
    return unique, candidates, dict(by_gc), len(unknown), report


def build_xrefs_and_names(
    languoid_rows: list[dict],
    gl: readers.GlottologData,
    gl_retrieved: str,
    by_gc: dict[str, list[tuple[str, dict]]],
    cldr_names: dict[str, tuple[dict[str, str], str]],
    licenses: dict[str, dict],
) -> tuple[list[dict], list[dict], dict[str, list[str]], dict[str, list[str]]]:
    """Return (xref rows, name rows, iso3 -> glottocodes, iso1 -> glottocodes)."""
    xrefs: list[dict] = []
    names: list[dict] = []
    gl_sid, wd_sid, cldr_sid = common.GLOTTOLOG, common.WIKIDATA, common.CLDR

    levels = {r["glottocode"]: r["level"] for r in languoid_rows}
    iso3_map: dict[str, set[str]] = defaultdict(set)
    iso1_map: dict[str, set[str]] = defaultdict(set)
    own_codes: dict[str, set[str]] = defaultdict(set)

    for row in languoid_rows:
        if row["iso639_3"]:
            iso3_map[row["iso639_3"]].add(row["glottocode"])
            own_codes[row["glottocode"]].add(row["iso639_3"])
            xrefs.append(
                {
                    "glottocode": row["glottocode"],
                    "scheme": "iso639-3",
                    "code": row["iso639_3"],
                    **_prov(gl_sid, row["locator"].split(";")[0], gl_retrieved, licenses, "high"),
                }
            )
    for gc, items in by_gc.items():
        shared = len(items) > 1
        for qid, entry in items:
            via_family = entry.get("via_family", False)
            iso_match = entry.get("method") == "ISO match"
            conf = "contested" if shared else "medium"
            notes_parts = []
            if shared:
                notes_parts.append(f"Glottocode {gc} is claimed by {len(items)} Wikidata items")
            if via_family:
                conf = "contested" if shared else "low"
                notes_parts.append(
                    f"{qid} is a language item that Wikidata attaches to the family {gc} via P1394 "
                    "(Wikidata's claim, not a fact about the family)"
                )
            if iso_match:
                notes_parts.append(
                    f"{qid} reached {gc} by ISO 639-3 match; its P1394 values are {', '.join(entry['original'])}"
                )
            note = "; ".join(notes_parts) or None
            locator_p1394 = f"{qid}#P1394"
            base = {
                "glottocode": gc,
                **_prov(wd_sid, locator_p1394, entry["retrieved_at"], licenses, conf, note),
            }
            if iso_match:
                base["locator"] = f"{qid}#P220"
            xrefs.append({**base, "scheme": "wikidata", "code": qid})
            for code in sorted(entry["iso1"]):
                xrefs.append({**base, "scheme": "iso639-1", "code": code, "locator": f"{qid}#P218"})
                if not shared and not via_family:
                    own_codes[gc].add(code)
                    # CLDR mapping is our inference, so it only lands on language-level languoids.
                    # (Wikidata's Persian item points at a Glottolog family; that stays a Wikidata
                    # claim in xrefs but is not used to attach CLDR data.)
                    if levels.get(gc) == "language":
                        iso1_map[code].add(gc)
            for code in sorted(entry["iso3"]):
                xrefs.append({**base, "scheme": "iso639-3", "code": code, "locator": f"{qid}#P220"})
                if not shared and not via_family:
                    own_codes[gc].add(code)

    # --- names
    def add(gc, text, lang, kind, prov):
        names.append(
            {
                "glottocode": gc,
                "name": text,
                "lang": lang,
                "script": detect_script(text),
                "type": kind,
                **prov,
            }
        )

    for row in languoid_rows:
        gc = row["glottocode"]
        add(
            gc,
            row["name"],
            "en",
            name_type("en", own_codes[gc]),
            _prov(
                gl_sid,
                row["locator"].split(";")[0],
                gl_retrieved,
                licenses,
                "high",
                "Glottolog primary name (English)",
            ),
        )
    known_gc = {r["glottocode"] for r in languoid_rows}
    for n in gl.names:
        if n["glottocode"] not in known_gc:
            continue
        lang = n["lang"] if n["lang"] and LANG_RE.match(n["lang"]) else None
        add(
            n["glottocode"],
            n["name"],
            lang,
            name_type(lang, own_codes[n["glottocode"]]),
            _prov(
                gl_sid, f"names.csv#{n['id']}", gl_retrieved, licenses, "medium", f"provider={n['provider']}"
            ),
        )
    for gc, items in by_gc.items():
        if len(items) != 1:
            continue  # ambiguous item: do not attach labels to the wrong languoid
        qid, entry = items[0]
        via_family = entry.get("via_family", False)
        for lang, labels in sorted(entry["labels"].items()):
            for label in sorted(labels):
                # A language item attached to a family never names the family: its labels are aliases.
                add(
                    gc,
                    label,
                    lang,
                    "alias" if via_family else name_type(lang, own_codes[gc]),
                    _prov(
                        wd_sid,
                        f"{qid}#label@{lang}",
                        entry["retrieved_at"],
                        licenses,
                        "low" if via_family else "medium",
                        f"label of {qid}, a language item that Wikidata attaches to this family via P1394"
                        if via_family
                        else None,
                    ),
                )
    # CLDR names resolve through the same code maps used for territories.
    for locale, (table, retrieved) in sorted(cldr_names.items()):
        for code, text in sorted(table.items()):
            base = code.split("-alt-")[0]
            is_alt = "-alt-" in code
            gcs = resolve_cldr(base, iso3_map, iso1_map)
            if not gcs:
                continue
            gc = gcs[0]
            add(
                gc,
                text,
                locale,
                "alias" if is_alt else name_type(locale, own_codes[gc]),
                _prov(
                    cldr_sid,
                    f"cldr-localenames-full/main/{locale}/languages.json#/main/{locale}/localeDisplayNames/languages/{code}",
                    retrieved,
                    licenses,
                    "high",
                    "CLDR alternate form" if is_alt else None,
                ),
            )
    return (
        xrefs,
        names,
        {k: sorted(v) for k, v in iso3_map.items()},
        {k: sorted(v) for k, v in iso1_map.items()},
    )


def resolve_cldr(code: str, iso3_map: dict, iso1_map: dict) -> list[str]:
    """Map a simple CLDR language code to Glottocodes through ISO 639-3 or Wikidata's ISO 639-1. [] if none/ambiguous."""
    if not re.fullmatch(r"[a-z]{2,3}", code):
        return []
    table = iso1_map if len(code) == 2 else iso3_map
    found = table.get(code, [])
    return list(found) if len(found) == 1 else []


def build_territories(
    territory_info: dict, retrieved: str, iso3_map: dict, iso1_map: dict, licenses: dict[str, dict]
) -> tuple[list[dict], list[dict]]:
    """Return (territory rows, unmapped entries). Unmapped codes are reported, never guessed."""
    rows: list[dict] = []
    unmapped: list[dict] = []
    for country in sorted(territory_info):
        info = territory_info[country]
        pop = info.get("_population")
        for code, lp in sorted(info.get("languagePopulation", {}).items()):
            gcs = resolve_cldr(code, iso3_map, iso1_map)
            locator = f"cldr-core/supplemental/territoryInfo.json#/supplemental/territoryInfo/{country}/languagePopulation/{code}"
            if not gcs:
                reason = (
                    "script-qualified" if "_" in code else "no unique ISO match to a language-level languoid"
                )
                unmapped.append({"code": code, "country": country, "reason": reason})
                continue
            share = lp.get("_populationPercent")
            rows.append(
                {
                    "glottocode": gcs[0],
                    "iso3166": country,
                    "cldr_code": code,
                    "population_share": float(share) if share is not None else None,
                    "territory_population": int(pop) if pop is not None else None,
                    "official_status": lp.get("_officialStatus"),
                    "year": None,  # CLDR does not date these estimates
                    **_prov(
                        common.CLDR,
                        locator,
                        retrieved,
                        licenses,
                        "medium",
                        "CLDR estimate; percent of the territory population; CLDR gives no year",
                    ),
                }
            )
    return rows, unmapped


KIND_BY_LABEL = (
    ("first language", "L1"),
    ("native language", "L1"),
    ("mother tongue", "L1"),
    ("native speaker", "L1"),
    ("second language", "L2"),
)


def speaker_kind(part_labels: list[str | None]) -> str:
    """L1/L2 only when the P518 qualifier says so in words; no qualifier or anything else is 'unknown'."""
    kinds = set()
    for label in part_labels:
        low = (label or "").lower()
        for needle, kind in KIND_BY_LABEL:
            if needle in low:
                kinds.add(kind)
                break
    return kinds.pop() if len(kinds) == 1 else "unknown"


def build_speakers(
    statements: list[dict],
    ambiguous: set[str],
    known: set[str],
    licenses: dict[str, dict],
    by_gc: dict[str, list[tuple[str, dict]]] | None = None,
) -> tuple[list[dict], int]:
    """One row per Wikidata statement. `by_gc` (from resolve_wikidata) says where each item was attached.

    attached_via is null when the statement sits on the node its item names through P1394. It is
    `wikidata_p1394_to_family` when a language item is attached to a family (Wikidata's claim about the
    language), and `wikidata_iso_match` when the item reached its node by ISO 639-3 match.
    """
    placed: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for target, items in (by_gc or {}).items():
        for qid, entry in items:
            placed[qid].append((target, entry))
    rows = []
    skipped = 0
    for st in statements:
        gc = st["glottocode"]
        entry = None
        targets = placed.get(st["qid"])
        if targets:
            chosen = next((t for t in targets if t[0] == gc), targets[0])
            gc, entry = chosen
        if gc not in known:
            skipped += 1
            continue
        attached_via = None
        notes = []
        if entry and entry.get("via_family"):
            attached_via = VIA_FAMILY
            notes.append(
                f"{st['qid']} is a language item that Wikidata attaches to the family {gc} via P1394; "
                "Wikidata's claim about the language, not a figure for the family"
            )
        elif entry and entry.get("method") == "ISO match":
            attached_via = VIA_ISO
            notes.append(
                f"{st['qid']} reached {gc} by ISO 639-3 match; its P1394 values are {', '.join(entry['original'])}"
            )
        years = sorted({y for y in (readers.year_of(t) for t in st["times"]) if y is not None})
        year = years[0] if len(years) == 1 else None
        if len(years) > 1:
            notes.append(f"multiple point-in-time years {years}; year left null")
        part_items = sorted(st["parts"].items())
        kind = speaker_kind([label for _, label in part_items])
        part = "; ".join(f"{q} ({label})" if label else q for q, label in part_items) or None
        method_items = sorted(st["methods"].items())
        method = "; ".join(f"{q} ({label})" if label else q for q, label in method_items) or None
        refs = [dict(sorted(r.items())) for _, r in sorted(st["refs"].items())]
        has_ref = bool(refs)
        if st["rank"].lower().startswith("deprecated"):
            rank, conf = "deprecated", "low"
            notes.append("deprecated rank on Wikidata")
        elif not has_ref:
            rank, conf = st["rank"].replace("Rank", "").lower(), "low"
        else:
            rank, conf = st["rank"].replace("Rank", "").lower(), "medium"
        if attached_via == VIA_FAMILY:
            conf = "low"
        if gc in ambiguous:
            conf = "low"
            notes.append("Glottocode is claimed by several Wikidata items")
        try:
            value = float(st["value"])
        except ValueError:
            skipped += 1
            continue
        rows.append(
            {
                "speaker_id": f"wd:{st['statement']}",
                "glottocode": gc,
                "kind": kind,
                "value": value,
                "value_low": None,
                "value_high": None,
                "year": year,
                "place": None,
                "method": method,
                "part": part,
                "rank": rank,
                "references": json.dumps(refs, sort_keys=True, ensure_ascii=False, separators=(",", ":")),
                "has_reference": has_ref,
                "disagrees_gt_25pct": False,
                "attached_via": attached_via,
                **_prov(
                    common.WIKIDATA,
                    f"statement/{st['statement']}",
                    st["retrieved_at"],
                    licenses,
                    conf,
                    "; ".join(notes) or None,
                ),
            }
        )
    flag_disagreements(rows)
    return rows, skipped


def flag_disagreements(rows: list[dict]) -> None:
    """Flag rows whose (glottocode, kind) group spans more than 25 percent: (max - min) / max.

    Rows are never merged or averaged. Years may differ inside a group; the flag only says
    that sources disagree widely enough that the UI must show the range and each source.
    Deprecated statements are ignored for the comparison.
    """
    groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in rows:
        if r["rank"] != "deprecated" and r["value"] is not None:
            groups[(r["glottocode"], r["kind"])].append(r)
    for members in groups.values():
        if len(members) < 2:
            continue
        hi = max(m["value"] for m in members)
        lo = min(m["value"] for m in members)
        if hi > 0 and (hi - lo) / hi > 0.25:
            for m in members:
                m["disagrees_gt_25pct"] = True
