"""Table schemas for data/build/*.parquet (pandera, polars backend).

Every fact table carries the provenance columns in PROVENANCE. Unknown stays null.
The same schemas are used by `pipeline build` (to refuse writing bad data) and by
`pipeline validate` (to check what is on disk).
"""

from __future__ import annotations

import pandera.polars as pa
import polars as pl

from pipeline.common import CONFIDENCE, GLOTTOCODE_RE

GLOTTOCODE_PATTERN = GLOTTOCODE_RE.pattern
ISO_UTC_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
LEVELS = ("family", "language", "dialect")
NAME_TYPES = ("endonym", "exonym", "alias")
SPEAKER_KINDS = ("L1", "L2", "total", "unknown")
ATTACHED_VIA = ("wikidata_p1394_to_family", "wikidata_iso_match")
RANKS = ("preferred", "normal", "deprecated")
XREF_SCHEMES = ("iso639-3", "iso639-1", "wikidata", "cldr")


def _prov() -> dict[str, pa.Column]:
    return {
        "source_id": pa.Column(pl.String, nullable=False),
        "locator": pa.Column(pl.String, nullable=False),
        "retrieved_at": pa.Column(pl.String, pa.Check.str_matches(ISO_UTC_PATTERN), nullable=False),
        "license": pa.Column(pl.String, nullable=False),
        "confidence": pa.Column(pl.String, pa.Check.isin(CONFIDENCE), nullable=False),
        "notes": pa.Column(pl.String, nullable=True),
    }


PROVENANCE = tuple(_prov())

_GC = pa.Check.str_matches(GLOTTOCODE_PATTERN)

LANGUOIDS = pa.DataFrameSchema(
    {
        "glottocode": pa.Column(pl.String, _GC, nullable=False, unique=True),
        "level": pa.Column(pl.String, pa.Check.isin(LEVELS), nullable=False),
        "parent_glottocode": pa.Column(pl.String, _GC, nullable=True),
        "name": pa.Column(pl.String, nullable=False),
        "iso639_3": pa.Column(pl.String, pa.Check.str_matches(r"^[a-z]{3}$"), nullable=True),
        "wikidata_qid": pa.Column(pl.String, pa.Check.str_matches(r"^Q[0-9]+$"), nullable=True),
        "macroarea": pa.Column(pl.String, nullable=True),
        "latitude": pa.Column(pl.Float64, pa.Check.in_range(-90, 90), nullable=True),
        "longitude": pa.Column(pl.Float64, pa.Check.in_range(-180, 180), nullable=True),
        "endangerment": pa.Column(pl.String, nullable=True),
        "is_macrolanguage": pa.Column(pl.Boolean, nullable=True),
        "is_isolate": pa.Column(pl.Boolean, nullable=True),
        "category": pa.Column(pl.String, nullable=True),
        **_prov(),
    },
    strict=True,
    ordered=True,
)

NAMES = pa.DataFrameSchema(
    {
        "glottocode": pa.Column(pl.String, _GC, nullable=False),
        "name": pa.Column(pl.String, pa.Check.str_length(min_value=1), nullable=False),
        "lang": pa.Column(pl.String, nullable=True),
        "script": pa.Column(pl.String, pa.Check.str_matches(r"^[A-Z][a-z]{3}$"), nullable=True),
        "type": pa.Column(pl.String, pa.Check.isin(NAME_TYPES), nullable=False),
        **_prov(),
    },
    strict=True,
    ordered=True,
)

XREFS = pa.DataFrameSchema(
    {
        "glottocode": pa.Column(pl.String, _GC, nullable=False),
        "scheme": pa.Column(pl.String, pa.Check.isin(XREF_SCHEMES), nullable=False),
        "code": pa.Column(pl.String, nullable=False),
        **_prov(),
    },
    strict=True,
    ordered=True,
)

SPEAKERS = pa.DataFrameSchema(
    {
        "speaker_id": pa.Column(pl.String, nullable=False, unique=True),
        "glottocode": pa.Column(pl.String, _GC, nullable=False),
        "kind": pa.Column(pl.String, pa.Check.isin(SPEAKER_KINDS), nullable=False),
        "value": pa.Column(pl.Float64, pa.Check.ge(0), nullable=True),
        "value_low": pa.Column(pl.Float64, pa.Check.ge(0), nullable=True),
        "value_high": pa.Column(pl.Float64, pa.Check.ge(0), nullable=True),
        "year": pa.Column(pl.Int32, nullable=True),
        "place": pa.Column(pl.String, nullable=True),
        "method": pa.Column(pl.String, nullable=True),
        "part": pa.Column(pl.String, nullable=True),
        "rank": pa.Column(pl.String, pa.Check.isin(RANKS), nullable=False),
        "references": pa.Column(pl.String, nullable=False),
        "has_reference": pa.Column(pl.Boolean, nullable=False),
        "disagrees_gt_25pct": pa.Column(pl.Boolean, nullable=False),
        "attached_via": pa.Column(pl.String, pa.Check.isin(ATTACHED_VIA), nullable=True),
        **_prov(),
    },
    strict=True,
    ordered=True,
)

TERRITORIES = pa.DataFrameSchema(
    {
        "glottocode": pa.Column(pl.String, _GC, nullable=False),
        "iso3166": pa.Column(pl.String, pa.Check.str_matches(r"^[A-Z]{2}$|^[0-9]{3}$"), nullable=False),
        "cldr_code": pa.Column(pl.String, nullable=False),
        "population_share": pa.Column(pl.Float64, pa.Check.in_range(0, 100), nullable=True),
        "territory_population": pa.Column(pl.Int64, pa.Check.ge(0), nullable=True),
        "official_status": pa.Column(pl.String, nullable=True),
        "year": pa.Column(pl.Int32, nullable=True),
        **_prov(),
    },
    strict=True,
    ordered=True,
)

SOURCES = pa.DataFrameSchema(
    {
        "source_id": pa.Column(pl.String, nullable=False, unique=True),
        "name": pa.Column(pl.String, nullable=False),
        "version": pa.Column(pl.String, nullable=False),
        "url": pa.Column(pl.String, nullable=False),
        "doi": pa.Column(pl.String, nullable=True),
        "license": pa.Column(pl.String, nullable=False),
        "license_url": pa.Column(pl.String, nullable=False),
        "attribution": pa.Column(pl.String, nullable=False),
        "share_alike": pa.Column(pl.Boolean, nullable=False),
        "non_commercial": pa.Column(pl.Boolean, nullable=False),
        "no_derivatives": pa.Column(pl.Boolean, nullable=False),
        "status": pa.Column(pl.String, nullable=False),
        "retrieved_at": pa.Column(pl.String, pa.Check.str_matches(ISO_UTC_PATTERN), nullable=True),
    },
    strict=True,
    ordered=True,
)

TABLES: dict[str, pa.DataFrameSchema] = {
    "languoids": LANGUOIDS,
    "names": NAMES,
    "xrefs": XREFS,
    "speakers": SPEAKERS,
    "territories": TERRITORIES,
    "sources": SOURCES,
}

# Primary keys / uniqueness beyond single columns, checked by validate.
COMPOSITE_KEYS: dict[str, tuple[str, ...]] = {
    "names": ("glottocode", "name", "lang", "type", "source_id", "locator"),
    "xrefs": ("glottocode", "scheme", "code", "source_id", "locator"),
    "territories": ("glottocode", "iso3166", "cldr_code"),
}

# Column order used when writing, derived from the schemas so build and validate cannot drift.
COLUMNS: dict[str, list[str]] = {name: list(schema.columns) for name, schema in TABLES.items()}
