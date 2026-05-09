#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.photo_db import apply_migrations, connect_db
from scripts.lib.photo_repository import PhotoRepository
from scripts.lib.shelter_gallery_consumer_validator import validate_gallery_payload
from scripts.lib.shelter_gallery_service import ShelterGalleryService


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Export a shelter gallery payload.")
    parser.add_argument("--db", required=True, help="Absolute SQLite database path.")
    parser.add_argument("--shelter", required=True, help="Shelter slug.")
    parser.add_argument("--placeholder-manifest", default=str(Path(__file__).resolve().parents[1] / "specs/001-shelter-photo-carousel/site-placeholder.json"))
    parser.add_argument("--validate", action="store_true", help="Validate the payload before printing it.")
    return parser


def main(argv: list[str] | None = None, stdout=None, stderr=None) -> int:
    stdout = stdout or sys.stdout
    stderr = stderr or sys.stderr
    args = build_parser().parse_args(argv)

    connection = connect_db(args.db)
    apply_migrations(connection, Path(__file__).resolve().parents[1] / "database" / "migrations")
    service = ShelterGalleryService(PhotoRepository(connection), args.placeholder_manifest)
    try:
        payload = service.build_gallery_payload(args.shelter, validate=args.validate)
        if args.validate:
            validate_gallery_payload(payload)
        stdout.write(json.dumps(payload, indent=2) + "\n")
        return 0
    except Exception as exc:
        stderr.write(f"{exc}\n")
        return 1
    finally:
        connection.close()


if __name__ == "__main__":
    raise SystemExit(main())

