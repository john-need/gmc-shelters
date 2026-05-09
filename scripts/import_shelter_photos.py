#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.photo_import_results import format_import_summary
from scripts.lib.photo_importer import RunLevelError, run_photo_import
from scripts.lib.wordpress_media import WordPressMediaClient


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Upload shelter photos to WordPress media.")
    parser.add_argument("--db", required=True, help="Absolute SQLite database path.")
    parser.add_argument("--base-url", required=True, help="WordPress base URL.")
    parser.add_argument("--username", required=True, help="WordPress username.")
    parser.add_argument("--app-password", required=True, help="WordPress application password.")
    parser.add_argument("--shelter", help="Only process one shelter slug.")
    parser.add_argument("--photo-id", type=int, help="Only process one photo row.")
    parser.add_argument("--limit", type=int, help="Maximum number of photo rows to process.")
    parser.add_argument("--dry-run", action="store_true", help="Do not mutate WordPress or SQLite state.")
    parser.add_argument("--format", choices=["human", "json"], default="human", help="Output formatter.")
    return parser


def main(
    argv: list[str] | None = None,
    *,
    repo_root: Path | None = None,
    stdout=None,
    stderr=None,
    wordpress_client_factory=WordPressMediaClient,
) -> int:
    stdout = stdout or sys.stdout
    stderr = stderr or sys.stderr
    args = build_parser().parse_args(argv)

    repo_root = Path(repo_root) if repo_root is not None else Path(__file__).resolve().parents[1]
    client = wordpress_client_factory(args.base_url, args.username, args.app_password)
    try:
        summary = run_photo_import(
            db_path=args.db,
            repo_root=repo_root,
            base_url=args.base_url,
            wordpress_client=client,
            shelter_slug=args.shelter,
            photo_id=args.photo_id,
            limit=args.limit,
            dry_run=args.dry_run,
        )
    except RunLevelError as exc:
        stderr.write(f"{exc}\n")
        return 1

    stdout.write(format_import_summary(summary, args.format))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

