"""Build and validate checks on the small fictional fixture in tests/pipeline/fixtures/raw."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import polars as pl
import pytest

from pipeline import common, schemas
from pipeline.build import build
from pipeline.cli import main
from pipeline.validate import validate

FIXTURE_RAW = Path(__file__).parent / "fixtures" / "raw"


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("build")
    build(FIXTURE_RAW, out)
    return out


def table(built: Path, name: str) -> pl.DataFrame:
    return pl.read_parquet(built / f"{name}.parquet")


def test_validate_passes_on_fixture_build(built):
    assert validate(built) == []


def test_cli_validate_runs_on_fixture_build(built, capsys):
    assert main(["validate", "--build-dir", str(built)]) == 0
    assert "OK" in capsys.readouterr().out


def test_every_table_matches_its_schema(built):
    for name, schema in schemas.TABLES.items():
        schema.validate(table(built, name), lazy=True)


def test_fact_rows_carry_provenance(built):
    licenses = common.load_licenses()
    for name in ("languoids", "names", "xrefs", "speakers", "territories"):
        df = table(built, name)
        for col in schemas.PROVENANCE:
            if col != "notes":
                assert df[col].null_count() == 0, (name, col)
        assert set(df["source_id"]) <= set(licenses)
        assert set(df["confidence"]) <= set(common.CONFIDENCE)


def test_parent_links_and_levels(built):
    lang = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert lang["test0003"]["parent_glottocode"] == "test0002"
    assert lang["test0002"]["parent_glottocode"] == "test0001"
    assert lang["test0001"]["parent_glottocode"] is None
    assert lang["test0003"]["level"] == "dialect"
    assert lang["test0002"]["endangerment"] == "not endangered"
    assert lang["test0002"]["latitude"] == 11.123457  # rounded to 6 places
    assert lang["test0004"]["macroarea"] == "Africa;Eurasia"
    assert lang["test0002"]["wikidata_qid"] == "Q9001"
    assert lang["test0006"]["wikidata_qid"] is None  # claimed by two Wikidata items: not guessed
    assert lang["test0002"]["is_macrolanguage"] is None


def test_shared_glottocode_is_contested_in_xrefs(built):
    x = table(built, "xrefs").filter((pl.col("glottocode") == "test0006") & (pl.col("scheme") == "wikidata"))
    assert sorted(x["code"]) == ["Q9006", "Q9007"]
    assert set(x["confidence"]) == {"contested"}


def test_speaker_rows_are_never_merged_or_averaged(built):
    spk = table(built, "speakers")
    assert spk.height == 5  # 6 raw statements, one skipped (Glottocode not in Glottolog)
    assert spk["speaker_id"].n_unique() == spk.height
    english = spk.filter(pl.col("glottocode") == "test0002")
    assert sorted(english["value"]) == [600000.0, 900000.0, 1000000.0]
    l1 = english.filter(pl.col("kind") == "L1")
    assert sorted(l1["value"]) == [600000.0, 1000000.0]
    assert l1["disagrees_gt_25pct"].all()  # 600k vs 1M is a 40 percent spread


def test_speaker_confidence_and_references(built):
    spk = {r["locator"]: r for r in table(built, "speakers").to_dicts()}
    aaa = spk["statement/Q9001-AAA"]
    assert (
        aaa["confidence"] == "medium" and aaa["has_reference"] and aaa["year"] == 2020 and aaa["kind"] == "L1"
    )
    refs = json.loads(aaa["references"])
    assert len(refs) == 2  # the cross-product row became a second reference, not a second statement
    assert {r["stated_in"] for r in refs} == {"Q14790", "Q14799"}
    ccc = spk["statement/Q9001-CCC"]
    assert ccc["confidence"] == "low" and ccc["kind"] == "unknown" and ccc["year"] is None
    ddd = spk["statement/Q9004-DDD"]
    assert ddd["rank"] == "deprecated" and ddd["confidence"] == "low"
    assert spk["statement/Q9006-EEE"]["confidence"] == "low"
    assert "Q39825 (census)" in spk["statement/Q9001-BBB"]["method"]


def test_territories_and_unmapped_codes(built):
    terr = table(built, "territories")
    assert terr.height == 3
    row = terr.filter((pl.col("glottocode") == "test0002") & (pl.col("iso3166") == "ZZ")).to_dicts()[0]
    assert row["population_share"] == 60.0 and row["official_status"] == "official" and row["year"] is None
    assert row["confidence"] == "medium"
    coverage = (built / "coverage.md").read_text(encoding="utf-8")
    assert "qzz" in coverage and "qaa_Latn" in coverage and "qaa-ZZ" in coverage


def test_names_types_scripts_and_sources(built):
    names = table(built, "names")
    fa = names.filter((pl.col("glottocode") == "test0002") & (pl.col("lang") == "fa"))
    assert set(fa["script"]) == {"Arab"}
    assert {"cldr-49", "wikidata"} <= set(fa["source_id"])
    own = names.filter((pl.col("lang") == "qaa") & (pl.col("name") == "Testish"))
    assert set(own["type"]) == {"endonym"}
    alt = names.filter(pl.col("name") == "Tst")
    assert set(alt["type"]) == {"alias"}
    assert names.filter(pl.col("glottocode") == "test0006")["source_id"].to_list().count("wikidata") == 0


def test_bundles_tree_and_geo(built):
    bundle = json.loads((built / "bundles" / "test0002.json").read_text(encoding="utf-8"))
    assert [a["glottocode"] for a in bundle["lineage"]] == ["test0001"]
    assert bundle["children"]["total"] == 1
    assert len(bundle["speakers"]) == 3
    assert all(s["source_id"] and s["locator"] and s["retrieved_at"] for s in bundle["speakers"])
    block = bundle["territories"][0]
    assert block["source_id"] == "cldr-49" and "{iso3166}" in block["locator_template"]
    assert {i["iso3166"] for i in block["items"]} == {"YY", "ZZ"}
    assert set(bundle["sources"]) <= set(common.load_licenses())
    assert all(
        (built / "bundles" / f).stat().st_size <= 50 * 1024
        for f in [p.name for p in (built / "bundles").iterdir()]
    )
    tree = json.loads((built / "tree.json").read_text(encoding="utf-8"))
    nodes = {n[0]: n for n in tree["nodes"]}
    assert nodes["test0002"][4] == 1 and nodes["test0002"][5] == 1000000  # child_count, l1_max
    assert tree["sources"][nodes["test0002"][6]] == "wikidata"
    assert nodes["test0004"][7] is None  # only a deprecated figure: no bubble size
    countries = json.loads((built / "geo" / "countries_50m.geojson").read_text(encoding="utf-8"))
    props = countries["features"][0]["properties"]
    assert "ADM0_A3" in props and "ADM0_A3_CN" in props and "MAPCOLOR7" not in props
    assert countries["license"] == "LicenseRef-PublicDomain"
    assert (built / "NOTICE-cldr-49-unicode-license.txt").exists()


def test_build_is_reproducible(tmp_path):
    a, b = tmp_path / "a", tmp_path / "b"
    build(FIXTURE_RAW, a)
    build(FIXTURE_RAW, b)
    sums_a = {p.relative_to(a).as_posix(): common.sha256_file(p) for p in a.rglob("*") if p.is_file()}
    sums_b = {p.relative_to(b).as_posix(): common.sha256_file(p) for p in b.rglob("*") if p.is_file()}
    assert sums_a == sums_b and len(sums_a) > 10


def test_validate_catches_unknown_source_and_orphans(built, tmp_path):
    bad = tmp_path / "bad"
    shutil.copytree(built, bad)
    names = pl.read_parquet(bad / "names.parquet").with_columns(
        pl.when(pl.col("name") == "Tst")
        .then(pl.lit("made-up-source"))
        .otherwise(pl.col("source_id"))
        .alias("source_id")
    )
    names.write_parquet(bad / "names.parquet")
    failures = validate(bad)
    assert any("not in LICENSES.yaml" in f for f in failures)
    assert any("manifest checksum mismatch" in f for f in failures)


def test_validate_catches_oversized_bundle_and_duplicate_speaker(built, tmp_path):
    bad = tmp_path / "bad2"
    shutil.copytree(built, bad)
    (bad / "bundles" / "test0001.json").write_text(json.dumps({"glottocode": "test0001", "pad": "x" * 60000}))
    spk = pl.read_parquet(bad / "speakers.parquet")
    pl.concat([spk, spk.head(1)]).write_parquet(bad / "speakers.parquet")
    failures = validate(bad)
    assert any("limit 51200" in f for f in failures)
    assert any("same source statement" in f for f in failures)


def test_build_stops_when_source_missing_from_licenses(tmp_path):
    licenses = tmp_path / "LICENSES.yaml"
    licenses.write_text("schema_version: 1\nsources: []\nassets: []\n", encoding="utf-8")
    with pytest.raises(SystemExit, match=r"no entry in data/LICENSES.yaml"):
        build(FIXTURE_RAW, tmp_path / "out", licenses)
