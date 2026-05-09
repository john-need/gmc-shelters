#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.shelter_file_size_audit import (
    DEFAULT_MAX_BYTES,
    DEFAULT_TARGET_BYTES,
    audit_shelter_files,
    format_audit_summary,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Scan the shelters folder, resize oversized images, and report oversized non-image files."
    )
    parser.add_argument(
        "--root",
        default=str(REPO_ROOT / "shelters"),
        help="Directory to scan. Defaults to the repository shelters directory.",
    )
    parser.add_argument(
        "--max-bytes",
        type=int,
        default=DEFAULT_MAX_BYTES,
        help="Files larger than this threshold are processed or reported. Default: 50000000.",
    )
    parser.add_argument(
        "--target-bytes",
        type=int,
        default=DEFAULT_TARGET_BYTES,
        help="Oversized images are reduced to this size or smaller. Default: 49000000.",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without modifying files.")
    parser.add_argument("--format", choices=["human", "json"], default="human", help="Summary output format.")
    return parser


def main(argv: list[str] | None = None, *, stdout=None, stderr=None) -> int:
    stdout = stdout or sys.stdout
    stderr = stderr or sys.stderr
    args = build_parser().parse_args(argv)

    try:
        summary = audit_shelter_files(
            args.root,
            max_bytes=args.max_bytes,
            target_bytes=args.target_bytes,
            dry_run=args.dry_run,
        )
    except ValueError as exc:
        stderr.write(f"{exc}\n")
        return 2

    stdout.write(format_audit_summary(summary, args.format))
    return 1 if summary.remaining_oversized_files else 0


if __name__ == "__main__":
    raise SystemExit(main())

