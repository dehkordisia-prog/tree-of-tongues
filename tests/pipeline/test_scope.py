"""Checks on content/scope/phase-1-languages.yaml, the Phase 1 scope list.

CI has only the fictional fixture, so Glottocode existence is checked against the real languoids table only when
data/build is present; otherwise only the Glottocode format is checked.
"""

from __future__ import annotations

import re
from pathlib import Path

import polars as pl
import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SCOPE = ROOT / "content" / "scope" / "phase-1-languages.yaml"
REAL_LANGUOIDS = ROOT / "data" / "build" / "languoids.parquet"

GLOTTOCODE = re.compile(r"^[a-z]{4}\d{4}$")
CONFIDENCE = {"high", "medium", "low", "contested"}
LEVELS = {"family", "language", "dialect"}
LUMPER_GROUPS = {
    "arabic",
    "chinese",
    "persian",
    "punjabi",
    "hindustani",
    "malay",
    "filipino",
    "kurdish",
    "none",
}
NODE_CONFIDENCE = {"high", "medium", "low"}
UNDECIDED_RANKS = {91}  # Deccan: the only entry whose glottocode stays null


@pytest.fixture(scope="module")
def scope() -> dict:
    return yaml.safe_load(SCOPE.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def languages(scope) -> list[dict]:
    return scope["languages"]


def all_glottocodes(scope: dict) -> set[str]:
    codes: set[str] = set()
    for e in scope["languages"]:
        if e["glottocode"]:
            codes.add(e["glottocode"])
        if e.get("mechanical_candidate"):
            codes.add(e["mechanical_candidate"])
        codes.update(c["glottocode"] for c in e.get("candidates", []))
    for f in scope["families"]:
        codes.add(f["glottocode"])
        if f["parent_glottocode"]:
            codes.add(f["parent_glottocode"])
    return codes


def test_exactly_100_entries_with_unique_ranks_1_to_100(languages):
    assert len(languages) == 100
    ranks = [e["rank"] for e in languages]
    assert len(set(ranks)) == 100
    assert sorted(ranks) == list(range(1, 101))


def test_every_entry_has_the_required_fields(languages):
    required = {
        "rank",
        "chart_name",
        "glottocode",
        "glottolog_name",
        "level",
        "iso639_3",
        "wikidata_qid",
        "family_path",
        "method",
        "confidence",
        "notes",
    }
    for e in languages:
        assert required <= set(e), e["rank"]
        assert e["chart_name"] and e["chart_name"] != "unreadable", e["rank"]
        assert e["confidence"] in CONFIDENCE, e["rank"]
        assert e["method"], e["rank"]
        assert e["family_path"], e["rank"]


def test_mapped_entries_have_glottolog_fields_and_contested_ones_have_candidates(languages):
    for e in languages:
        assert e["display_name"], e["rank"]
        if e["glottocode"]:
            assert e["glottolog_name"] and e["level"] in LEVELS, e["rank"]
            assert e["confidence"] in CONFIDENCE, e["rank"]
        else:
            assert e["rank"] in UNDECIDED_RANKS, e["rank"]
            assert e["confidence"] == "contested", e["rank"]
        if e["confidence"] == "contested":
            assert e["contested_reason"], e["rank"]
            assert len(e["candidates"]) >= 2, e["rank"]
            for c in e["candidates"]:
                assert c["role"] and c["level"] in LEVELS, e["rank"]
            if e["glottocode"]:
                assert e["glottocode"] in {c["glottocode"] for c in e["candidates"]}, e["rank"]


def test_contested_entries_carry_node_confidence_group_and_inspector_note(scope, languages):
    groups = scope["lumper_groups"]
    assert set(groups) | {"none"} == LUMPER_GROUPS
    for name, g in groups.items():
        assert g["label"] and g["glottolog_ancestor"] and g["members"], name
        assert GLOTTOCODE.match(g["glottolog_ancestor"]), name
        assert all(GLOTTOCODE.match(m) for m in g["members"]), name
    in_scope: dict[str, set[str]] = {}
    for e in languages:
        if e["confidence"] != "contested":
            assert "lumper_group" not in e, e["rank"]
            continue
        assert e["node_confidence"] in NODE_CONFIDENCE, e["rank"]
        assert e["lumper_group"] in LUMPER_GROUPS, e["rank"]
        note = e["inspector_note"]
        assert isinstance(note, str) and note.strip() and "\n" not in note.strip(), e["rank"]
        if e["lumper_group"] != "none":
            assert e["glottocode"] in groups[e["lumper_group"]]["members"], e["rank"]
            in_scope.setdefault(e["lumper_group"], set()).add(e["glottocode"])
        else:
            assert e["rank"] in UNDECIDED_RANKS or e["glottocode"], e["rank"]
    for name in groups:
        assert in_scope.get(name), f"lumper group {name} has no entry"
    assert groups["persian"]["owner_decision"] == "pending"
    assert scope["owner_decisions"], "owner_decisions missing"


def test_decided_entries_with_a_null_qid_explain_it(languages):
    for e in languages:
        if e["glottocode"] and e["wikidata_qid"] is None:
            assert e.get("qid_note"), e["rank"]
        if e.get("retired_iso"):
            assert e["iso639_3"] is None, e["rank"]


def test_no_em_dashes_in_the_file():
    assert chr(0x2014) not in SCOPE.read_text(encoding="utf-8")


def test_glottocodes_are_well_formed_and_unique_per_decided_entry(scope, languages):
    for code in all_glottocodes(scope):
        assert GLOTTOCODE.match(code), code
    decided = [e["glottocode"] for e in languages if e["glottocode"]]
    assert len(decided) == len(set(decided))


def test_family_nodes_are_unique_and_parents_are_listed_or_roots(scope):
    fams = {f["glottocode"]: f for f in scope["families"]}
    assert len(fams) == len(scope["families"])
    for f in fams.values():
        assert f["parent_glottocode"] is None or f["parent_glottocode"] in fams, f["glottocode"]


def test_no_speaker_numbers_in_the_file():
    """Names and ranks only: no figure may be copied from the chart (Ethnologue data cannot be redistributed)."""
    body = "\n".join(
        line for line in SCOPE.read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("#")
    )
    body = re.sub(r"\b[a-z]{4}\d{4}\b", "", body)  # Glottocodes
    body = re.sub(r"\bQ\d+\b", "", body)  # Wikidata QIDs
    body = re.sub(r"\b\d{4}-\d{2}(?:-\d{2})?\b", "", body)  # ISO dates, e.g. retirement dates
    body = re.sub(r"\b\d{4}-\d{3}\b", "", body)  # ISO change request ids
    body = re.sub(
        r"(?i)\b(?:in|since|by|until) (?:19|20)\d{2}\b", "", body
    )  # a year in a sentence, e.g. "in 2023"
    assert not re.search(r"\d{1,3}(?:[,.]\d{3})+", body), "thousands-grouped number found"
    assert not re.search(r"\b\d{4,}\b", body), "number with four or more digits found"
    assert not re.search(r"(?i)\b\d+(?:\.\d+)?\s*(?:million|billion|m)\b", body), (
        "speaker figure in words found"
    )
    assert not re.search(r"(?i)speakers?\s*[:=]", body)


@pytest.mark.skipif(not REAL_LANGUOIDS.exists(), reason="data/build is absent (CI has only the fixture)")
def test_glottocodes_exist_in_real_languoids_and_fields_match(scope, languages):
    table = pl.read_parquet(REAL_LANGUOIDS)
    rows = {r["glottocode"]: r for r in table.iter_rows(named=True)}
    missing = sorted(all_glottocodes(scope) - set(rows))
    assert not missing, missing
    for e in languages:
        if not e["glottocode"]:
            continue
        r = rows[e["glottocode"]]
        assert e["glottolog_name"] == r["name"], e["rank"]
        assert e["level"] == r["level"], e["rank"]
        if e.get("retired_iso"):
            assert r["iso639_3"] is None or e["retired_iso"].startswith(r["iso639_3"]), e["rank"]
        else:
            assert e["iso639_3"] == r["iso639_3"], e["rank"]
        assert e["wikidata_qid"] == r["wikidata_qid"], e["rank"]
    for e in languages:
        for c in e.get("candidates", []):
            assert rows[c["glottocode"]]["name"] == c["glottolog_name"], (e["rank"], c["glottocode"])
    for f in scope["families"]:
        assert rows[f["glottocode"]]["level"] == "family", f["glottocode"]
