"""Writers for data/build/: Parquet, bundles, tree.json, geo, coverage, manifest. All deterministic."""

from __future__ import annotations

import json
import shutil
from collections import defaultdict
from pathlib import Path

import polars as pl
import pyarrow.parquet as pq

from pipeline import common
from pipeline.build import readers

BUNDLE_MAX_BYTES = 50 * 1024
LEVEL_CODE = {"family": 0, "language": 1, "dialect": 2}
PRIORITY_LANGS = ("en", "fa", "tr")


def dump_json(obj: object, path: Path, *, indent: int | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(
        obj,
        ensure_ascii=False,
        sort_keys=True,
        indent=indent,
        separators=(",", ":") if indent is None else None,
    )
    path.write_text(text + "\n", encoding="utf-8", newline="\n")


def write_parquet(df: pl.DataFrame, path: Path) -> None:
    """Identical input gives identical bytes: single thread, fixed codec, no statistics timestamps."""
    path.parent.mkdir(parents=True, exist_ok=True)
    pq.write_table(
        df.to_arrow(),
        path,
        compression="zstd",
        compression_level=9,
        use_dictionary=True,
        write_statistics=True,
        row_group_size=100_000,
        data_page_version="2.0",
    )


# --------------------------------------------------------------------------- bundles

TERRITORY_LOCATOR = "cldr-core/supplemental/territoryInfo.json#/supplemental/territoryInfo/{iso3166}/languagePopulation/{cldr_code}"


def territory_blocks(rows: list[dict]) -> list[dict]:
    """Group territory rows that share provenance so the long locator is written once as a template.

    Each item's locator is `locator_template` formatted with the item's own iso3166 and cldr_code;
    a row whose locator does not fit the template keeps an explicit `locator` instead.
    """
    groups: dict[tuple, list[dict]] = defaultdict(list)
    for t in rows:
        groups[(t["source_id"], t["retrieved_at"], t["confidence"], t["notes"])].append(t)
    blocks = []
    for (source_id, retrieved_at, confidence, notes), members in sorted(
        groups.items(), key=lambda kv: str(kv[0])
    ):
        items = []
        for t in members:
            item = {
                "iso3166": t["iso3166"],
                "cldr_code": t["cldr_code"],
                "population_share": t["population_share"],
                "official_status": t["official_status"],
                "year": t["year"],
            }
            if t["locator"] != TERRITORY_LOCATOR.format(iso3166=t["iso3166"], cldr_code=t["cldr_code"]):
                item["locator"] = t["locator"]
            items.append(item)
        block = {
            "source_id": source_id,
            "retrieved_at": retrieved_at,
            "confidence": confidence,
            "locator_template": TERRITORY_LOCATOR,
            "items": items,
        }
        if notes:
            block["notes"] = notes
        blocks.append(block)
    return blocks


def build_bundles(
    build_dir: Path, tabs: dict[str, pl.DataFrame], licenses: dict[str, dict]
) -> tuple[int, int]:
    """Write one JSON bundle per glottocode. Returns (count, max bytes)."""
    out = build_dir / "bundles"
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    languoids = {r["glottocode"]: r for r in tabs["languoids"].to_dicts()}
    children: dict[str, list[str]] = defaultdict(list)
    for gc, r in languoids.items():
        if r["parent_glottocode"]:
            children[r["parent_glottocode"]].append(gc)

    def group(table: str) -> dict[str, list[dict]]:
        g: dict[str, list[dict]] = defaultdict(list)
        for r in tabs[table].to_dicts():
            g[r["glottocode"]].append(r)
        return g

    names, xrefs, speakers, territories = (
        group("names"),
        group("xrefs"),
        group("speakers"),
        group("territories"),
    )
    source_rank = {common.CLDR: 0, common.WIKIDATA: 1, common.GLOTTOLOG: 2}

    def prov(r: dict) -> dict:
        out = {
            "source_id": r["source_id"],
            "locator": r["locator"],
            "retrieved_at": r["retrieved_at"],
            "confidence": r["confidence"],
        }
        if r["notes"]:
            out["notes"] = r["notes"]
        return out

    max_bytes = 0
    for gc in sorted(languoids):
        r = languoids[gc]
        lineage = []
        cur = r["parent_glottocode"]
        seen = set()
        while cur and cur not in seen and cur in languoids:
            seen.add(cur)
            lineage.append(
                {"glottocode": cur, "name": languoids[cur]["name"], "level": languoids[cur]["level"]}
            )
            cur = languoids[cur]["parent_glottocode"]
        lineage.reverse()
        kids = sorted(children.get(gc, []), key=lambda c: (languoids[c]["name"], c))

        def make(name_cap: int, kid_cap: int) -> dict:
            nm = sorted(
                names.get(gc, []),
                key=lambda n: (
                    0 if n["lang"] in PRIORITY_LANGS else 1,
                    source_rank.get(n["source_id"], 9),
                    n["lang"] or "",
                    n["name"],
                    n["locator"],
                ),
            )
            used = {r["source_id"]}
            sp = speakers.get(gc, [])
            tr = territories.get(gc, [])
            xr = xrefs.get(gc, [])
            for rows in (sp, tr, xr, nm[:name_cap]):
                used.update(x["source_id"] for x in rows)
            return {
                "schema": 1,
                "glottocode": gc,
                "languoid": {
                    "name": r["name"],
                    "level": r["level"],
                    "parent_glottocode": r["parent_glottocode"],
                    "iso639_3": r["iso639_3"],
                    "wikidata_qid": r["wikidata_qid"],
                    "macroarea": r["macroarea"],
                    "latitude": r["latitude"],
                    "longitude": r["longitude"],
                    "endangerment": r["endangerment"],
                    "is_isolate": r["is_isolate"],
                    "category": r["category"],
                    **prov(r),
                },
                "lineage": lineage,
                "children": {
                    "total": len(kids),
                    "items": [[c, languoids[c]["name"], languoids[c]["level"]] for c in kids[:kid_cap]],
                },
                "names": {
                    "total": len(nm),
                    "items": [
                        {
                            "name": n["name"],
                            "lang": n["lang"],
                            "script": n["script"],
                            "type": n["type"],
                            **prov(n),
                        }
                        for n in nm[:name_cap]
                    ],
                },
                "xrefs": [{"scheme": x["scheme"], "code": x["code"], **prov(x)} for x in xr],
                "speakers": [
                    {
                        "kind": s["kind"],
                        "value": s["value"],
                        "year": s["year"],
                        "method": s["method"],
                        "part": s["part"],
                        "rank": s["rank"],
                        "references": json.loads(s["references"]),
                        "disagrees_gt_25pct": s["disagrees_gt_25pct"],
                        "attached_via": s["attached_via"],
                        **prov(s),
                    }
                    for s in sp
                ],
                "territories": territory_blocks(tr),
                "sources": {
                    sid: {
                        "license": licenses[sid]["license"],
                        "attribution": " ".join(str(licenses[sid]["attribution"]).split()),
                        "url": licenses[sid]["url"],
                        "version": licenses[sid]["version"],
                    }
                    for sid in sorted(used)
                },
            }

        for name_cap, kid_cap in ((40, 60), (20, 30), (10, 15), (4, 5)):
            bundle = make(name_cap, kid_cap)
            data = json.dumps(bundle, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
            size = len(data.encode("utf-8"))
            if size <= BUNDLE_MAX_BYTES:
                break
        if size > BUNDLE_MAX_BYTES:
            raise SystemExit(f"STOP: bundle {gc} is {size} bytes even after trimming names and children")
        (out / f"{gc}.json").write_text(data, encoding="utf-8", newline="\n")
        max_bytes = max(max_bytes, size)
    return len(languoids), max_bytes


# --------------------------------------------------------------------------- tree


TREE_FORMAT = (
    "nodes is an array of tuples ordered by glottocode; the array index is the node id. "
    "Tuple layout is given by columns: [glottocode, parent_index (-1 = root), level (0 family, 1 language, "
    "2 dialect), name, child_count, l1_max, l1_source_index, any_max, any_source_index]. "
    "l1_max is the largest non-deprecated speaker figure whose kind is L1 (null if none); any_max is the largest "
    "non-deprecated figure of any kind, including kind 'unknown' (null if none). Figures that Wikidata "
    "attaches to a family through a language item, or that reach a node only by ISO 639-3 match, because the "
    "Wikidata item may be broader than the node (speakers.attached_via), are left out. Neither is averaged or "
    "merged; each points into `sources` by index (null if the figure is null). Figures are source claims, "
    "not facts: open the bundle for source, year and every competing figure."
)


def build_tree(build_dir: Path, tabs: dict[str, pl.DataFrame]) -> int:
    langs = tabs["languoids"].select("glottocode", "parent_glottocode", "level", "name").to_dicts()
    index = {r["glottocode"]: i for i, r in enumerate(langs)}
    child_count = [0] * len(langs)
    for r in langs:
        p = r["parent_glottocode"]
        if p in index:
            child_count[index[p]] += 1
    best_l1: dict[str, tuple[float, str]] = {}
    best_any: dict[str, tuple[float, str]] = {}
    # Figures that Wikidata attaches to a family through a language item, or that reached a node only by
    # ISO 639-3 match (the item may be broader than the node), are weaker claims; the tree never sizes
    # a node by them.
    figures = tabs["speakers"].filter((pl.col("rank") != "deprecated") & pl.col("attached_via").is_null())
    for s in figures.to_dicts():
        if s["value"] is None:
            continue
        for best, ok in ((best_any, True), (best_l1, s["kind"] == "L1")):
            if ok and (s["glottocode"] not in best or s["value"] > best[s["glottocode"]][0]):
                best[s["glottocode"]] = (s["value"], s["source_id"])
    sources = sorted({v[1] for v in list(best_l1.values()) + list(best_any.values())})
    sidx = {s: i for i, s in enumerate(sources)}

    def num(x: float) -> int | float:
        return int(x) if float(x).is_integer() else x

    nodes = []
    for i, r in enumerate(langs):
        gc = r["glottocode"]
        l1, an = best_l1.get(gc), best_any.get(gc)
        nodes.append(
            [
                gc,
                index.get(r["parent_glottocode"], -1) if r["parent_glottocode"] else -1,
                LEVEL_CODE[r["level"]],
                r["name"],
                child_count[i],
                num(l1[0]) if l1 else None,
                sidx[l1[1]] if l1 else None,
                num(an[0]) if an else None,
                sidx[an[1]] if an else None,
            ]
        )
    doc = {
        "format": TREE_FORMAT,
        "columns": [
            "glottocode",
            "parent_index",
            "level",
            "name",
            "child_count",
            "l1_max",
            "l1_source",
            "any_max",
            "any_source",
        ],
        "sources": sources,
        "nodes": nodes,
    }
    path = build_dir / "tree.json"
    dump_json(doc, path)
    return path.stat().st_size


# --------------------------------------------------------------------------- geo

COUNTRY_KEEP = {
    "ADM0_A3", "ISO_A3", "ISO_A3_EH", "ISO_A2", "ISO_A2_EH", "ISO_N3", "ISO_N3_EH", "UN_A3", "NAME", "NAME_LONG",
    "NAME_EN", "NAME_FA", "NAME_TR", "ADMIN", "SOVEREIGNT", "SOV_A3", "TYPE", "LEVEL", "FORMAL_EN", "BRK_A3",
    "BRK_NAME", "BRK_GROUP", "NOTE_ADM0", "NOTE_BRK", "WIKIDATAID", "NE_ID", "CONTINENT", "SUBREGION", "featurecla",
    "FCLASS_ISO", "FCLASS_TLC",
}  # fmt: skip
COUNTRY_PREFIXES = ("ADM0_A3_", "FCLASS_")  # per-viewpoint columns (US, FR, CN, IN, ...)


def _round_ring(ring: list, ndigits: int) -> list:
    out: list = []
    for x, y, *_ in ring:
        pt = [round(x, ndigits), round(y, ndigits)]
        if not out or out[-1] != pt:
            out.append(pt)
    return out


def _simplify_geometry(geom: dict | None, ndigits: int) -> dict | None:
    if not geom:
        return None
    if geom["type"] == "Polygon":
        rings = [r for r in (_round_ring(r, ndigits) for r in geom["coordinates"]) if len(r) >= 4]
        return {"type": "Polygon", "coordinates": rings} if rings else None
    if geom["type"] == "MultiPolygon":
        polys = []
        for poly in geom["coordinates"]:
            rings = [r for r in (_round_ring(r, ndigits) for r in poly) if len(r) >= 4]
            if rings:
                polys.append(rings)
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return geom


def _keep(key: str) -> bool:
    return key in COUNTRY_KEEP or key.startswith(COUNTRY_PREFIXES)


def build_geo(
    build_dir: Path, ne: readers.RawSet, tabs: dict[str, pl.DataFrame], licenses: dict[str, dict]
) -> dict[str, int]:
    geo = build_dir / "geo"
    geo.mkdir(parents=True, exist_ok=True)
    counts: dict[str, int] = {}
    ne_lic = licenses[common.NATURAL_EARTH]
    spec = (
        ("ne_110m_admin_0_countries.geojson", "countries_110m.geojson", 2),
        ("ne_50m_admin_0_countries.geojson", "countries_50m.geojson", 3),
        ("ne_50m_admin_0_breakaway_disputed_areas.geojson", "disputed_areas_50m.geojson", 3),
    )
    for src_name, out_name, ndigits in spec:
        raw = json.loads(ne.path(src_name).read_text(encoding="utf-8"))
        features = []
        for f in raw["features"]:
            geom = _simplify_geometry(f["geometry"], ndigits)
            if geom is None:
                continue
            props = {k: v for k, v in f["properties"].items() if _keep(k)}
            features.append({"type": "Feature", "properties": props, "geometry": geom})
        features.sort(
            key=lambda f: (
                str(f["properties"].get("ADM0_A3")),
                str(f["properties"].get("BRK_A3")),
                str(f["properties"].get("NE_ID")),
            )
        )
        doc = {
            "type": "FeatureCollection",
            "source_id": common.NATURAL_EARTH,
            "license": ne_lic["license"],
            "attribution": ne_lic["attribution"],
            "retrieved_at": ne.retrieved_at(src_name),
            "notes": (
                "Natural Earth draws de facto boundaries. Apply the project's neutral disputed-territory "
                "rendering on top. ADM0_A3_xx and FCLASS_xx columns carry per-viewpoint variants."
            ),
            "features": features,
        }
        dump_json(doc, geo / out_name)
        counts[out_name] = len(features)

    gl = licenses[common.GLOTTOLOG]
    pts = []
    for r in (
        tabs["languoids"]
        .filter(pl.col("latitude").is_not_null() & pl.col("longitude").is_not_null())
        .to_dicts()
    ):
        pts.append(
            {
                "type": "Feature",
                "properties": {"glottocode": r["glottocode"], "name": r["name"], "level": r["level"]},
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(r["longitude"], 3), round(r["latitude"], 3)],
                },
            }
        )
    doc = {
        "type": "FeatureCollection",
        "source_id": common.GLOTTOLOG,
        "license": gl["license"],
        "attribution": " ".join(str(gl["attribution"]).split()),
        "retrieved_at": tabs["languoids"]["retrieved_at"][0] if tabs["languoids"].height else None,
        "notes": "Glottolog representative coordinates (approximate points, not speaker areas). Rounded to 3 decimals.",
        "features": pts,
    }
    dump_json(doc, geo / "languages.geojson")
    counts["languages.geojson"] = len(pts)
    return counts


# --------------------------------------------------------------------------- territory index

TERRITORY_INDEX_FORMAT = (
    "territories[iso3166] is a list of [glottocode, population_share, official_status] sorted by share, "
    "descending (null shares last). Copied from the territories table (CLDR territoryInfo); nothing is "
    "averaged or merged. `provenance` applies to every row; the row's own locator is `locator_template` "
    "formatted with the territory code and the CLDR language code (see the bundle for the code)."
)


def build_territory_index(build_dir: Path, tabs: dict[str, pl.DataFrame], licenses: dict[str, dict]) -> int:
    """Reverse index from CLDR territory code to languoids. Returns the number of territories."""
    rows = tabs["territories"].to_dicts()
    groups = {(r["source_id"], r["retrieved_at"], r["confidence"], r["notes"], r["license"]) for r in rows}
    if len(groups) > 1:
        raise SystemExit(f"STOP: territory rows have {len(groups)} provenance groups; the index needs one")
    for r in rows:
        if r["locator"] != TERRITORY_LOCATOR.format(iso3166=r["iso3166"], cldr_code=r["cldr_code"]):
            raise SystemExit(f"STOP: territory locator does not fit the template: {r['locator']}")
    by_territory: dict[str, list[list]] = defaultdict(list)
    for r in rows:
        by_territory[r["iso3166"]].append([r["glottocode"], r["population_share"], r["official_status"]])
    territories = {
        code: sorted(items, key=lambda i: (i[1] is None, -(i[1] or 0), i[0]))
        for code, items in sorted(by_territory.items())
    }
    provenance = None
    if rows:
        source_id, retrieved_at, confidence, notes, license_ = next(iter(groups))
        provenance = {
            "source_id": source_id,
            "locator_template": TERRITORY_LOCATOR,
            "retrieved_at": retrieved_at,
            "confidence": confidence,
            "notes": notes,
            "license": license_,
        }
    dump_json(
        {"format": TERRITORY_INDEX_FORMAT, "provenance": provenance, "territories": territories},
        build_dir / "territory_index.json",
    )
    return len(territories)
