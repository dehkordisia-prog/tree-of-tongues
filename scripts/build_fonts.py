#!/usr/bin/env python3
"""Build the Tongues Sans and Tongues Serif web fonts from Adobe's official releases.

Why this exists: the Source fonts carry the OFL Reserved Font Name "Source". A web subset is a
Modified Version (OFL FAQ 2.6 to 2.8), so it must not keep that name. We subset the official
variable fonts into unicode-range slices and rename them. Adobe's copyright (name ID 0), the
trademark notice (ID 7) and the OFL (IDs 13 and 14) stay as upstream has them.

    uv run python scripts/build_fonts.py            build, verify against the lock
    uv run python scripts/build_fonts.py --lock     build and rewrite the output hashes in the lock
    uv run python scripts/build_fonts.py --check    build into a temp folder, compare with the lock

Inputs are pinned by URL and sha256 in scripts/fonts-build.lock.json. Zips are cached in
data/raw/fonts-src/ (gitignored) and never committed. Outputs are deterministic: the same inputs
and the same fontTools and brotli versions give byte-identical woff2 files.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

import brotli
from fontTools import subset
from fontTools import version as fonttools_version
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
LOCK = ROOT / "scripts" / "fonts-build.lock.json"
CACHE = ROOT / "data" / "raw" / "fonts-src"
OUT_ROOT = ROOT / "apps" / "web" / "public" / "fonts"
CSS_OUT = ROOT / "apps" / "web" / "src" / "design" / "fonts.tongues.css"

NOTE = (
    "Modified by the Tree of Tongues project: subset for the web and renamed, "
    "as required by the Reserved Font Name clause."
)

# Same slices as Google Fonts uses, so a page loads only the scripts it shows.
SLICES = {
    "cyrillic-ext": "U+0460-052F,U+1C80-1C8A,U+20B4,U+2DE0-2DFF,U+A640-A69F,U+FE2E-FE2F",
    "cyrillic": "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116",
    "greek-ext": "U+1F00-1FFF",
    "greek": "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF",
    "vietnamese": (
        "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,"
        "U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB"
    ),
    "latin-ext": (
        "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,"
        "U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,"
        "U+A720-A7FF"
    ),
    "latin": (
        "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,"
        "U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
    ),
}

# OpenType features worth keeping on the web: kerning, ligatures, figures, case, small caps, marks.
FEATURES = [
    "kern", "liga", "clig", "ccmp", "locl", "mark", "mkmk", "calt", "case", "tnum", "pnum", "lnum",
    "onum", "smcp", "c2sc", "frac", "sups", "subs", "zero", "ss01", "ss02", "ss03", "ss04", "ss05",
]  # fmt: skip

# Per family: the PostScript-name prefix, the display family, the opsz handling and the slices.
# Tongues Serif pins opsz at 36 (a heading size; CSS px equals opsz units). Keeping the whole
# axis would add about 110 KB to the Latin slice that paints the first heading.
FAMILIES = {
    "tongues-sans": {
        "family": "Tongues Sans",
        "ps_prefix": "TonguesSans",
        "pin": {},
        "slices": ["cyrillic-ext", "cyrillic", "greek-ext", "greek", "vietnamese", "latin-ext", "latin"],
        "italic_slices": ["latin-ext", "latin"],
    },
    "tongues-serif": {
        "family": "Tongues Serif",
        "ps_prefix": "TonguesSerif",
        "pin": {"opsz": 36},
        "slices": ["cyrillic-ext", "cyrillic", "greek-ext", "greek", "vietnamese", "latin-ext", "latin"],
        "italic_slices": [],
    },
}

# Longest names first. Applied to every name record except IDs 0 and 7.
RENAMES = [
    ("SourceSerif4Variable", "TonguesSerif"),
    ("Source Serif 4 Variable", "Tongues Serif"),
    ("Source Serif 4", "Tongues Serif"),
    ("SourceSerif4", "TonguesSerif"),
    ("SourceSans3VF", "TonguesSans"),
    ("Source Sans 3", "Tongues Sans"),
    ("SourceSans3", "TonguesSans"),
]
KEEP_UPSTREAM_NAME_IDS = {0, 7}  # copyright and trademark stay exactly as Adobe wrote them


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch(url: str, expected: str) -> bytes:
    """Return the bytes of url from the cache or the network, verified against the pinned sha256."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / f"{expected[:16]}-{url.rsplit('/', 1)[-1]}"
    if cached.exists():
        data = cached.read_bytes()
    else:
        print(f"fetch {url}")
        request = urllib.request.Request(url, headers={"user-agent": "tree-of-tongues-build-fonts"})
        with urllib.request.urlopen(request) as response:
            data = response.read()
        cached.write_bytes(data)
    if sha256(data) != expected:
        cached.unlink(missing_ok=True)
        sys.exit(f"sha256 mismatch for {url}: got {sha256(data)}, lock says {expected}")
    return data


def unicodes(range_text: str) -> list[int]:
    out: list[int] = []
    for part in range_text.split(","):
        body = part.strip()[2:]
        if "-" in body:
            lo, hi = body.split("-")
            out.extend(range(int(lo, 16), int(hi, 16) + 1))
        else:
            out.append(int(body, 16))
    return out


def rename(font: TTFont, spec: dict, italic: bool, upstream_version: str) -> None:
    name = font["name"]
    for record in list(name.names):
        if record.nameID in KEEP_UPSTREAM_NAME_IDS:
            continue
        text = record.toUnicode()
        for old, new in RENAMES:
            text = text.replace(old, new)
        record.string = text
    # Explicit identity records. The VF default instance is ExtraLight for Sans; keep the
    # upstream style word by reading the renamed PostScript name.
    family = spec["family"]
    ps_name = name.getName(6, 3, 1, 0x409).toUnicode()
    style_word = "Italic" if italic else "Regular"
    name.setName(family, 1, 3, 1, 0x409)
    name.setName(style_word, 2, 3, 1, 0x409)
    name.setName(f"{upstream_version};TOT;{ps_name}", 3, 3, 1, 0x409)
    name.setName(f"{family} Italic" if italic else family, 4, 3, 1, 0x409)
    name.setName(
        f"Version {upstream_version}; modified by the Tree of Tongues project (web subset)", 5, 3, 1, 0x409
    )
    name.setName(NOTE, 10, 3, 1, 0x409)
    for stale in (16, 17, 21, 22):
        name.removeNames(nameID=stale)
    font["OS/2"].achVendID = "TOT "
    # No leftover upstream family name anywhere except the copyright and trademark notices.
    for record in name.names:
        if record.nameID not in KEEP_UPSTREAM_NAME_IDS and "Source" in record.toUnicode():
            sys.exit(f"name ID {record.nameID} still says Source: {record.toUnicode()!r}")


def load(data: bytes) -> TTFont:
    return TTFont(io.BytesIO(data), recalcTimestamp=False)


def to_bytes(font: TTFont) -> bytes:
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def make_slice(source: bytes, range_text: str, spec: dict, italic: bool, version: str) -> bytes | None:
    font = load(source)
    cmap = font.getBestCmap()
    wanted = [u for u in unicodes(range_text) if u in cmap]
    if not wanted:
        return None
    options = subset.Options()
    options.layout_features = FEATURES
    options.name_IDs = ["*"]
    options.name_languages = [0x409]
    options.name_legacy = False
    options.hinting = False
    options.notdef_outline = True
    options.glyph_names = False
    options.drop_tables += ["DSIG"]
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(font)
    rename(font, spec, italic, version)
    font.flavor = "woff2"
    return to_bytes(font)


def prepare_source(raw: bytes, pin: dict) -> bytes:
    """Pin variation axes (for example opsz) once, then round-trip so glyph names are consistent."""
    font = load(raw)
    if pin:
        font = instancer.instantiateVariableFont(font, pin)
        font = load(to_bytes(font))
    return to_bytes(font)


def css_block(family: str, style: str, file: str, range_text: str, weight: str) -> str:
    return (
        "@font-face {\n"
        f'  font-family: "{family}";\n'
        f"  font-style: {style};\n"
        f"  font-weight: {weight};\n"
        "  font-display: swap;\n"
        f'  src: url("/fonts/{file}") format("woff2");\n'
        f"  unicode-range: {range_text};\n"
        "}\n"
    )


def build(out_root: Path, lock: dict) -> tuple[dict[str, str], str]:
    outputs: dict[str, str] = {}
    css = [
        "/* Generated by scripts/build_fonts.py. Do not edit.\n"
        " * Tongues Sans and Tongues Serif are web subsets of Adobe's Source Sans 3 (3.052R) and\n"
        " * Source Serif 4 (4.005R), renamed as the OFL Reserved Font Name clause requires.\n"
        " * Licence and modification note: see the font folders and README.md. */\n\n"
    ]
    for entry in lock["families"]:
        spec = FAMILIES[entry["id"]]
        folder = out_root / entry["id"]
        folder.mkdir(parents=True, exist_ok=True)
        zip_bytes = fetch(entry["zip"]["url"], entry["zip"]["sha256"])
        archive = zipfile.ZipFile(io.BytesIO(zip_bytes))
        weight = "200 900"
        for member in entry["members"]:
            raw = archive.read(member["path"])
            if sha256(raw) != member["sha256"]:
                sys.exit(f"{member['path']} in {entry['zip']['url']} does not match the lock")
            italic = member["style"] == "italic"
            source = prepare_source(raw, spec["pin"])
            slices = spec["italic_slices"] if italic else spec["slices"]
            for slice_name in slices:
                data = make_slice(source, SLICES[slice_name], spec, italic, entry["version"])
                if data is None:
                    continue
                file = f"{entry['id']}-{slice_name}-wght-{member['style']}.woff2"
                (folder / file).write_bytes(data)
                outputs[f"{entry['id']}/{file}"] = sha256(data)
                css.append(
                    css_block(
                        spec["family"], member["style"], f"{entry['id']}/{file}", SLICES[slice_name], weight
                    )
                )
        # License text: from the release zip when it ships one, else the file at the release tag.
        if "license_member" in entry:
            license_bytes = archive.read(entry["license_member"])
        else:
            license_bytes = fetch(entry["license"]["url"], entry["license"]["sha256"])
        if sha256(license_bytes) != entry["license"]["sha256"]:
            sys.exit(f"license text for {entry['id']} does not match the lock")
        (folder / "OFL.txt").write_bytes(license_bytes)
        (folder / "FONTLOG.txt").write_text(fontlog(entry, spec), encoding="utf-8", newline="\n")
    return outputs, "\n".join(css)


def fontlog(entry: dict, spec: dict) -> str:
    return (
        f"{spec['family']} font log\n"
        "========================\n\n"
        f"{NOTE}\n\n"
        f"Original: Adobe {entry['upstream']}, release {entry['release']}.\n"
        f"Release page: {entry['release_url']}\n"
        f"Source archive: {entry['zip']['url']}\n"
        f"Source archive sha256: {entry['zip']['sha256']}\n"
        f"Variable fonts used: {', '.join(m['path'] for m in entry['members'])}\n\n"
        "Changes\n"
        "- Subset into unicode-range slices (Latin, Latin Extended, Cyrillic, Greek, Vietnamese).\n"
        "- Hinting removed; only English name records kept; web-useful OpenType features kept.\n"
        + (
            "- Optical size axis fixed at opsz 36; weight axis kept (200 to 900).\n"
            if spec["pin"]
            else "- Weight axis kept (200 to 900).\n"
        )
        + f"- Renamed to {spec['family']}. Name IDs 1, 3, 4, 6, 25 and all variable-font instance and\n"
        "  STAT names no longer contain the Reserved Font Name. OS/2 vendor ID set to TOT.\n"
        "- Copyright (ID 0), trademark (ID 7) and license (IDs 13 and 14) are unchanged from upstream.\n\n"
        "License: SIL Open Font License 1.1, see OFL.txt (verbatim from upstream).\n"
        f"Built by scripts/build_fonts.py with fontTools {fonttools_version}, brotli {brotli.__version__}.\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--lock", action="store_true", help="rewrite output hashes in the lock")
    mode.add_argument("--check", action="store_true", help="build to a temp folder and compare with the lock")
    args = parser.parse_args()

    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    tool = {"fonttools": fonttools_version, "brotli": brotli.__version__}
    if lock["toolchain"] != tool:
        sys.exit(f"toolchain {tool} differs from lock {lock['toolchain']}; outputs may differ")

    if args.check:
        with tempfile.TemporaryDirectory() as tmp:
            outputs, _ = build(Path(tmp), lock)
        if outputs != lock["outputs"]:
            changed = sorted(
                k for k in set(outputs) | set(lock["outputs"]) if outputs.get(k) != lock["outputs"].get(k)
            )
            sys.exit(f"outputs differ from lock: {changed}")
        print(f"ok: {len(outputs)} files rebuilt byte-identical to the lock")
        return

    outputs, css = build(OUT_ROOT, lock)
    CSS_OUT.write_text(css, encoding="utf-8", newline="\n")
    if args.lock:
        lock["outputs"] = dict(sorted(outputs.items()))
        LOCK.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
        print(f"lock updated with {len(outputs)} output hashes")
    elif outputs != lock["outputs"]:
        sys.exit("outputs differ from the lock; review, then run with --lock")
    total = sum((OUT_ROOT / k).stat().st_size for k in outputs)
    print(f"built {len(outputs)} files, {total / 1024:.1f} KB")


if __name__ == "__main__":
    main()
