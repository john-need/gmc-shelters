from __future__ import annotations

import json
import sqlite3
from pathlib import Path


def export_tables(
    db_path: Path,
    shelters_path: Path,
    timelines_path: Path,
    photos_path: Path,
) -> tuple[list[dict], list[dict], list[dict]]:
    """Query shelters, timelines, and photos from SQLite, write JSON files, return all three lists."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        shelters = [dict(r) for r in conn.execute("SELECT * FROM shelters ORDER BY id")]
        timelines = [dict(r) for r in conn.execute("SELECT * FROM timelines ORDER BY id")]
        photos = [dict(r) for r in conn.execute("SELECT * FROM photos ORDER BY id")]
    finally:
        conn.close()

    shelters_path.write_text(json.dumps(shelters, indent=2, ensure_ascii=False), encoding="utf-8")
    timelines_path.write_text(json.dumps(timelines, indent=2, ensure_ascii=False), encoding="utf-8")
    photos_path.write_text(json.dumps(photos, indent=2, ensure_ascii=False), encoding="utf-8")

    return shelters, timelines, photos
