from __future__ import annotations

from pathlib import Path

from scripts.lib.shelter_gallery import build_gallery_payload
from scripts.lib.shelter_gallery_consumer_validator import validate_gallery_payload
from scripts.lib.photo_repository import PhotoRepository


class ShelterGalleryService:
    def __init__(self, repository: PhotoRepository, placeholder_manifest_path: Path | str):
        self.repository = repository
        self.placeholder_manifest_path = Path(placeholder_manifest_path)

    def build_gallery_payload(self, shelter_slug: str, *, validate: bool = True) -> dict:
        payload = build_gallery_payload(self.repository, shelter_slug, self.placeholder_manifest_path)
        if validate:
            validate_gallery_payload(payload)
        return payload

