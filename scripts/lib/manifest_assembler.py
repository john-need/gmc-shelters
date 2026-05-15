from __future__ import annotations

import re
import sys
from pathlib import Path


# ---------------------------------------------------------------------------
# camelCase conversion
# ---------------------------------------------------------------------------

def _to_camel(name: str) -> str:
    return re.sub(r"_([a-z])", lambda m: m.group(1).upper(), name)


def convert_keys(obj: object) -> object:
    """Recursively convert dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {_to_camel(k): convert_keys(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_keys(item) for item in obj]
    return obj


# ---------------------------------------------------------------------------
# Map marker assembly
# ---------------------------------------------------------------------------

def _build_map_markers(shelter: dict, timelines: list[dict]) -> list[dict]:
    shelter_timelines = sorted(
        [t for t in timelines if t["shelter_id"] == shelter["id"]],
        key=lambda t: t["year"],
    )
    is_extant = shelter["is_extant"] == 1

    def _stub(name, lat, lon, notes, start, end, marker_id=None) -> dict:
        return {
            "id": marker_id,
            "name": name,
            "latitude": lat,
            "longitude": lon,
            "notes": notes,
            "shelter_id": shelter["id"],
            "startYear": start,
            "endYear": end,
            "slug": shelter["slug"],
            "default_photo_id": shelter["default_photo_id"],
            "is_extant": is_extant,
        }

    if not shelter_timelines:
        return [_stub(
            shelter["name"], shelter["latitude"], shelter["longitude"],
            None, shelter["start_year"], shelter["end_year"],
        )]

    n = len(shelter_timelines)
    markers = []
    for i, tl in enumerate(shelter_timelines):
        end_year = shelter_timelines[i + 1]["year"] - 1 if i < n - 1 else shelter["end_year"]
        markers.append(_stub(
            tl["name"], tl["latitude"], tl["longitude"],
            tl.get("notes"), tl["year"], end_year, tl["id"],
        ))

    if shelter["start_year"] < shelter_timelines[0]["year"]:
        pre = _stub(
            shelter["name"], shelter["latitude"], shelter["longitude"],
            None, shelter["start_year"], shelter_timelines[0]["year"] - 1,
        )
        markers = [pre] + markers

    return markers


# ---------------------------------------------------------------------------
# Photo validation
# ---------------------------------------------------------------------------

def _valid_photo_names(shelter_id: int, photos: list[dict], root: Path) -> set[str]:
    valid: set[str] = set()
    for p in photos:
        if p["shelter_id"] != shelter_id or not p.get("include_in_post"):
            continue
        if (root / p["file_name"]).exists():
            valid.add(p["file_name"])
        else:
            print(f"\033[31mWarning: Photo not found: {p['file_name']} -- skipping\033[0m", file=sys.stderr)
    return valid


# ---------------------------------------------------------------------------
# Shelter assembly
# ---------------------------------------------------------------------------

def assemble_shelter(
    shelter_raw: dict,
    timelines: list[dict],
    photos: list[dict],
    content: str,
    description: str,
    root: Path,
) -> dict:
    """Return a complete shelter dict (snake_case) ready for camelCase conversion."""
    s = dict(shelter_raw)

    # Extant shelters with end_year=0 should have end_year=null
    if s.get("is_extant") == 1 and s.get("end_year") == 0:
        s["end_year"] = None

    valid_names = _valid_photo_names(s["id"], photos, root)

    shelter_photos = [
        {k: v for k, v in p.items() if k != "include_in_post"}
        for p in photos
        if p["shelter_id"] == s["id"]
        and p.get("include_in_post") == 1
        and p["file_name"] in valid_names
    ]

    result = {k: v for k, v in s.items() if k not in ("post_file", "show_on_web")}
    result["is_extant"] = s["is_extant"] == 1
    result["is_gmc"] = s["is_gmc"] == 1
    result["map_markers"] = _build_map_markers(s, timelines)
    result["photos"] = shelter_photos
    result["description"] = description
    result["content"] = content

    return result
