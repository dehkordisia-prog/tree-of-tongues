"""Command line entry point: `uv run pipeline fetch | build | validate | audio`."""

from __future__ import annotations

import argparse
import importlib
import sys
from collections.abc import Callable, Sequence

# Each stage lives in its own subpackage and exposes run(args) -> int.
STAGES: dict[str, str] = {
    "fetch": "Download raw sources into data/raw/ (dated, checksummed).",
    "build": "Normalize raw sources and write data/build/.",
    "validate": "Check schemas, provenance and licenses of data/build/.",
    "audio": "Process audio clips (arrives in Phase 3).",
}


def _load(stage: str) -> Callable[[argparse.Namespace], int] | None:
    try:
        module = importlib.import_module(f"pipeline.{stage}")
    except ModuleNotFoundError:
        return None
    return getattr(module, "run", None)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="pipeline", description=__doc__)
    sub = parser.add_subparsers(dest="stage", required=True)
    for name, help_text in STAGES.items():
        sub.add_parser(name, help=help_text, description=help_text)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    run = _load(args.stage)
    if run is None:
        print(f"pipeline {args.stage}: not implemented yet.", file=sys.stderr)
        return 1
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
