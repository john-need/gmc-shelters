from __future__ import annotations

import json
from pathlib import Path

from scripts.lib.photo_models import GallerySlide
from scripts.lib.photo_repository import PhotoRepository


def load_placeholder_manifest(manifest_path: Path | str) -> dict:
    payload = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    if not payload.get("published_image_url"):
        raise ValueError("placeholder manifest must include published_image_url")
    return payload


def build_gallery_payload(repository: PhotoRepository, shelter_slug: str, placeholder_manifest_path: Path | str) -> dict:
    slides = repository.list_gallery_slides(shelter_slug)
    if slides:
        return {
            "shelter_slug": shelter_slug,
            "navigation_enabled": len(slides) > 1,
            "fallback_mode": "gallery",
            "slides": [slide.to_dict() for slide in slides],
        }

    default_slide = repository.get_default_fallback_slide(shelter_slug)
    if default_slide is not None:
        return {
            "shelter_slug": shelter_slug,
            "navigation_enabled": False,
            "fallback_mode": "default-image",
            "slides": [default_slide.to_dict()],
        }

    placeholder = load_placeholder_manifest(placeholder_manifest_path)
    shelter_name = repository.get_shelter_name(shelter_slug)
    placeholder_slide = GallerySlide(
        photo_id=None,
        wp_attachment_id=None,
        image_url=placeholder["published_image_url"],
        alt_text=placeholder.get("alt_text") or f"{shelter_name} image unavailable",
        caption=None,
        credit=None,
        is_fallback=True,
    )
    return {
        "shelter_slug": shelter_slug,
        "navigation_enabled": False,
        "fallback_mode": "site-placeholder",
        "slides": [placeholder_slide.to_dict()],
    }

