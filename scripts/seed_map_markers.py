#!/usr/bin/env python3
"""Seed map_markers from shelters.json.

One row is inserted per shelter that has latitude/longitude and no existing
map_marker row.  Safe to rerun — shelters already represented in map_markers
are skipped.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = REPO_ROOT / "database" / "gmc_shelters.sqlite"
DEFAULT_JSON = REPO_ROOT / "shelters.json"

INSERT_SQL = """
INSERT INTO map_markers
  (shelter_id, latitude, longitude, name, start_year, end_year,
   change_type, is_extant, notes, photo_id, created, updated)
VALUES
  (?, ?, ?, ?, ?, ?, 'Original', ?, ?, ?, ?, ?)
"""


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Seed map_markers from shelters.json.")
    p.add_argument("--db", default=str(DEFAULT_DB), help="SQLite database path.")
    p.add_argument("--json", dest="json_path", default=str(DEFAULT_JSON), help="shelters.json path.")
    p.add_argument("--dry-run", action="store_true", help="Report what would be inserted without writing.")
    return p


def main() -> int:
    args = build_parser().parse_args()

    shelters: list[dict] = json.loads(Path(args.json_path).read_text())

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    try:
        existing_shelter_ids: set[int] = {
            row[0] for row in con.execute("SELECT DISTINCT shelter_id FROM map_markers")
        }

        inserted = skipped_no_coords = skipped_existing = failed = 0

        for s in shelters:
            lat = s.get("latitude")
            lon = s.get("longitude")
            if lat is None or lon is None:
                skipped_no_coords += 1
                continue

            shelter_id: int = s["id"]
            if shelter_id in existing_shelter_ids:
                skipped_existing += 1
                continue

            photo_id = s.get("default_photo_id") or None
            notes = s.get("notes") or ""
            is_extant = s.get("is_extant") or 0
            today = date.today().isoformat()
            created = s.get("created") or today
            updated = s.get("updated") or today

            params = (
                shelter_id,
                lat,
                lon,
                s["name"],
                s["start_year"],
                s.get("end_year"),
                is_extant,
                notes,
                photo_id,
                created,
                updated,
            )

            if args.dry_run:
                print(f"  [dry-run] would insert shelter_id={shelter_id} name={s['name']!r}")
                inserted += 1
                continue

            try:
                con.execute(INSERT_SQL, params)
                inserted += 1
            except sqlite3.Error as exc:
                print(f"  ERROR shelter_id={shelter_id}: {exc}", file=sys.stderr)
                failed += 1

        if not args.dry_run:
            con.commit()

    finally:
        con.close()

    label = "would insert" if args.dry_run else "inserted"
    print(
        f"{label}: {inserted}  |  skipped (no coords): {skipped_no_coords}"
        f"  |  skipped (already exists): {skipped_existing}  |  failed: {failed}"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
