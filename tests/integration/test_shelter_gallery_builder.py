from __future__ import annotations

from scripts.lib.photo_repository import PhotoRepository
from scripts.lib.shelter_gallery_service import ShelterGalleryService


def test_multi_slide_gallery_uses_only_valid_uploaded_assets(migrated_connection, insert_uploaded_asset, placeholder_manifest_path):
    insert_uploaded_asset(1001, "sha-alpha-1", "shelters/alpha-camp/alpha-1.jpg", 101, "https://example.org/a1.jpg")
    insert_uploaded_asset(1002, "sha-alpha-2", "shelters/alpha-camp/alpha-2.jpg", 102, "https://example.org/a2.jpg")

    service = ShelterGalleryService(PhotoRepository(migrated_connection), placeholder_manifest_path)
    payload = service.build_gallery_payload("alpha-camp")

    assert payload["fallback_mode"] == "gallery"
    assert payload["navigation_enabled"] is True
    assert [slide["photo_id"] for slide in payload["slides"]] == [1001, 1002]


def test_single_slide_gallery_disables_navigation(migrated_connection, insert_uploaded_asset, placeholder_manifest_path):
    insert_uploaded_asset(2001, "sha-beta-1", "shelters/beta-camp/beta-1.jpg", 201, "https://example.org/b1.jpg")

    service = ShelterGalleryService(PhotoRepository(migrated_connection), placeholder_manifest_path)
    payload = service.build_gallery_payload("beta-camp")

    assert payload["fallback_mode"] == "gallery"
    assert payload["navigation_enabled"] is False
    assert len(payload["slides"]) == 1


def test_mixed_valid_and_unavailable_photos_omit_broken_slides(migrated_connection, insert_uploaded_asset, placeholder_manifest_path):
    insert_uploaded_asset(1001, "sha-alpha-1", "shelters/alpha-camp/alpha-1.jpg", 101, "https://example.org/a1.jpg")

    service = ShelterGalleryService(PhotoRepository(migrated_connection), placeholder_manifest_path)
    payload = service.build_gallery_payload("alpha-camp")

    assert payload["fallback_mode"] == "gallery"
    assert [slide["photo_id"] for slide in payload["slides"]] == [1001]

