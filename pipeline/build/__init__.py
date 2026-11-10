"""`pipeline build`: normalize raw sources and write data/build/.

Deterministic by construction: sorted rows, fixed column order, no wall-clock timestamps
(retrieved_at is copied from data/raw/MANIFEST.yaml), single-threaded Parquet writes.
"""

from __future__ import annotations

import argparse
import shutil
from collections import Counter
from pathlib import Path

import polars as pl
import yaml

from pipeline import common, schemas
from pipeline.build import outputs, readers, search, tables

NOTICE_NAME = "NOTICE.md"
CLDR_NOTICE_NAME = "NOTICE-cldr-49-unicode-license.txt"
PILOT_ISO = (("eng", "English"), ("fas", "Persian (fas)"), ("pes", "Persian (pes)"), ("tur", "Turkish"))


SCOPE_PATH = common.ROOT / "content" / "scope" / "phase-1-languages.yaml"


def build(
    raw_dir: Path,
    build_dir: Path,
    licenses_path: Path = common.LICENSES_PATH,
    scope_path: Path = SCOPE_PATH,
) -> dict:
    licenses = common.load_licenses(licenses_path)
    for sid in (common.GLOTTOLOG, common.CLDR, common.WIKIDATA, common.NATURAL_EARTH):
        common.require_cleared(licenses, sid)

    gl_raw = readers.open_raw(raw_dir, common.GLOTTOLOG)
    cldr_raw = readers.open_raw(raw_dir, common.CLDR)
    wd_raw = readers.open_raw(raw_dir, common.WIKIDATA)
    ne_raw = readers.open_raw(raw_dir, common.NATURAL_EARTH)

    zips = sorted(gl_raw.directory.glob("*.zip"))
    gl_retrieved = gl_raw.retrieved_at(zips[0].name) if zips else min(gl_raw.retrieved.values())
    gl = readers.read_glottolog(gl_raw)
    known = {lang["glottocode"] for lang in gl.languages}

    wd_langs = readers.read_wikidata_languoids(wd_raw)
    wd_deprecated = readers.read_wikidata_deprecated_p1394(wd_raw)
    levels = {lang["glottocode"]: lang["level"] for lang in gl.languages}
    lang_by_iso: dict[str, list[str]] = {}
    for lang in gl.languages:
        # Retired nodes stay in this map so resolve_wikidata can report them; it never attaches to them.
        if lang["level"] == "language" and lang["iso"]:
            lang_by_iso.setdefault(lang["iso"], []).append(lang["glottocode"])
    unique_qid, candidates, by_gc, wd_unknown_gc, wd_report = tables.resolve_wikidata(
        wd_langs, known, levels, lang_by_iso, gl.retired, wd_deprecated
    )

    languoid_rows = tables.build_languoids(gl, gl_retrieved, licenses, unique_qid)

    cldr_names = {loc: readers.read_cldr_language_names(cldr_raw, loc) for loc in ("en", "fa", "tr")}
    xref_rows, name_rows, iso3_map, iso1_map = tables.build_xrefs_and_names(
        languoid_rows, gl, gl_retrieved, by_gc, cldr_names, licenses
    )

    territory_info, terr_retrieved = readers.read_cldr_territories(cldr_raw)
    territory_rows, unmapped_territory = tables.build_territories(
        territory_info, terr_retrieved, iso3_map, iso1_map, licenses
    )

    ambiguous = {gc for gc, q in candidates.items() if len(q) > 1}
    statements = readers.read_wikidata_speakers(wd_raw)
    speaker_rows, speaker_skipped = tables.build_speakers(
        statements, ambiguous, known - set(gl.retired), licenses, by_gc
    )

    source_rows = []
    for sid in sorted(licenses):
        if sid not in (common.GLOTTOLOG, common.CLDR, common.WIKIDATA, common.NATURAL_EARTH):
            continue
        entry = licenses[sid]
        raw = {
            common.GLOTTOLOG: gl_raw,
            common.CLDR: cldr_raw,
            common.WIKIDATA: wd_raw,
            common.NATURAL_EARTH: ne_raw,
        }[sid]
        source_rows.append(
            {
                "source_id": sid,
                "name": entry["name"],
                "version": entry["version"],
                "url": entry["url"],
                "doi": entry["doi"],
                "license": entry["license"],
                "license_url": entry["license_url"],
                "attribution": " ".join(str(entry["attribution"]).split()),
                "share_alike": entry["share_alike"],
                "non_commercial": entry["non_commercial"],
                "no_derivatives": entry["no_derivatives"],
                "status": entry["status"],
                "retrieved_at": min(raw.retrieved.values()) if raw.retrieved else None,
            }
        )

    tabs = {
        "languoids": tables.frame("languoids", languoid_rows, ["glottocode"]),
        "names": tables.frame(
            "names", name_rows, ["glottocode", "name", "lang", "type", "source_id", "locator"]
        ),
        "xrefs": tables.frame("xrefs", xref_rows, ["glottocode", "scheme", "code", "source_id", "locator"]),
        "speakers": tables.frame("speakers", speaker_rows, ["glottocode", "speaker_id"]),
        "territories": tables.frame("territories", territory_rows, ["glottocode", "iso3166", "cldr_code"]),
        "sources": tables.frame("sources", source_rows, ["source_id"]),
    }
    for name, df in tabs.items():
        schemas.TABLES[name].validate(df, lazy=True)

    # Start clean so stale files never survive a rebuild.
    if build_dir.exists():
        for child in build_dir.iterdir():
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
    build_dir.mkdir(parents=True, exist_ok=True)
    for name, df in tabs.items():
        outputs.write_parquet(df, build_dir / f"{name}.parquet")

    bundle_count, bundle_max = outputs.build_bundles(build_dir, tabs, licenses)
    tree_bytes = outputs.build_tree(build_dir, tabs)
    geo_counts = outputs.build_geo(build_dir, ne_raw, tabs, licenses)
    territory_count = outputs.build_territory_index(build_dir, tabs, licenses)
    territory_names = {loc: readers.read_cldr_territory_names(cldr_raw, loc) for loc in ("en", "fa", "tr")}
    search_stats = search.build_search(build_dir, tabs, territory_names, cldr_names, scope_path, licenses)

    unmapped = unmapped_cldr(cldr_names, territory_info, iso3_map, iso1_map)
    stats = {
        "bundle_count": bundle_count,
        "bundle_max_bytes": bundle_max,
        "tree_bytes": tree_bytes,
        "geo": geo_counts,
        "territory_index_territories": territory_count,
        "search": search_stats,
        "wikidata_report": wd_report,
        "wikidata_glottocodes_not_in_glottolog": wd_unknown_gc,
        "wikidata_ambiguous_glottocodes": sorted(ambiguous),
        "speaker_statements_skipped": speaker_skipped,
        "unmapped_cldr": unmapped,
        "territory_unmapped_rows": len(unmapped_territory),
    }
    (build_dir / "coverage.md").write_text(
        coverage_report(tabs, stats, iso3_map), encoding="utf-8", newline="\n"
    )
    write_notice(build_dir, licenses, cldr_raw)
    write_manifest(build_dir, raw_dir, licenses, (gl_raw, cldr_raw, wd_raw, ne_raw))
    printable = {k: v for k, v in stats.items() if k != "wikidata_report"}
    printable["wikidata_report"] = {k: len(v) for k, v in wd_report.items() if k != "qid_targets"}
    printable["retired_nodes_in_glottolog"] = len(gl.retired)
    return {"tables": {k: v.height for k, v in tabs.items()}, **printable}


def unmapped_cldr(
    cldr_names: dict, territory_info: dict, iso3_map: dict, iso1_map: dict
) -> dict[str, list[str]]:
    """CLDR language codes that could not be tied to exactly one Glottocode, by reason."""
    seen: dict[str, str] = {}
    for table, _ in cldr_names.values():
        for key in table:
            base = key.split("-alt-")[0]
            if "-" in base:
                seen.setdefault(base, "region-or-script variant (not a languoid)")
            elif not tables.resolve_cldr(base, iso3_map, iso1_map):
                seen.setdefault(base, "no unique ISO match to a language-level languoid")
    for info in territory_info.values():
        for code in info.get("languagePopulation", {}):
            if not tables.resolve_cldr(code, iso3_map, iso1_map):
                seen.setdefault(
                    code,
                    "script-qualified code"
                    if "_" in code
                    else "no unique ISO match to a language-level languoid",
                )
    by_reason: dict[str, list[str]] = {}
    for code, reason in sorted(seen.items()):
        by_reason.setdefault(reason, []).append(code)
    return by_reason


def wikidata_report_lines(report: dict, names: dict[str, str]) -> list[str]:
    def label(gc: str) -> str:
        return f"{gc} ({names.get(gc, 'retired or unknown')})"

    lines = [
        f"### QIDs found on more than one node, kept on the language-level node ({len(report['qid_conflicts'])})",
        "",
    ]
    for c in report["qid_conflicts"]:
        lines.append(
            f"- {c['qid']}: kept on {', '.join(label(g) for g in c['kept'])}; "
            f"dropped from {', '.join(label(g) for g in c['dropped'])}"
        )
    lines += [
        "",
        f"### Attached by ISO 639-3 match ({len(report['iso_matches'])})",
        "",
        "Each item may cover more than its node. Its speaker rows are low confidence, carry "
        "`attached_via = wikidata_iso_match` and are left out of tree.json sizing; its labels are aliases.",
        "",
    ]
    for m in report["iso_matches"]:
        lines.append(
            f"- {m['qid']} ({', '.join(m['iso639_3'])}): P1394 {', '.join(label(g) for g in m['p1394'])}"
            f" -> {label(m['target'])}"
        )
    lines += [
        "",
        f"### ISO match lost to a direct P1394 item on the same node ({len(report['iso_demoted'])})",
        "",
    ]
    for d in report["iso_demoted"]:
        lines.append(f"- {d['qid']} on {label(d['node'])}: node keeps {', '.join(d['winner'])}")
    lines += [
        "",
        f"### Items left unattached because their only route was a retired node ({len(report['retired_skipped'])})",
        "",
        "Retired and bookkeeping languoids are marked by Glottolog's category `Bookkeeping`; the CLDF has no "
        "replacement field, so none was used.",
        "",
    ]
    for r in report["retired_skipped"]:
        via = [f"P1394 {label(g)}" for g in r["retired_p1394"]] + [
            f"ISO {', '.join(r['iso639_3'])} -> {label(g)}" for g in r["retired_iso_hits"]
        ]
        lines.append(f"- {r['qid']}: {'; '.join(via)}")
    lines += [
        "",
        f"### Items attached to a replacement of a retired node ({len(report['retired_replaced'])})",
        "",
    ]
    for r in report["retired_replaced"]:
        lines.append(
            f"- {r['qid']}: {', '.join(label(g) for g in r['retired'])} -> {', '.join(label(g) for g in r['target'])}"
        )
    lines += [
        "",
        f"### Chosen node is a deprecated P1394 value on Wikidata ({len(report['deprecated_p1394'])})",
        "",
    ]
    for d in report["deprecated_p1394"]:
        why = f" ({', '.join(d['reasons'])})" if d["reasons"] else ""
        lines.append(f"- {d['qid']} on {label(d['node'])}{why}")
    lines += [
        "",
        f"### Language items left on a family as Wikidata's claim ({len(report['via_family'])})",
        "",
    ]
    for v in report["via_family"]:
        lines.append(
            f"- {v['qid']} ({', '.join(v['iso639_3'])}) on {', '.join(label(g) for g in v['nodes'])}"
        )
    lines.append("")
    return lines


def coverage_report(tabs: dict[str, pl.DataFrame], stats: dict, iso3_map: dict) -> str:
    by_gc_names = {
        r["glottocode"]: r["name"] for r in tabs["languoids"].select("glottocode", "name").to_dicts()
    }
    lang = tabs["languoids"]
    spk = tabs["speakers"]
    terr = tabs["territories"]
    names = tabs["names"]
    lines = ["# Coverage report", "", "Generated by `pipeline build`. Do not edit.", ""]

    lines += [
        "## Languoids by level",
        "",
        "| Level | Count | With coordinates | With ISO 639-3 | With Wikidata QID |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for level in schemas.LEVELS:
        sub = lang.filter(pl.col("level") == level)
        lines.append(
            f"| {level} | {sub.height} | {sub.filter(pl.col('latitude').is_not_null()).height} | "
            f"{sub.filter(pl.col('iso639_3').is_not_null()).height} | {sub.filter(pl.col('wikidata_qid').is_not_null()).height} |"
        )
    lines.append(
        f"| all | {lang.height} | {lang.filter(pl.col('latitude').is_not_null()).height} | "
        f"{lang.filter(pl.col('iso639_3').is_not_null()).height} | {lang.filter(pl.col('wikidata_qid').is_not_null()).height} |"
    )
    lines += [
        "",
        f"Languoids with no parent (roots: top-level families and isolates): {lang.filter(pl.col('parent_glottocode').is_null()).height}.",
        "",
    ]

    lines += ["## Speaker figures (Wikidata P1098, one row per statement, never merged)", ""]
    with_ref = spk.filter(pl.col("has_reference")).height
    lines += [
        f"- Statements: {spk.height}",
        f"- With at least one reference: {with_ref}",
        f"- Without a reference: {spk.height - with_ref}",
        f"- Deprecated rank: {spk.filter(pl.col('rank') == 'deprecated').height}",
        f"- Languoids with at least one figure: {spk['glottocode'].n_unique()}",
        f"- Languoids with an L1 figure: {spk.filter(pl.col('kind') == 'L1')['glottocode'].n_unique()}",
        f"- Languoids with a dated figure: {spk.filter(pl.col('year').is_not_null())['glottocode'].n_unique()}",
        f"- Languoids whose figures spread more than 25 percent: {spk.filter(pl.col('disagrees_gt_25pct'))['glottocode'].n_unique()}",
        f"- Statements skipped (Glottocode not in Glottolog, or non-numeric value): {stats['speaker_statements_skipped']}",
        "",
        "| Kind | Statements |",
        "| --- | ---: |",
    ]
    for kind in schemas.SPEAKER_KINDS:
        lines.append(f"| {kind} | {spk.filter(pl.col('kind') == kind).height} |")
    lines += [
        "",
        f"Languoids with no speaker figure: {lang.height - spk['glottocode'].n_unique()} of {lang.height}.",
        "",
    ]

    lines += ["## Territory data (CLDR territoryInfo)", ""]
    lines += [
        f"- Rows: {terr.height}",
        f"- Languoids with territory rows: {terr['glottocode'].n_unique()}",
        f"- Countries or regions: {terr['iso3166'].n_unique()}",
        f"- Rows with an official status: {terr.filter(pl.col('official_status').is_not_null()).height}",
        f"- Rows with a year: {terr.filter(pl.col('year').is_not_null()).height} (CLDR does not date its estimates)",
        f"- CLDR (territory, code) rows left out because the code did not map: {stats['territory_unmapped_rows']}",
        "",
    ]

    lines += ["## Names", "", "| Locale | Languoids with a name | Name rows |", "| --- | ---: | ---: |"]
    for loc in ("en", "fa", "tr"):
        sub = names.filter(pl.col("lang") == loc)
        lines.append(f"| {loc} | {sub['glottocode'].n_unique()} | {sub.height} |")
    lines.append(f"| all locales | {names['glottocode'].n_unique()} | {names.height} |")
    lines += ["", "By source:", "", "| Source | Rows |", "| --- | ---: |"]
    for sid, count in sorted(Counter(names["source_id"].to_list()).items()):
        lines.append(f"| {sid} | {count} |")
    lines += [
        "",
        "Names whose type is endonym: " + str(names.filter(pl.col("type") == "endonym").height) + ".",
        "",
    ]

    lines += [
        "## Not yet ingested",
        "",
        "Phase 0 has no audio, no speaker-area polygons, no IPA and no word forms. Every languoid lacks them:",
        "",
        f"- Audio: {lang.height} of {lang.height} lack it",
        f"- Polygons (speaker areas): {lang.height} of {lang.height} lack them",
        f"- IPA: {lang.height} of {lang.height} lack it",
        "",
    ]

    lines += ["## Unmapped CLDR codes", ""]
    total = sum(len(v) for v in stats["unmapped_cldr"].values())
    lines.append(f"Distinct CLDR language codes not tied to a Glottocode: {total}. Nothing was guessed.")
    lines.append("")
    for reason, codes in stats["unmapped_cldr"].items():
        lines += [f"### {reason} ({len(codes)})", "", ", ".join(codes), ""]

    lines += [
        "## Wikidata linkage",
        "",
        f"- Wikidata Glottocodes not present in Glottolog 5.3: {stats['wikidata_glottocodes_not_in_glottolog']}",
        f"- Glottocodes claimed by more than one Wikidata item (QID left null, xrefs marked contested): {len(stats['wikidata_ambiguous_glottocodes'])}",
        "",
    ]

    lines += [
        "## Wikidata attachment rules",
        "",
        "Wikidata items are attached to Glottolog nodes through P1394. Three rules keep Wikidata from "
        "overriding Glottolog (see `resolve_wikidata`):",
        "",
        "1. A QID sits on one node. When an item names a language-level node and its family, the "
        "language-level node keeps it.",
        "2. When no P1394 node is language-level (unknown Glottocode, or the language's parent), "
        "a unique ISO 639-3 match to a live language-level node is used (method `ISO match`). The item may "
        "be broader than the node: its speaker rows are low confidence, carry `attached_via = "
        'wikidata_iso_match` and the note "Wikidata item may cover more than this Glottolog node", '
        "its labels are aliases, and tree.json sizing ignores them.",
        "3. A language item attached to a family stays there as Wikidata's claim: `languoids.wikidata_qid` "
        "is left null, its labels are aliases, its speaker rows carry `attached_via = "
        "wikidata_p1394_to_family`, and the tree ignores them.",
        "4. A direct P1394 attachment always wins over an ISO match on the same node. The loser stays in "
        "xrefs (low confidence, with a note); its speaker rows are kept, flagged and never used for sizing.",
        "5. Retired and bookkeeping nodes (Glottolog category `Bookkeeping`) never receive an item. A "
        "recorded replacement would be used (method `replacement of retired node`); otherwise the item "
        "stays unattached and is listed below.",
        "",
        *wikidata_report_lines(stats["wikidata_report"], by_gc_names),
        "## Pilot languages",
        "",
        "| ISO 639-3 | Glottocodes | Name | Speaker rows | Territory rows |",
        "| --- | --- | --- | ---: | ---: |",
    ]
    by_gc = {r["glottocode"]: r for r in lang.select("glottocode", "name").to_dicts()}
    for iso, label in PILOT_ISO:
        gcs = iso3_map.get(iso, [])
        if not gcs:
            lines.append(f"| {iso} | none in Glottolog 5.3 | ({label}) | 0 | 0 |")
        for gc in gcs:
            lines.append(
                f"| {iso} | {gc} | {by_gc[gc]['name']} | {spk.filter(pl.col('glottocode') == gc).height} | "
                f"{terr.filter(pl.col('glottocode') == gc).height} |"
            )
    lines += [
        "",
        "## Outputs",
        "",
        f"- Bundles: {stats['bundle_count']}, largest {stats['bundle_max_bytes']} bytes (limit {outputs.BUNDLE_MAX_BYTES})",
        f"- tree.json: {stats['tree_bytes']} bytes",
        f"- territory_index.json: {stats['territory_index_territories']} territories",
        "- search: " + ", ".join(f"{k}={v}" for k, v in sorted(stats["search"].items())),
        "- Geo features: " + ", ".join(f"{k}={v}" for k, v in sorted(stats["geo"].items())),
        "",
    ]
    return "\n".join(lines)


def write_notice(build_dir: Path, licenses: dict[str, dict], cldr_raw: readers.RawSet) -> None:
    """Attribution for every source whose data is in data/build/, plus the verbatim Unicode license text."""
    lines = [
        "# Notices for data/build/",
        "",
        "Files here are derived from the sources below. Rows keep their own `source_id` and `license`.",
        "Changes were made: tables are normalized, re-keyed by Glottocode and re-encoded.",
        "",
    ]
    for sid in (common.GLOTTOLOG, common.CLDR, common.WIKIDATA, common.NATURAL_EARTH):
        e = licenses[sid]
        lines += [
            f"## {e['name']} (`{sid}`)",
            "",
            f"- License: {e['license']} ({e['license_url']})",
            f"- Version: {e['version']}",
            f"- Attribution: {' '.join(str(e['attribution']).split())}",
            "",
        ]
    lines += [f"The full Unicode License v3 text for CLDR data is in `{CLDR_NOTICE_NAME}`.", ""]
    (build_dir / NOTICE_NAME).write_text("\n".join(lines), encoding="utf-8", newline="\n")
    license_file = cldr_raw.path("LICENSE")
    if not license_file.exists():
        raise SystemExit("STOP: CLDR LICENSE missing in raw data; run `pipeline fetch --only cldr-49`.")
    (build_dir / CLDR_NOTICE_NAME).write_text(
        license_file.read_text(encoding="utf-8"), encoding="utf-8", newline="\n"
    )


# Output file -> source ids whose data it contains (for the manifest license list).
def _sources_of(rel: str) -> list[str]:
    if rel.startswith("geo/languages"):
        return [common.GLOTTOLOG]
    if rel.startswith("geo/"):
        return [common.NATURAL_EARTH]
    if rel in ("sources.parquet",):
        return sorted([common.GLOTTOLOG, common.CLDR, common.WIKIDATA, common.NATURAL_EARTH])
    if rel in ("territories.parquet",):
        return [common.CLDR]
    if rel in ("speakers.parquet",):
        return [common.WIKIDATA]
    if (
        rel == "names.parquet"
        or rel.startswith("bundles/")
        or rel in ("languoids.parquet", "xrefs.parquet", "tree.json")
    ):
        return sorted([common.GLOTTOLOG, common.CLDR, common.WIKIDATA])
    if rel == "territory_index.json":
        return [common.CLDR]
    if rel.startswith("search/"):
        return sorted([common.GLOTTOLOG, common.CLDR, common.WIKIDATA])
    if rel == CLDR_NOTICE_NAME:
        return [common.CLDR]
    return []


def write_manifest(
    build_dir: Path, raw_dir: Path, licenses: dict[str, dict], raws: tuple[readers.RawSet, ...]
) -> None:
    manifest = common.read_manifest(raw_dir / "MANIFEST.yaml")
    inputs = []
    for raw in raws:
        prefix = f"{raw.source_id}/{raw.directory.name}/"
        files = [
            {
                "path": f["path"],
                "sha256": f["sha256"],
                "bytes": f["bytes"],
                "retrieved_at": f["retrieved_at"],
                "url": f["url"],
            }
            for f in manifest.get("files", [])
            if f["path"].startswith(prefix)
        ]
        e = licenses[raw.source_id]
        inputs.append(
            {
                "source_id": raw.source_id,
                "version": e["version"],
                "doi": e["doi"],
                "license": e["license"],
                "files": sorted(files, key=lambda f: f["path"]),
            }
        )
    outs = []
    for path in sorted(p for p in build_dir.rglob("*") if p.is_file() and p.name != "manifest.json"):
        rel = path.relative_to(build_dir).as_posix()
        srcs = _sources_of(rel)
        outs.append(
            {
                "path": rel,
                "sha256": common.sha256_file(path),
                "bytes": path.stat().st_size,
                "source_ids": srcs,
                "licenses": sorted({licenses[s]["license"] for s in srcs}),
            }
        )
    doc = {
        "schema_version": 1,
        "inputs": sorted(inputs, key=lambda i: i["source_id"]),
        "licenses": {
            sid: {
                k: licenses[sid][k]
                for k in (
                    "license",
                    "license_url",
                    "version",
                    "share_alike",
                    "non_commercial",
                    "no_derivatives",
                )
            }
            for sid in sorted(raw.source_id for raw in raws)
        },
        "outputs": outs,
    }
    outputs.dump_json(doc, build_dir / "manifest.json")


def run(args: argparse.Namespace) -> int:
    raw_dir = Path(getattr(args, "raw_dir", None) or common.RAW_DIR)
    build_dir = Path(getattr(args, "build_dir", None) or common.BUILD_DIR)
    scope_path = Path(getattr(args, "scope", None) or SCOPE_PATH)
    result = build(raw_dir, build_dir, scope_path=scope_path)
    print(yaml.safe_dump(result, sort_keys=True, allow_unicode=True, width=120))
    print(f"wrote {build_dir}")
    return 0
