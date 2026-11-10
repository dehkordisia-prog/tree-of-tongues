"""`pipeline fetch`: download raw sources into data/raw/<source-id>/<YYYY-MM-DD>/.

Rules (from CLAUDE.md and data/LICENSES.yaml):
- Raw files are immutable. An existing dated file is never overwritten; it is skipped.
- Every file is listed in data/raw/MANIFEST.yaml with url, version/DOI, retrieved_at, sha256, bytes.
- Wikidata: descriptive User-Agent without personal contact, one request at a time,
  60 s server timeout, Retry-After honored on HTTP 429.
- A source must be cleared in data/LICENSES.yaml before anything is downloaded.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import time
from pathlib import Path

import httpx
import yaml

from pipeline import common

USER_AGENT = "TreeOfTongues/0.1 (https://github.com/dehkordisia-prog/tree-of-tongues) python-httpx/0.28.1"
QUERIES_DIR = Path(__file__).resolve().parent / "queries"
WDQS_URL = "https://query.wikidata.org/sparql"
ZENODO_RECORD = "18840967"
ZENODO_DOI = "10.5281/zenodo.18840967"
ZENODO_FILE = "glottolog/glottolog-cldf-v5.3.zip"
CLDR_TAG = "49.0.0"
CLDR_BASE = f"https://raw.githubusercontent.com/unicode-org/cldr-json/{CLDR_TAG}/cldr-json"
CLDR_FILES = (
    "LICENSE",  # Unicode License v3 text; must ship beside CLDR-derived files (LICENSES.yaml restrictions)
    "cldr-core/supplemental/territoryInfo.json",
    "cldr-localenames-full/main/en/languages.json",
    "cldr-localenames-full/main/fa/languages.json",
    "cldr-localenames-full/main/tr/languages.json",
)
# Natural Earth publishes the same 5.1.1 vectors as GeoJSON in its official GitHub repository
# (nvkelso/natural-earth-vector, tag v5.1.1). We use that to avoid a GDAL/shapefile dependency.
NE_TAG = "v5.1.1"
NE_BASE = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{NE_TAG}/geojson"
NE_FILES = (
    "ne_110m_admin_0_countries.geojson",
    "ne_50m_admin_0_countries.geojson",
    "ne_50m_admin_0_breakaway_disputed_areas.geojson",
)
PAGE_SIZES = {"languoids": 2500, "speakers": 2500}
WDQS_PAUSE_SECONDS = 3.0


def _utc(ts: float) -> str:
    return dt.datetime.fromtimestamp(ts, dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class Fetcher:
    def __init__(self, raw_dir: Path, today: str, client: httpx.Client) -> None:
        self.raw_dir = raw_dir
        self.today = today
        self.client = client
        self.manifest_path = raw_dir / "MANIFEST.yaml"
        manifest = common.read_manifest(self.manifest_path)
        self.files: dict[str, dict] = {f["path"]: f for f in manifest.get("files", [])}

    # -- bookkeeping -----------------------------------------------------------
    def target(self, source_id: str, name: str) -> Path:
        return self.raw_dir / source_id / self.today / name

    def record(self, path: Path, **meta: object) -> None:
        rel = path.relative_to(self.raw_dir).as_posix()
        if rel in self.files:
            return  # immutable: the first record wins
        self.files[rel] = {
            "path": rel,
            **meta,
            "retrieved_at": _utc(path.stat().st_mtime),
            "sha256": common.sha256_file(path),
            "bytes": path.stat().st_size,
        }
        self.save()

    def save(self) -> None:
        doc = {
            "schema_version": 1,
            "note": "Raw downloads are immutable and gitignored; this manifest is committed.",
            "files": [self.files[k] for k in sorted(self.files)],
        }
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        self.manifest_path.write_text(
            yaml.safe_dump(doc, sort_keys=False, allow_unicode=True), encoding="utf-8"
        )

    # -- http ------------------------------------------------------------------
    def get(self, url: str, **kwargs: object) -> httpx.Response:
        for attempt in range(6):
            resp = self.client.get(url, **kwargs)  # type: ignore[arg-type]
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", "60")) + 1
                print(f"  429 from {url}; waiting {wait}s (Retry-After)", file=sys.stderr)
                time.sleep(wait)
                continue
            if resp.status_code >= 500:
                wait = 10 * (attempt + 1)
                print(f"  HTTP {resp.status_code} from {url}; retrying in {wait}s", file=sys.stderr)
                time.sleep(wait)
                continue
            resp.raise_for_status()
            return resp
        raise RuntimeError(f"giving up on {url}")

    def write_new(self, path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(path.suffix + ".part")
        tmp.write_bytes(data)
        tmp.replace(path)

    def download(self, source_id: str, name: str, url: str, **meta: object) -> Path:
        path = self.target(source_id, name)
        if path.exists():
            print(f"skip (exists): {path.relative_to(self.raw_dir)}")
        else:
            print(f"get {url}")
            self.write_new(path, self.get(url).content)
        self.record(path, source_id=source_id, url=url, **meta)
        return path

    # -- sources ---------------------------------------------------------------
    def glottolog(self) -> None:
        sid = common.GLOTTOLOG
        rec_path = self.download(
            sid,
            "zenodo-record.json",
            f"https://zenodo.org/api/records/{ZENODO_RECORD}",
            version="v5.3",
            doi=ZENODO_DOI,
        )
        record = json.loads(rec_path.read_text(encoding="utf-8"))
        if record.get("doi") != ZENODO_DOI:
            raise SystemExit(f"STOP: Zenodo record DOI mismatch: {record.get('doi')}")
        listing = self.get(record["links"]["files"]).json()
        entry = next(f for f in listing["entries"] if f["key"] == ZENODO_FILE)
        path = self.download(
            sid,
            "glottolog-cldf-v5.3.zip",
            entry["links"]["content"],
            version="v5.3",
            doi=ZENODO_DOI,
            published="2026-03-02",
        )
        algo, _, expected = entry["checksum"].partition(":")
        digest = hashlib.new(algo)
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1 << 20), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise SystemExit(f"STOP: {path.name} {algo} {digest.hexdigest()} != Zenodo {expected}")
        print(f"  {algo} matches Zenodo: {expected}")

    def cldr(self) -> None:
        for rel in CLDR_FILES:
            self.download(
                common.CLDR,
                rel.replace("/", "__"),
                (f"{CLDR_BASE.rsplit('/', 1)[0]}/{rel}" if rel == "LICENSE" else f"{CLDR_BASE}/{rel}"),
                version="49.0.0",
                tag=CLDR_TAG,
                cldr_path=rel,
            )

    def natural_earth(self) -> None:
        for name in NE_FILES:
            self.download(
                common.NATURAL_EARTH, name, f"{NE_BASE}/{name}", version="5.1.1", tag=NE_TAG, format="GeoJSON"
            )

    def wikidata(self) -> None:
        sid = common.WIKIDATA
        for qname, page_size in PAGE_SIZES.items():
            template = (QUERIES_DIR / f"{qname}.rq").read_text(encoding="utf-8")
            qhash = common.sha256_bytes(template.encode("utf-8"))
            offset = 0
            while True:
                path = self.target(sid, f"{qname}-{offset // page_size:04d}.json")
                query = template.replace("{limit}", str(page_size)).replace("{offset}", str(offset))
                if path.exists():
                    print(f"skip (exists): {path.relative_to(self.raw_dir)}")
                else:
                    print(f"wdqs {qname} offset={offset}")
                    resp = self.get(
                        WDQS_URL,
                        params={"query": query, "format": "json"},
                        headers={"Accept": "application/sparql-results+json"},
                    )
                    self.write_new(path, resp.content)
                    time.sleep(WDQS_PAUSE_SECONDS)
                self.record(
                    path,
                    source_id=sid,
                    url=WDQS_URL,
                    version="rolling",
                    query_file=f"pipeline/fetch/queries/{qname}.rq",
                    query_sha256=qhash,
                    limit=page_size,
                    offset=offset,
                )
                bindings = json.loads(path.read_text(encoding="utf-8"))["results"]["bindings"]
                # Rows multiply with OPTIONAL joins, so a short page cannot be detected from the
                # row count. Count the distinct keys the inner (paged) subquery selects.
                fields = (
                    ("item", "glottocode", "statement") if qname == "speakers" else ("item", "glottocode")
                )
                if len({tuple(b[f]["value"] for f in fields) for b in bindings}) < page_size:
                    break
                offset += page_size


def run(args: argparse.Namespace) -> int:
    raw_dir = Path(getattr(args, "raw_dir", None) or common.RAW_DIR)
    only = getattr(args, "only", None)
    sources = common.load_licenses()
    stages = {
        common.GLOTTOLOG: "glottolog",
        common.CLDR: "cldr",
        common.WIKIDATA: "wikidata",
        common.NATURAL_EARTH: "natural_earth",
    }
    for sid in stages:
        common.require_cleared(sources, sid)
    today = dt.datetime.now(dt.UTC).strftime("%Y-%m-%d")
    with httpx.Client(
        headers={"User-Agent": USER_AGENT}, timeout=httpx.Timeout(90.0), follow_redirects=True
    ) as client:
        fetcher = Fetcher(raw_dir, today, client)
        for sid, method in stages.items():
            if only and sid != only:
                continue
            print(f"== {sid}")
            getattr(fetcher, method)()
    print(f"manifest: {fetcher.manifest_path}")
    return 0
