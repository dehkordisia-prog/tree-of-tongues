"""Readers for raw sources. They return plain Python structures and never invent values."""

from __future__ import annotations

import json
import re
import tempfile
import zipfile
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from pycldf import Dataset

from pipeline import common


@dataclass
class RawSet:
    """Latest dated raw directory of one source plus per-file retrieval times from MANIFEST.yaml."""

    source_id: str
    directory: Path
    retrieved: dict[str, str] = field(default_factory=dict)  # filename -> retrieved_at (UTC ISO)

    def path(self, name: str) -> Path:
        return self.directory / name

    def retrieved_at(self, name: str) -> str:
        try:
            return self.retrieved[name]
        except KeyError as exc:
            raise SystemExit(
                f"STOP: {self.source_id}/{self.directory.name}/{name} is not listed in MANIFEST.yaml. "
                "Raw files must be recorded by `pipeline fetch`."
            ) from exc


def open_raw(raw_dir: Path, source_id: str) -> RawSet:
    directory = common.latest_raw_dir(raw_dir, source_id)
    manifest_path = raw_dir / "MANIFEST.yaml"
    if not manifest_path.exists():
        raise SystemExit(f"STOP: {manifest_path} is missing.")
    doc = yaml.safe_load(manifest_path.read_text(encoding="utf-8")) or {}
    prefix = f"{source_id}/{directory.name}/"
    retrieved = {
        f["path"][len(prefix) :]: f["retrieved_at"]
        for f in doc.get("files", [])
        if f["path"].startswith(prefix)
    }
    return RawSet(source_id, directory, retrieved)


# --------------------------------------------------------------------------- Glottolog


@dataclass
class GlottologData:
    languages: list[dict]
    values: dict[tuple[str, str], dict]  # (glottocode, parameter) -> {"value", "code_id", "row_id"}
    code_names: dict[str, str]  # Code_ID -> human name
    names: list[dict]
    # Retired or bookkeeping languoids -> replacement Glottocode (None: Glottolog 5.3 CLDF records none).
    retired: dict[str, str | None] = field(default_factory=dict)


def _truthy(value: object) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    return str(value).lower() == "true"


def _joined(value: object) -> str | None:
    """pycldf parses ';'-separated columns into lists; keep Glottolog's own ';'-joined string."""
    if value is None or value == "" or value == []:
        return None
    return ";".join(value) if isinstance(value, list | tuple) else str(value)


def read_glottolog(raw: RawSet) -> GlottologData:
    """Read the Glottolog CLDF release (zip or directory) with pycldf."""
    zips = sorted(raw.directory.glob("*.zip"))
    with tempfile.TemporaryDirectory(prefix="glottolog-cldf-") as tmp:
        if zips:
            with zipfile.ZipFile(zips[0]) as archive:
                members = [m for m in archive.namelist() if not m.endswith("sources.bib.zip")]
                archive.extractall(tmp, members=members)
            root = Path(tmp)
        else:
            root = raw.directory
        metadata = sorted(root.rglob("cldf-metadata.json"))
        if not metadata:
            raise SystemExit(f"STOP: no cldf-metadata.json under {root}")
        ds = Dataset.from_metadata(metadata[0])
        languages = []
        for row in ds["LanguageTable"]:
            languages.append(
                {
                    "id": row["ID"],
                    "name": row["Name"],
                    "macroarea": _joined(row.get("Macroarea")),
                    "latitude": float(row["Latitude"]) if row.get("Latitude") is not None else None,
                    "longitude": float(row["Longitude"]) if row.get("Longitude") is not None else None,
                    "glottocode": row.get("Glottocode") or row["ID"],
                    "iso": row.get("ISO639P3code") or None,
                    "level": row["Level"],
                    "is_isolate": _truthy(row.get("Is_Isolate")),
                }
            )
        values: dict[tuple[str, str], dict] = {}
        for row in ds["ValueTable"]:
            param = row["Parameter_ID"]
            if param in ("classification", "level", "category", "aes"):
                values[(row["Language_ID"], param)] = {
                    "value": row["Value"],
                    "code_id": row.get("Code_ID"),
                    "row_id": row["ID"],
                }
        code_names = {row["ID"]: row["Name"] for row in ds["CodeTable"]}
        names = [
            {
                "id": row["ID"],
                "glottocode": row["Language_ID"],
                "name": row["Name"],
                "provider": row["Provider"],
                "lang": row["lang"],
            }
            for row in ds["names.csv"]
        ]
    return GlottologData(languages, values, code_names, names, find_retired(languages, values))


BOOKKEEPING_CATEGORY = "Bookkeeping"
BOOKKEEPING_FAMILY = "book1242"


def find_retired(languages: list[dict], values: dict[tuple[str, str], dict]) -> dict[str, str | None]:
    """Glottocodes of retired or bookkeeping languoids, mapped to a replacement (None if none is recorded).

    Glottolog 5.3 CLDF marks them with the `category` value `Bookkeeping` (and a classification under the
    pseudo-family `book1242`). The "(Retired)" name suffix is only on a minority of them, so it is not used.
    The CLDF has no replacement field, so every replacement is None; the mapping exists so a recorded
    replacement is honored the day Glottolog provides one.
    """
    retired: dict[str, str | None] = {}
    for lang in languages:
        gc = lang["glottocode"]
        category = values.get((gc, "category"))
        cls = values.get((gc, "classification"))
        path = cls["value"].split("/") if cls and cls["value"] else []
        if (category and category["value"] == BOOKKEEPING_CATEGORY) or BOOKKEEPING_FAMILY in path:
            retired[gc] = None
    return retired


# --------------------------------------------------------------------------- CLDR


def read_cldr_territories(raw: RawSet) -> tuple[dict, str]:
    name = "cldr-core__supplemental__territoryInfo.json"
    data = json.loads(raw.path(name).read_text(encoding="utf-8"))
    return data["supplemental"]["territoryInfo"], raw.retrieved_at(name)


def read_cldr_language_names(raw: RawSet, locale: str) -> tuple[dict[str, str], str]:
    name = f"cldr-localenames-full__main__{locale}__languages.json"
    data = json.loads(raw.path(name).read_text(encoding="utf-8"))
    return data["main"][locale]["localeDisplayNames"]["languages"], raw.retrieved_at(name)


def read_cldr_territory_names(raw: RawSet, locale: str) -> tuple[dict[str, str], str]:
    """CLDR territory display names: code -> name. Keys like `HK-alt-short` hold alternate forms."""
    name = f"cldr-localenames-full__main__{locale}__territories.json"
    data = json.loads(raw.path(name).read_text(encoding="utf-8"))
    return data["main"][locale]["localeDisplayNames"]["territories"], raw.retrieved_at(name)


# --------------------------------------------------------------------------- Wikidata


def _tail(uri: str) -> str:
    return uri.rsplit("/", 1)[-1]


def _pages(raw: RawSet, prefix: str) -> list[Path]:
    return sorted(raw.directory.glob(f"{prefix}-*.json"))


def read_wikidata_languoids(raw: RawSet) -> dict[tuple[str, str], dict]:
    """(glottocode, qid) -> {iso3, iso1, labels, retrieved_at}. Sets are returned sorted."""
    out: dict[tuple[str, str], dict] = {}
    for page in _pages(raw, "languoids"):
        retrieved = raw.retrieved_at(page.name)
        for b in json.loads(page.read_text(encoding="utf-8"))["results"]["bindings"]:
            key = (b["glottocode"]["value"], _tail(b["item"]["value"]))
            entry = out.setdefault(
                key, {"iso3": set(), "iso1": set(), "labels": {}, "retrieved_at": retrieved}
            )
            if "iso" in b:
                entry["iso3"].add(b["iso"]["value"])
            if "iso1" in b:
                entry["iso1"].add(b["iso1"]["value"])
            for lang in ("en", "fa", "tr"):
                if f"label_{lang}" in b:
                    entry["labels"].setdefault(lang, set()).add(b[f"label_{lang}"]["value"])
    return out


def read_wikidata_deprecated_p1394(raw: RawSet) -> dict[tuple[str, str], list[str]]:
    """(glottocode, qid) -> sorted reasons for a deprecated P1394 statement (P2241 labels; may be empty).

    languoids.rq sees only truthy statements, so deprecated Glottocode statements come from their own query.
    Missing pages mean no deprecation data (the fixture has none), never an error.
    """
    out: dict[tuple[str, str], set[str]] = {}
    for page in _pages(raw, "deprecated_p1394"):
        for b in json.loads(page.read_text(encoding="utf-8"))["results"]["bindings"]:
            key = (b["glottocode"]["value"], _tail(b["item"]["value"]))
            reasons = out.setdefault(key, set())
            if "reason" in b:
                reasons.add(b.get("reason_label", {}).get("value") or _tail(b["reason"]["value"]))
    return {k: sorted(v) for k, v in out.items()}


def read_wikidata_speakers(raw: RawSet) -> list[dict]:
    """One dict per statement. Qualifier and reference cross products are collapsed, never statements."""
    statements: dict[str, dict] = {}
    for page in _pages(raw, "speakers"):
        retrieved = raw.retrieved_at(page.name)
        for b in json.loads(page.read_text(encoding="utf-8"))["results"]["bindings"]:
            sid = _tail(b["statement"]["value"])
            st = statements.setdefault(
                sid,
                {
                    "statement": sid,
                    "qid": _tail(b["item"]["value"]),
                    "glottocode": b["glottocode"]["value"],
                    "value": b["value"]["value"],
                    "rank": b["rank"]["value"].rsplit("#", 1)[-1],
                    "times": set(),
                    "parts": {},
                    "methods": {},
                    "refs": {},
                    "retrieved_at": retrieved,
                },
            )
            if "time" in b:
                st["times"].add(b["time"]["value"])
            if "part" in b:
                st["parts"][_tail(b["part"]["value"])] = b.get("part_label", {}).get("value")
            if "method" in b:
                st["methods"][_tail(b["method"]["value"])] = b.get("method_label", {}).get("value")
            if "ref" in b:
                ref = st["refs"].setdefault(
                    _tail(b["ref"]["value"]),
                    {"stated_in": None, "stated_in_label": None, "url": None, "retrieved": None},
                )
                if "stated" in b:
                    ref["stated_in"] = _tail(b["stated"]["value"])
                    ref["stated_in_label"] = b.get("stated_label", {}).get("value")
                if "refurl" in b:
                    ref["url"] = b["refurl"]["value"]
                if "retrieved" in b:
                    ref["retrieved"] = b["retrieved"]["value"][:10]
    return [statements[k] for k in sorted(statements)]


YEAR_RE = re.compile(r"^([+-]?\d{1,6})-")


def year_of(timestamp: str) -> int | None:
    match = YEAR_RE.match(timestamp)
    return int(match.group(1)) if match else None
