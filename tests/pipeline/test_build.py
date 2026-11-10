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
FIXTURE_SCOPE = Path(__file__).parent / "fixtures" / "scope.yaml"


@pytest.fixture(scope="module")
def built(tmp_path_factory) -> Path:
    out = tmp_path_factory.mktemp("build")
    build(FIXTURE_RAW, out, scope_path=FIXTURE_SCOPE)
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
    assert spk.height == 9  # 12 raw statements; skipped: unknown Glottocode, two items on retired nodes
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
    assert terr.height == 4  # ZZ: qaa, qab, qf; YY: qaa
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
    build(FIXTURE_RAW, a, scope_path=FIXTURE_SCOPE)
    build(FIXTURE_RAW, b, scope_path=FIXTURE_SCOPE)
    sums_a = {p.relative_to(a).as_posix(): common.sha256_file(p) for p in a.rglob("*") if p.is_file()}
    sums_b = {p.relative_to(b).as_posix(): common.sha256_file(p) for p in b.rglob("*") if p.is_file()}
    assert sums_a == sums_b and len(sums_a) > 10


def test_validate_fails_on_any_unlisted_file(built, tmp_path):
    copy = tmp_path / "copy"
    shutil.copytree(built, copy)
    assert validate(copy) == []
    (copy / "derived").mkdir()
    (copy / "derived" / "territory_index.json").write_text("{}\n")
    assert any("manifest/disk mismatch" in f for f in validate(copy))
    shutil.rmtree(copy / "derived")
    (copy / "stray.json").write_text("{}\n")
    assert any("manifest/disk mismatch" in f for f in validate(copy))


def test_manifest_lists_territory_index_and_search_tiers(built):
    doc = json.loads((built / "manifest.json").read_text(encoding="utf-8"))
    listed = {o["path"]: o for o in doc["outputs"]}
    for rel in ("territory_index.json", "search/tier1.json", "search/tier2.json"):
        assert rel in listed and listed[rel]["source_ids"]


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


def test_territory_index_matches_territories_table(built):
    doc = json.loads((built / "territory_index.json").read_text(encoding="utf-8"))
    assert doc["provenance"]["source_id"] == "cldr-49" and doc["provenance"]["license"] == "Unicode-3.0"
    assert doc["territories"]["ZZ"] == [
        ["test0002", 60.0, "official", False, "glottolog_iso639_3"],
        ["test0004", 10.5, None, False, "glottolog_iso639_3"],
        ["test0005", 2.0, None, True, "wikidata_p218_iso_fallback"],
    ]
    assert doc["territories"]["YY"] == [["test0002", 100.0, None, False, "glottolog_iso639_3"]]
    assert doc["provenance"]["confidence"] == "medium"
    assert doc["provenance"]["weak_mapping_note"] == common.CLDR_FALLBACK_NOTE


def test_validate_catches_territory_index_drift(built, tmp_path):
    bad = tmp_path / "bad_ti"
    shutil.copytree(built, bad)
    path = bad / "territory_index.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["territories"]["ZZ"][0][1] = 61.0
    path.write_text(json.dumps(doc), encoding="utf-8")
    assert any("territory_index.json" in f for f in validate(bad))


def search_docs(built: Path, tier: int) -> dict[str, dict]:
    doc = json.loads((built / "search" / f"tier{tier}.json").read_text(encoding="utf-8"))
    assert doc["count"] == len(doc["documents"])
    return {d["id"]: d for d in doc["documents"]}


def test_search_tiers_split_scope_from_everything_else(built):
    t1, t2 = search_docs(built, 1), search_docs(built, 2)
    assert not set(t1) & set(t2)
    # scope languages, every candidate of contested entries, listed families and ancestors
    assert {"test0002", "test0008", "test0009", "test0006", "test0001", "test0007"} <= set(t1)
    # retired (Bookkeeping) nodes test0011 and test0013 are not searchable
    assert set(t2) == {"test0003", "test0004", "test0005", "test0010", "test0012"}
    assert t1["test0002"]["in_scope"] is True and "in_scope" not in t1["test0001"]
    assert {"ZZ", "YY"} <= set(t1) and t1["ZZ"]["kind"] == "country" and t1["ZZ"]["name"] == "Zedland"
    assert t1["ZZ"]["alt"] == ["Zed"] and {x["lang"] for x in t1["ZZ"]["localized"]} == {"fa", "tr"}
    live = table(built, "languoids").filter(~pl.col("retired"))
    assert set(live["glottocode"]) <= set(t1) | set(t2)


def test_search_documents_carry_names_and_sources(built):
    doc = search_docs(built, 1)["test0002"]
    assert doc["name"] == "Testish Standard" and doc["glottolog_name"] == "Testish"
    assert doc["display_name_source"].endswith("phase-1-languages.yaml")
    assert doc["iso639_3"] == "qaa" and doc["family"] == "test0001"
    assert doc["endonyms"] == [{"name": "Testish", "lang": "qaa", "script": "Latn"}]
    assert {"Testisch", "Tst", "Old Tongue"} <= set(doc["alt"])
    assert doc["aliases"] == [{"name": "Test Farsi", "alias": True}]
    assert {x["lang"] for x in doc["localized"]} == {"fa", "tr"}
    assert set(doc["source_ids"]) == {"cldr-49", "glottolog-5.3", "wikidata"}
    kinds = {d["kind"] for tier in (1, 2) for d in search_docs(built, tier).values()}
    assert kinds <= {"language", "dialect", "family", "country", "macrolanguage-candidate"}


def test_macrolanguage_candidates_come_from_family_level_iso_codes(built):
    macro = search_docs(built, 1)["qaf"]
    assert macro["kind"] == "macrolanguage-candidate" and macro["candidate_glottocodes"] == ["test0009"]


def test_farsi_only_as_flagged_alias(built):
    from pipeline.build.search import _language_doc, has_farsi

    for tier in (1, 2):
        for d in search_docs(built, tier).values():
            assert not has_farsi(d["name"])
    lang = {
        "glottocode": "test0002",
        "level": "language",
        "name": "Western Farsi",
        "iso639_3": None,
        "wikidata_qid": None,
        "parent_glottocode": None,
    }
    base = {"lang": None, "script": "Latn", "locator": "a"}
    rows = [
        {**base, "name": "Farsi", "type": "alias", "source_id": "glottolog-5.3"},
        {**base, "name": "Iranian Persian", "lang": "en", "type": "exonym", "source_id": "wikidata"},
    ]
    doc = _language_doc(lang, rows)
    assert doc["name"] == "Iranian Persian" and doc["glottolog_name"] == "Western Farsi"
    assert {"name": "Farsi", "alias": True} in doc["aliases"]
    assert {"name": "Western Farsi", "alias": True} in doc["aliases"]
    assert "Farsi" not in doc.get("alt", [])


def test_validate_catches_farsi_outside_aliases(built, tmp_path):
    bad = tmp_path / "bad_farsi"
    shutil.copytree(built, bad)
    path = bad / "search" / "tier2.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["documents"][0]["alt"] = ["Farsi"]
    path.write_text(json.dumps(doc), encoding="utf-8")
    assert any("Farsi outside aliases" in f for f in validate(bad))


def test_wikidata_family_attachment_is_a_claim_not_a_name(built):
    # Q9011 is a language item that Wikidata puts on the family test0009 (no language node has its ISO code)
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert langs["test0009"]["wikidata_qid"] is None and langs["test0009"]["name"] == "Persish Group"
    names = table(built, "names").filter(pl.col("glottocode") == "test0009")
    wd = names.filter(pl.col("source_id") == "wikidata")
    assert wd["type"].to_list() == ["alias"] and wd["confidence"].to_list() == ["low"]
    spk = {r["speaker_id"]: r for r in table(built, "speakers").to_dicts()}
    row = spk["wd:Q9011-HHH"]
    assert row["glottocode"] == "test0009" and row["attached_via"] == "wikidata_p1394_to_family"
    assert row["confidence"] == "low" and "not a figure for the family" in row["notes"]
    tree = json.loads((built / "tree.json").read_text(encoding="utf-8"))
    node = next(n for n in tree["nodes"] if n[0] == "test0009")
    assert node[5] is None and node[7] is None  # the tree does not size a family by a language item
    bundle = json.loads((built / "bundles" / "test0009.json").read_text(encoding="utf-8"))
    assert bundle["speakers"][0]["attached_via"] == "wikidata_p1394_to_family"
    assert search_docs(built, 1)["test0009"]["name"] == "Persish Group"


def test_qid_stays_on_the_language_node_when_family_shares_it(built):
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert langs["test0004"]["wikidata_qid"] == "Q9004" and langs["test0001"]["wikidata_qid"] is None
    x = table(built, "xrefs").filter((pl.col("scheme") == "wikidata") & (pl.col("code") == "Q9004"))
    assert x["glottocode"].to_list() == ["test0004"]
    assert "Q9004" in (built / "coverage.md").read_text(encoding="utf-8")


def test_iso_match_fallback_for_retired_and_parent_glottocodes(built):
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert langs["test0008"]["wikidata_qid"] == "Q9008"  # P1394 pointed at the parent family test0007
    assert langs["test0005"]["wikidata_qid"] == "Q9009"  # P1394 pointed at the retired node retr1234
    assert langs["test0007"]["wikidata_qid"] is None
    spk = {r["speaker_id"]: r for r in table(built, "speakers").to_dicts()}
    assert spk["wd:Q9008-GGG"]["glottocode"] == "test0008"
    assert spk["wd:Q9008-GGG"]["attached_via"] == "wikidata_iso_match"
    x = table(built, "xrefs").filter((pl.col("code") == "Q9009") & (pl.col("scheme") == "wikidata"))
    assert "ISO 639-3 match" in x["notes"][0] and "retr1234" in x["notes"][0]
    cov = (built / "coverage.md").read_text(encoding="utf-8")
    assert "Q9008" in cov and "Q9009" in cov and "retr1234" in cov
    assert "wd:Q9099-FFF" not in spk  # an item that reached no node is skipped, not guessed


def test_direct_p1394_beats_iso_match_on_the_same_node(built):
    # Q9012 names test0010 through P1394; Q9013 (P1394 on the family test0012) also matches it by ISO code qag.
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert langs["test0010"]["wikidata_qid"] == "Q9012" and langs["test0012"]["wikidata_qid"] is None
    xr = table(built, "xrefs").filter((pl.col("scheme") == "wikidata") & (pl.col("glottocode") == "test0010"))
    by_code = {r["code"]: r for r in xr.to_dicts()}
    assert set(by_code) == {"Q9012", "Q9013"}
    assert by_code["Q9012"]["confidence"] == "medium"  # not "contested": the loser is not a rival claim
    loser = by_code["Q9013"]
    assert loser["confidence"] == "low"
    assert "Q9012" in loser["notes"] and "cross-reference only" in loser["notes"]
    assert "Wikidata item may cover more than this Glottolog node" in loser["notes"]
    spk = {r["speaker_id"]: r for r in table(built, "speakers").to_dicts()}
    assert spk["wd:Q9012-III"]["attached_via"] is None and spk["wd:Q9012-III"]["confidence"] == "medium"
    assert not spk["wd:Q9012-III"]["disagrees_gt_25pct"]  # the loser's 90000 does not contest 1000
    kept = spk["wd:Q9013-JJJ"]
    assert kept["glottocode"] == "test0010" and kept["attached_via"] == "wikidata_iso_match"
    assert kept["confidence"] == "low" and "not used for sizing" in kept["notes"]
    tree = json.loads((built / "tree.json").read_text(encoding="utf-8"))
    node = next(n for n in tree["nodes"] if n[0] == "test0010")
    assert node[7] == 1000  # any_max comes from the direct item only
    names = table(built, "names").filter(
        (pl.col("glottocode") == "test0010") & (pl.col("source_id") == "wikidata")
    )
    types = dict(zip(names["name"].to_list(), names["type"].to_list(), strict=True))
    assert types["Directish"] != "alias" and types["Groupish language"] == "alias"
    assert "Q9013" in (built / "coverage.md").read_text(encoding="utf-8")


def test_iso_fallback_rows_are_weak_and_never_size_the_tree(built):
    spk = {r["speaker_id"]: r for r in table(built, "speakers").to_dicts()}
    row = spk["wd:Q9008-GGG"]  # Q9008 reached test0008 by ISO match
    assert row["attached_via"] == "wikidata_iso_match" and row["confidence"] == "low"
    assert "Wikidata item may cover more than this Glottolog node" in row["notes"]
    tree = json.loads((built / "tree.json").read_text(encoding="utf-8"))
    node = next(n for n in tree["nodes"] if n[0] == "test0008")
    assert node[5] is None and node[7] is None
    names = table(built, "names").filter(
        (pl.col("glottocode") == "test0008") & (pl.col("source_id") == "wikidata")
    )
    assert names["type"].to_list() and set(names["type"].to_list()) == {"alias"}
    # the scope list's display_name still wins for an in-scope node
    assert search_docs(built, 1)["test0008"]["name"] == "Contestish"


def test_retired_nodes_never_receive_a_wikidata_item(built):
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert langs["test0011"]["category"] == "Bookkeeping" and langs["test0011"]["wikidata_qid"] is None
    assert langs["test0013"]["wikidata_qid"] is None  # retired without the name suffix
    x = table(built, "xrefs").filter(pl.col("code").is_in(["Q9014", "Q9015"]))
    assert x.height == 0
    spk = table(built, "speakers")
    assert spk.filter(pl.col("speaker_id").is_in(["wd:Q9014-KKK", "wd:Q9015-LLL"])).height == 0
    assert spk.filter(pl.col("glottocode").is_in(["test0011", "test0013"])).height == 0
    names = table(built, "names").filter(pl.col("source_id") == "wikidata")
    assert names.filter(pl.col("glottocode").is_in(["test0011", "test0013"])).height == 0
    cov = (built / "coverage.md").read_text(encoding="utf-8")
    assert "Q9014" in cov and "Q9015" in cov and "retired node" in cov


def test_retired_node_with_a_recorded_replacement_takes_the_replacement():
    from pipeline.build.tables import resolve_wikidata

    def entry(iso):
        return {"iso3": set(iso), "iso1": set(), "labels": {}, "retrieved_at": "2026-01-01T00:00:00Z"}

    levels = {"old00001": "language", "new00001": "language", "fam00001": "family"}
    known = set(levels)
    wd = {("old00001", "Q1"): entry({"qaa"}), ("old00001", "Q2"): entry({"qaa"})}
    unique, _, by_gc, _, report = resolve_wikidata(
        wd, known, levels, {"qaa": ["new00001"]}, {"old00001": "new00001"}
    )
    assert set(by_gc) == {"new00001"} and unique["new00001"] is None  # two items: contested, not merged
    assert {e["method"] for _, e in by_gc["new00001"]} == {"replacement of retired node"}
    assert len(report["retired_replaced"]) == 2 and report["retired_skipped"] == []
    # no replacement recorded: left unattached and reported, not guessed
    unique, _, by_gc, _, report = resolve_wikidata(
        {("old00001", "Q1"): entry({"qaa"})}, known, levels, {}, {"old00001": None}
    )
    assert by_gc == {} and [r["qid"] for r in report["retired_skipped"]] == ["Q1"]


def test_deprecated_p1394_is_recorded_in_notes(built):
    # the fixture's deprecated_p1394 page says Q9008 lists test0008 with reason "does not exactly match"
    x = table(built, "xrefs").filter((pl.col("code") == "Q9008") & (pl.col("scheme") == "wikidata"))
    assert "deprecated P1394 value" in x["notes"][0] and "does not exactly match" in x["notes"][0]
    spk = {r["speaker_id"]: r for r in table(built, "speakers").to_dicts()}
    assert "deprecated P1394 value" in spk["wd:Q9008-GGG"]["notes"]
    assert "Q9008 on" in (built / "coverage.md").read_text(encoding="utf-8")


WEAK = "wikidata_p218_iso_fallback"


def test_cldr_rows_through_an_iso_fallback_item_are_flagged_low(built):
    terr = table(built, "territories")
    weak = terr.filter(pl.col("mapped_via") == WEAK).to_dicts()
    assert [(r["glottocode"], r["cldr_code"]) for r in weak] == [("test0005", "qf")]
    assert weak[0]["confidence"] == "low" and common.CLDR_FALLBACK_NOTE in weak[0]["notes"]
    strong = terr.filter(pl.col("mapped_via") != WEAK)
    assert set(strong["confidence"]) == {"medium"} and set(strong["mapped_via"]) == {"glottolog_iso639_3"}
    names = table(built, "names")
    wn = names.filter(pl.col("mapped_via") == WEAK)
    assert wn.height == 3 and set(wn["glottocode"]) == {"test0005"} and set(wn["confidence"]) == {"low"}
    assert all(common.CLDR_FALLBACK_NOTE in n for n in wn["notes"])
    assert set(wn["source_id"]) == {"cldr-49"}
    # non-CLDR names and CLDR names through Glottolog's own ISO code are not flagged
    assert (
        names.filter(pl.col("source_id") != "cldr-49")["mapped_via"].null_count()
        == names.filter(pl.col("source_id") != "cldr-49").height
    )
    direct = names.filter((pl.col("source_id") == "cldr-49") & (pl.col("glottocode") == "test0002"))
    assert set(direct["mapped_via"]) == {"glottolog_iso639_3"} and set(direct["confidence"]) == {"high"}


def test_weak_rows_reach_bundle_and_coverage(built):
    bundle = json.loads((built / "bundles" / "test0005.json").read_text(encoding="utf-8"))
    blocks = bundle["territories"]
    assert len(blocks) == 1 and blocks[0]["confidence"] == "low"
    assert blocks[0]["items"][0]["mapped_via"] == WEAK
    assert common.CLDR_FALLBACK_NOTE in blocks[0]["notes"]
    flagged = [n for n in bundle["names"]["items"] if n["mapped_via"] == WEAK]
    assert flagged and all(n["confidence"] == "low" for n in flagged)
    cov = (built / "coverage.md").read_text(encoding="utf-8")
    assert "mapped through an ISO-fallback Wikidata item (1)" in cov
    assert "| qf | test0005 | Loneish | no | 1 | 3 |" in cov


def test_weak_flag_applies_to_in_scope_nodes_too():
    from pipeline.build import cldr_weak_codes

    tabs = {
        "territories": pl.DataFrame({"cldr_code": ["hy"], "glottocode": ["test0005"], "mapped_via": [WEAK]}),
        "names": pl.DataFrame(
            {"glottocode": [], "locator": [], "mapped_via": []},
            schema={"glottocode": pl.String, "locator": pl.String, "mapped_via": pl.String},
        ),
        "languoids": pl.DataFrame({"glottocode": ["test0005"], "name": ["Loneish"]}),
    }
    out = cldr_weak_codes(tabs, {"test0005"})
    assert out[0]["code"] == "hy" and out[0]["in_scope"] is True


def test_retired_nodes_are_flagged_and_not_searchable(built):
    langs = {r["glottocode"]: r for r in table(built, "languoids").to_dicts()}
    assert {gc for gc, r in langs.items() if r["retired"]} == {"test0011", "test0013"}
    for gc in ("test0011", "test0013"):
        bundle = json.loads((built / "bundles" / f"{gc}.json").read_text(encoding="utf-8"))
        assert bundle["languoid"]["retired"] is True
        assert gc not in search_docs(built, 1) and gc not in search_docs(built, 2)
    cov = (built / "coverage.md").read_text(encoding="utf-8")
    assert "scope file names (not searchable; the scope owner should pick a live node): test0013" in cov
    live = json.loads((built / "bundles" / "test0002.json").read_text(encoding="utf-8"))
    assert live["languoid"]["retired"] is False


def test_validate_catches_a_retired_node_in_search(built, tmp_path):
    bad = tmp_path / "bad_retired"
    shutil.copytree(built, bad)
    path = bad / "search" / "tier2.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    doc["documents"].append({**doc["documents"][0], "id": "test0011", "glottocode": "test0011"})
    doc["count"] = len(doc["documents"])
    doc["documents"].sort(key=lambda d: d["id"])
    path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    assert any("retired" in f or "manifest" in f or "tier2" in f for f in validate(bad))
