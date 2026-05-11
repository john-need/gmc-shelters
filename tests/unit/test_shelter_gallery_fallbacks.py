from __future__ import annotations

from scripts.lib.photo_repository import PhotoRepository
from scripts.lib.shelter_gallery_service import ShelterGalleryService


def test_usable_shelter_default_wins_before_site_placeholder(migrated_connection, insert_uploaded_asset, placeholder_manifest_path):
    insert_uploaded_asset(3001, "sha-gamma-default", "shelters/gamma-camp/gamma-default.jpg", 301, "https://example.org/gamma.jpg")

    service = ShelterGalleryService(PhotoRepository(migrated_connection), placeholder_manifest_path)
    payload = service.build_gallery_payload("gamma-camp")

    assert payload["fallback_mode"] == "default-image"
    assert payload["navigation_enabled"] is False
    assert payload["slides"][0]["image_url"] == "https://example.org/gamma.jpg"


def test_site_placeholder_is_used_when_no_displayable_default_exists(migrated_connection, placeholder_manifest_path):
    service = ShelterGalleryService(PhotoRepository(migrated_connection), placeholder_manifest_path)
    payload = service.build_gallery_payload("delta-camp")

    assert payload["fallback_mode"] == "site-placeholder"
    assert payload["navigation_enabled"] is False
    assert payload["slides"][0]["image_url"] == "https://example.org/media/placeholder.jpg"

