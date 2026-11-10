"""Pending pipeline checks for docs/specs/persian.md section 1.4 (D-028): figures for a lumper group.

The fixture stands in for the real case with fictional codes:
- test0009 "Persish Group" plays fars1254: a family that Wikidata's language item Q9011 (playing Q9168,
  Persian) attaches to. Today its rows sit on test0009 with attached_via wikidata_p1394_to_family.
- The group "persish" plays lumper_groups.persian, with members test0002 and test0004.
- CLDR code "qp" plays "fa": a code that names the group as a whole.

Fixture additions the implementer makes with the work (none exist yet, so the module is skipped):
1. tests/pipeline/fixtures/scope.yaml: lumper_groups.persish with label, members [test0002, test0004],
   glottolog_ancestor test0001, owner_decision D-028, attach {cldr: [qp], wikidata: [Q9011]}, and a
   views block (spec 1.3).
2. The fixture CLDR territoryInfo: "qp" in ZZ at 40 percent, and an English name for "qp".
Remove the skip mark when section 1.4 lands. Existing tests that count territory rows or assume the
Q9011 rows on test0009 (test_wikidata_family_attachment_is_a_claim_not_a_name) change with it.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import polars as pl
import pytest

from pipeline.build import build
from pipeline.validate import validate

pytestmark = pytest.mark.skip(reason="pending: docs/specs/persian.md section 1.4 (D-028)")

FIXTURE_RAW = Path(__file__).parent / "fixtures" / "raw"
FIXTURE_SCOPE = Path(__file__).parent / "fixtures" / "scope.yaml"
GROUP = "persish"
MEMBERS = ("test0002", "test0004")


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("build_lens")
    build(FIXTURE_RAW, out, scope_path=FIXTURE_SCOPE)
    return out


def table(built: Path, name: str) -> pl.DataFrame:
    return pl.read_parquet(built / f"{name}.parquet")


def group_bundle(built: Path) -> dict:
    return json.loads((built / "groups" / f"{GROUP}.json").read_text(encoding="utf-8"))


def test_wikidata_rows_for_the_group_item_attach_to_the_group(built):
    rows = table(built, "speakers").filter(pl.col("speaker_id").str.starts_with("wd:Q9011"))
    assert rows.height > 0
    assert rows["group_id"].to_list() == [GROUP] * rows.height
    assert rows["glottocode"].null_count() == rows.height


def test_cldr_rows_for_the_group_code_attach_to_the_group(built):
    rows = table(built, "territories").filter(pl.col("group_id") == GROUP)
    assert rows.height == 1
    row = rows.to_dicts()[0]
    assert row["iso3166"] == "ZZ" and row["population_share"] == 40.0 and row["glottocode"] is None
    assert "qp" not in (built / "coverage.md").read_text(encoding="utf-8").split("## Unmapped CLDR codes")[1]


def test_every_fact_row_has_exactly_one_owner(built):
    for name in ("speakers", "territories"):
        df = table(built, name)
        both = df.filter(pl.col("glottocode").is_not_null() & pl.col("group_id").is_not_null())
        neither = df.filter(pl.col("glottocode").is_null() & pl.col("group_id").is_null())
        assert both.height == 0 and neither.height == 0, name


def test_group_bundle_is_written_listed_and_labeled(built):
    doc = group_bundle(built)
    assert doc["schema"] == 1 and doc["id"] == GROUP and doc["members"] == list(MEMBERS)
    assert set(doc["views"]) == {"atlas", "iso", "glottolog"}
    assert doc["speakers"] and doc["territories"] and doc["sources"]
    for row in doc["speakers"] + doc["territories"]:
        assert row.get("scope_note"), row  # "Figure for ... as a whole" (spec 1.4)
    manifest = json.loads((built / "manifest.json").read_text(encoding="utf-8"))
    assert f"groups/{GROUP}.json" in {o["path"] for o in manifest["outputs"]}


def test_group_figures_are_moved_not_copied(built):
    group_ids = {r["speaker_id"] for r in group_bundle(built)["speakers"]}
    for g in (*MEMBERS, "test0009"):
        bundle = json.loads((built / "bundles" / f"{g}.json").read_text(encoding="utf-8"))
        own = {r["speaker_id"] for r in bundle.get("speakers", [])}
        assert not own & group_ids, g
    fam = json.loads((built / "bundles" / "test0009.json").read_text(encoding="utf-8"))
    assert any(GROUP in json.dumps(n) for n in fam.get("notes", [])), "pointer to the group missing"


def test_group_figures_never_size_the_tree(built):
    tree = json.loads((built / "tree.json").read_text(encoding="utf-8"))
    family = next(n for n in tree["nodes"] if n[0] == "test0009")
    assert family[5] is None and family[7] is None  # the group item's figures never size the family
    assert GROUP not in {n[0] for n in tree["nodes"]}  # a group is not a Glottolog node


def test_validate_passes_and_catches_broken_owners(built, tmp_path):
    assert validate(built) == []
    bad = tmp_path / "bad_owner"
    shutil.copytree(built, bad)
    spk = pl.read_parquet(bad / "speakers.parquet")
    spk = spk.with_columns(
        pl.when(pl.col("group_id") == GROUP)
        .then(pl.lit("test0002"))
        .otherwise(pl.col("glottocode"))
        .alias("glottocode")
    )
    spk.write_parquet(bad / "speakers.parquet")
    assert any("exactly one of glottocode and group_id" in f for f in validate(bad))


def test_validate_catches_an_unknown_group(built, tmp_path):
    bad = tmp_path / "bad_group"
    shutil.copytree(built, bad)
    terr = pl.read_parquet(bad / "territories.parquet")
    terr = terr.with_columns(
        pl.when(pl.col("group_id") == GROUP)
        .then(pl.lit("nogroup"))
        .otherwise(pl.col("group_id"))
        .alias("group_id")
    )
    terr.write_parquet(bad / "territories.parquet")
    assert any("unknown group" in f for f in validate(bad))
