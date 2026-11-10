"""`pipeline validate`: check a build directory. Exits non-zero on any failure.

Checks: pandera schemas for every table; provenance columns non-null; every source_id (and the
license beside it) matches data/LICENSES.yaml; foreign keys resolve; composite keys are unique;
speaker rows are one-per-source-statement (never duplicated, merged or averaged); bundles exist,
parse and stay under 50 KB; tree.json is consistent; manifest.json checksums match the files.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pandera.errors
import polars as pl

from pipeline import common, schemas

BUNDLE_MAX_BYTES = 50 * 1024
DERIVED_DIR = "derived"
FACT_TABLES = ("languoids", "names", "xrefs", "speakers", "territories")


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def fail(self, message: str) -> None:
        self.failures.append(message)

    def check(self, ok: bool, message: str) -> None:
        if not ok:
            self.fail(message)


def _schema_errors(name: str, df: pl.DataFrame, report: Report) -> None:
    try:
        schemas.TABLES[name].validate(df, lazy=True)
    except pandera.errors.SchemaErrors as exc:
        report.fail(f"{name}: schema errors: {str(exc)[:1500]}")


def _read_tables(build_dir: Path, report: Report) -> dict[str, pl.DataFrame]:
    tabs: dict[str, pl.DataFrame] = {}
    for name in schemas.TABLES:
        path = build_dir / f"{name}.parquet"
        if not path.exists():
            report.fail(f"missing table: {path.name}")
            continue
        tabs[name] = pl.read_parquet(path)
        _schema_errors(name, tabs[name], report)
    return tabs


def _check_provenance(tabs: dict[str, pl.DataFrame], licenses: dict[str, dict], report: Report) -> None:
    for name in FACT_TABLES:
        df = tabs.get(name)
        if df is None:
            continue
        for col in schemas.PROVENANCE:
            if col == "notes":
                continue
            nulls = df[col].null_count()
            report.check(nulls == 0, f"{name}.{col}: {nulls} null values")
        known = set(licenses)
        bad = sorted(set(df["source_id"].to_list()) - known)
        report.check(not bad, f"{name}: source_id not in LICENSES.yaml: {bad}")
        for sid, lic in {
            (r["source_id"], r["license"]) for r in df.select("source_id", "license").to_dicts()
        }:
            if sid in licenses:
                report.check(
                    licenses[sid]["license"] == lic,
                    f"{name}: row license {lic!r} differs from LICENSES.yaml {licenses[sid]['license']!r} for {sid}",
                )
    if "sources" in tabs:
        bad = sorted(set(tabs["sources"]["source_id"].to_list()) - set(licenses))
        report.check(not bad, f"sources: ids not in LICENSES.yaml: {bad}")


def _check_keys(tabs: dict[str, pl.DataFrame], report: Report) -> None:
    if "languoids" not in tabs:
        return
    lang = tabs["languoids"]
    codes = set(lang["glottocode"].to_list())
    parents = {
        r["glottocode"]: r["parent_glottocode"]
        for r in lang.select("glottocode", "parent_glottocode").to_dicts()
    }
    missing = sorted({p for p in parents.values() if p is not None and p not in codes})
    report.check(
        not missing, f"languoids.parent_glottocode does not resolve: {missing[:10]} ({len(missing)})"
    )
    for gc in parents:  # cycle check
        seen = set()
        cur: str | None = gc
        while cur is not None:
            if cur in seen:
                report.fail(f"parent cycle through {gc}")
                break
            seen.add(cur)
            cur = parents.get(cur)
    for name in ("names", "xrefs", "speakers", "territories"):
        if name in tabs:
            orphans = sorted(set(tabs[name]["glottocode"].to_list()) - codes)
            report.check(not orphans, f"{name}.glottocode does not resolve: {orphans[:10]} ({len(orphans)})")
    for name, key in schemas.COMPOSITE_KEYS.items():
        if name in tabs:
            dupes = tabs[name].height - tabs[name].select(key).n_unique()
            report.check(dupes == 0, f"{name}: {dupes} duplicate rows on key {key}")


def _check_speakers(tabs: dict[str, pl.DataFrame], report: Report) -> None:
    spk = tabs.get("speakers")
    if spk is None:
        return
    report.check(
        spk.height == spk.select("source_id", "locator").n_unique(),
        "speakers: the same source statement appears in more than one row",
    )
    bad_locator = spk.filter(~pl.col("locator").str.starts_with("statement/")).height
    report.check(
        bad_locator == 0, f"speakers: {bad_locator} rows whose locator is not a single source statement"
    )
    bad_range = spk.filter(
        (pl.col("value_low").is_not_null() & (pl.col("value_low") > pl.col("value")))
        | (pl.col("value_high").is_not_null() & (pl.col("value_high") < pl.col("value")))
    ).height
    report.check(bad_range == 0, f"speakers: {bad_range} rows with value outside [value_low, value_high]")
    for ref in spk["references"].to_list():
        try:
            json.loads(ref)
        except json.JSONDecodeError:
            report.fail("speakers: references column is not valid JSON")
            break
    mismatch = spk.filter(pl.col("has_reference") != (pl.col("references") != "[]")).height
    report.check(mismatch == 0, f"speakers: {mismatch} rows where has_reference disagrees with references")


def _check_bundles(
    build_dir: Path, tabs: dict[str, pl.DataFrame], licenses: dict[str, dict], report: Report
) -> None:
    folder = build_dir / "bundles"
    if not folder.is_dir():
        report.fail("missing bundles/ directory")
        return
    files = {p.stem: p for p in folder.glob("*.json")}
    if "languoids" in tabs:
        codes = set(tabs["languoids"]["glottocode"].to_list())
        report.check(set(files) == codes, f"bundles: {len(files)} files for {len(codes)} languoids")
    for gc, path in sorted(files.items()):
        size = path.stat().st_size
        if size > BUNDLE_MAX_BYTES:
            report.fail(f"bundle {gc}.json is {size} bytes (limit {BUNDLE_MAX_BYTES})")
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report.fail(f"bundle {gc}.json is not valid JSON")
            continue
        if doc.get("glottocode") != gc:
            report.fail(f"bundle {gc}.json has glottocode {doc.get('glottocode')}")
        for section in ("names", "xrefs", "speakers", "territories"):
            block = doc.get(section)
            if block is None:
                report.fail(f"bundle {gc}.json: missing section {section}")
                continue
            if section == "territories":
                for tb in block:
                    if not all(
                        tb.get(c) for c in ("source_id", "retrieved_at", "confidence", "locator_template")
                    ):
                        report.fail(f"bundle {gc}.json territories: block lacks provenance")
                    if tb.get("source_id") not in doc.get("sources", {}):
                        report.fail(
                            f"bundle {gc}.json territories: source {tb.get('source_id')} not in bundle sources"
                        )
                continue
            rows = block["items"] if section == "names" else block
            for row in rows:
                for col in ("source_id", "locator", "retrieved_at", "confidence"):
                    if not row.get(col):
                        report.fail(f"bundle {gc}.json {section}: missing {col}")
                        break
                if row.get("source_id") not in doc.get("sources", {}):
                    report.fail(
                        f"bundle {gc}.json {section}: source {row.get('source_id')} not in bundle sources"
                    )
                    break
        for sid in doc.get("sources", {}):
            if sid not in licenses:
                report.fail(f"bundle {gc}.json: source {sid} not in LICENSES.yaml")


def _check_tree(build_dir: Path, tabs: dict[str, pl.DataFrame], report: Report) -> None:
    path = build_dir / "tree.json"
    if not path.exists():
        report.fail("missing tree.json")
        return
    doc = json.loads(path.read_text(encoding="utf-8"))
    nodes = doc["nodes"]
    if "languoids" in tabs:
        report.check(
            len(nodes) == tabs["languoids"].height,
            f"tree.json: {len(nodes)} nodes for {tabs['languoids'].height} languoids",
        )
    for i, node in enumerate(nodes):
        parent = node[1]
        if parent != -1 and not (0 <= parent < len(nodes) and parent != i):
            report.fail(f"tree.json: node {i} has invalid parent index {parent}")
            break
    for node in nodes:
        for src_idx in (node[6], node[8]):
            if src_idx is not None and not (0 <= src_idx < len(doc["sources"])):
                report.fail(f"tree.json: node {node[0]} has invalid source index")
                return


def _check_manifest(build_dir: Path, licenses: dict[str, dict], report: Report) -> None:
    path = build_dir / "manifest.json"
    if not path.exists():
        report.fail("missing manifest.json")
        return
    doc = json.loads(path.read_text(encoding="utf-8"))
    listed = set()
    for out in doc["outputs"]:
        listed.add(out["path"])
        file = build_dir / out["path"]
        if not file.exists():
            report.fail(f"manifest lists missing file {out['path']}")
        elif common.sha256_file(file) != out["sha256"]:
            report.fail(f"manifest checksum mismatch: {out['path']}")
        for sid in out["source_ids"]:
            if sid not in licenses:
                report.fail(f"manifest: {out['path']} cites source {sid} not in LICENSES.yaml")
    # derived/ holds indexes that scripts compute from pipeline outputs only (for now
    # scripts/build-territory-index.mjs). They add no facts and are not pipeline outputs, so they
    # are outside the manifest. Phase 1 moves the territory index into the pipeline.
    actual = {
        rel
        for p in build_dir.rglob("*")
        if p.is_file() and p.name != "manifest.json"
        if not (rel := p.relative_to(build_dir).as_posix()).startswith(DERIVED_DIR + "/")
    }
    report.check(
        actual == listed,
        f"manifest/disk mismatch: unlisted={sorted(actual - listed)[:5]} missing={sorted(listed - actual)[:5]}",
    )
    for notice in ("NOTICE.md", "coverage.md"):
        report.check((build_dir / notice).exists(), f"missing {notice}")


def _check_geo(build_dir: Path, tabs: dict[str, pl.DataFrame], report: Report) -> None:
    for name in (
        "countries_110m.geojson",
        "countries_50m.geojson",
        "disputed_areas_50m.geojson",
        "languages.geojson",
    ):
        path = build_dir / "geo" / name
        if not path.exists():
            report.fail(f"missing geo/{name}")
            continue
        doc = json.loads(path.read_text(encoding="utf-8"))
        report.check(
            doc.get("type") == "FeatureCollection" and bool(doc.get("features")),
            f"geo/{name}: empty or not a FeatureCollection",
        )
        report.check(
            bool(doc.get("source_id")) and bool(doc.get("license")),
            f"geo/{name}: missing source_id or license",
        )
        if name == "languages.geojson" and "languoids" in tabs:
            expected = (
                tabs["languoids"]
                .filter(pl.col("latitude").is_not_null() & pl.col("longitude").is_not_null())
                .height
            )
            report.check(
                len(doc["features"]) == expected,
                f"geo/{name}: {len(doc['features'])} points for {expected} coordinates",
            )


def validate(build_dir: Path, licenses_path: Path = common.LICENSES_PATH) -> list[str]:
    report = Report()
    licenses = common.load_licenses(licenses_path)
    tabs = _read_tables(build_dir, report)
    _check_provenance(tabs, licenses, report)
    _check_keys(tabs, report)
    _check_speakers(tabs, report)
    _check_bundles(build_dir, tabs, licenses, report)
    _check_tree(build_dir, tabs, report)
    _check_geo(build_dir, tabs, report)
    _check_manifest(build_dir, licenses, report)
    return report.failures


def run(args: argparse.Namespace) -> int:
    build_dir = Path(getattr(args, "build_dir", None) or common.BUILD_DIR)
    licenses_path = Path(getattr(args, "licenses", None) or common.LICENSES_PATH)
    failures = validate(build_dir, licenses_path)
    if failures:
        print(f"validate: {len(failures)} failure(s) in {build_dir}")
        for f in failures:
            print(f"  FAIL {f}")
        return 1
    print(f"validate: OK ({build_dir})")
    return 0
