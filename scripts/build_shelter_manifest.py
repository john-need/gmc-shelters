#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.content_loader import convert_description, load_shelter_content
from scripts.lib.manifest_assembler import assemble_shelter, convert_keys
from scripts.lib.manifest_db import export_tables
from scripts.lib.manifest_validator import validate_map_markers

DB = REPO_ROOT / "database" / "gmc_shelters.sqlite"
SHELTERS_JSON = REPO_ROOT / "shelters.json"
TIMELINES_JSON = REPO_ROOT / "timelines.json"
PHOTOS_JSON = REPO_ROOT / "photos.json"
DEST = REPO_ROOT / "shelter-manifest.json"
SHELTERS_DIR = REPO_ROOT / "shelters"


def _warn(msg: str) -> None:
    print(f"\033[31mWarning: {msg}\033[0m", file=sys.stderr)


def build_manifest() -> None:
    if not DB.exists():
        print(f"Error: {DB} not found", file=sys.stderr)
        sys.exit(1)

    print("Exporting shelters from database...")
    print("Exporting timelines from database...")
    print("Exporting photos from database...")
    shelters, timelines, photos = export_tables(DB, SHELTERS_JSON, TIMELINES_JSON, PHOTOS_JSON)

    assembled: list[dict] = []
    count = 0

    for shelter in shelters:
        if not shelter.get("show_on_web"):
            continue

        slug = shelter["slug"]

        if not (SHELTERS_DIR / slug).is_dir():
            _warn(f"No folder found for shelter '{slug}' -- skipping")
            continue

        print(f"Finding photos for {slug}...")
        print(f"Populating map markers for {slug}...")

        content = load_shelter_content(slug, SHELTERS_DIR)
        if not content:
            _warn(f"Content file not found: shelters/{slug}/{slug}.md")

        description = convert_description(shelter.get("description"))
        shelter_obj = assemble_shelter(shelter, timelines, photos, content, description, REPO_ROOT)
        assembled.append(shelter_obj)
        count += 1

    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    manifest = convert_keys({"created": ts, "shelters": assembled})

    DEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Done! Built manifest with {count} shelters -> {DEST}")

    print("\nValidating mapMarkers...")
    errors = validate_map_markers(manifest)
    if not errors:
        print("Validation passed.")
    else:
        print(f"Validation found {len(errors)} shelter(s) with issues:", file=sys.stderr)
        for item in errors:
            print(f"  {item['slug']}: {'; '.join(item['errors'])}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    build_manifest()
