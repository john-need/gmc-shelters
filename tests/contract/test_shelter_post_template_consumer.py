from __future__ import annotations

import json

import pytest

from scripts.lib.photo_repository import PhotoRepository
from scripts.lib.shelter_gallery_consumer_validator import validate_gallery_case
from scripts.lib.shelter_gallery_service import ShelterGalleryService


@pytest.fixture
def gallery_repository(migrated_connection, insert_uploaded_asset):
    insert_uploaded_asset(1001, "sha-alpha-1", "shelters/alpha-camp/alpha-1.jpg", 101, "https://example.org/a1.jpg")
    insert_uploaded_asset(1002, "sha-alpha-2", "shelters/alpha-camp/alpha-2.jpg", 102, "https://example.org/a2.jpg")
    insert_uploaded_asset(2001, "sha-beta-1", "shelters/beta-camp/beta-1.jpg", 201, "https://example.org/b1.jpg")
    return PhotoRepository(migrated_connection)


def test_gallery_payload_matches_reference_consumer_cases(gallery_repository, consumer_cases_path, placeholder_manifest_path):
    service = ShelterGalleryService(gallery_repository, placeholder_manifest_path)
    cases = json.loads(consumer_cases_path.read_text(encoding="utf-8"))

    for case in cases:
        payload = service.build_gallery_payload(case["shelter_slug"])
        validate_gallery_case(payload, case)

