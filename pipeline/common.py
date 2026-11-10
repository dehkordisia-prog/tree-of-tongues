"""Shared paths and helpers for every pipeline stage."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW_DIR = DATA / "raw"
BUILD_DIR = DATA / "build"
LICENSES_PATH = DATA / "LICENSES.yaml"
MANIFEST_PATH = RAW_DIR / "MANIFEST.yaml"

# Source ids must equal the `id` of an entry in data/LICENSES.yaml.
GLOTTOLOG = "glottolog-5.3"
CLDR = "cldr-49"
WIKIDATA = "wikidata"
NATURAL_EARTH = "natural-earth-5.1.1"

CONFIDENCE = ("high", "medium", "low", "contested")
GLOTTOCODE_RE = re.compile(r"^[a-z0-9]{4}[0-9]{4}$")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_licenses(path: Path = LICENSES_PATH) -> dict[str, dict]:
    """Return LICENSES.yaml sources keyed by id. Raises on duplicates."""
    doc = yaml.safe_load(path.read_text(encoding="utf-8"))
    sources: dict[str, dict] = {}
    for entry in doc.get("sources", []):
        if entry["id"] in sources:
            raise ValueError(f"duplicate source id in LICENSES.yaml: {entry['id']}")
        sources[entry["id"]] = entry
    return sources


def require_cleared(sources: dict[str, dict], source_id: str) -> dict:
    """Stop (raise) if a source is missing from LICENSES.yaml or not cleared."""
    entry = sources.get(source_id)
    if entry is None:
        raise SystemExit(
            f"STOP: source '{source_id}' has no entry in data/LICENSES.yaml. Ask rights-auditor."
        )
    if not str(entry.get("status", "")).startswith("cleared"):
        raise SystemExit(f"STOP: source '{source_id}' is not cleared (status={entry.get('status')}).")
    return entry


def read_manifest(path: Path = MANIFEST_PATH) -> dict:
    if path.exists():
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return {}


def latest_raw_dir(raw_dir: Path, source_id: str) -> Path:
    """Latest dated directory (YYYY-MM-DD) for a source."""
    base = raw_dir / source_id
    dated = (
        sorted(p for p in base.iterdir() if p.is_dir() and re.fullmatch(r"\d{4}-\d{2}-\d{2}", p.name))
        if base.exists()
        else []
    )
    if not dated:
        raise SystemExit(f"No raw data for {source_id} under {base}. Run `pipeline fetch` first.")
    return dated[-1]


CLDR_FALLBACK_NOTE = "CLDR code mapped through a Wikidata item that may cover more than this Glottolog node"
