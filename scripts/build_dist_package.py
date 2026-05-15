#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.build_shelter_manifest import build_manifest

MANIFEST = REPO_ROOT / "shelter-manifest.json"
DIST = REPO_ROOT / "dist"


def build_dist() -> None:
    print("Cleaning dist...")
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)

    print("Building shelter manifest...")
    build_manifest()

    print("Copying manifest to dist...")
    shutil.copy(MANIFEST, DIST / MANIFEST.name)

    print("Creating shelter folders and copying photos...")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    for shelter in manifest.get("shelters", []):
        slug = shelter["slug"]
        for photo in shelter.get("photos", []):
            src = REPO_ROOT / photo["fileName"]
            if src.exists():
                dest_dir = DIST / slug
                dest_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy(src, dest_dir / src.name)

    shelter_count = len(manifest.get("shelters", []))
    print(f"Done! Built dist package at {DIST} ({shelter_count} shelters)")


if __name__ == "__main__":
    build_dist()
