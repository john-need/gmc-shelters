from __future__ import annotations

from scripts.lib.photo_repository import PhotoRepository


def test_gallery_selection_filters_to_displayable_shelter_assets(migrated_connection, insert_uploaded_asset):
    insert_uploaded_asset(1001, "sha-alpha-1", "shelters/alpha-camp/alpha-1.jpg", 101, "https://example.org/a1.jpg")
    insert_uploaded_asset(1002, "sha-alpha-2", "shelters/alpha-camp/alpha-2.jpg", 102, "https://example.org/a2.jpg")
    insert_uploaded_asset(2001, "sha-beta-1", "shelters/beta-camp/beta-1.jpg", 201, "https://example.org/b1.jpg")

    migrated_connection.execute(
        """
        INSERT INTO photo_managed_assets (
            source_sha256,
            canonical_source_rel_path,
            mime_type,
            byte_size,
            wp_attachment_id,
            wp_media_url,
            status,
            uploaded_at,
            last_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            "sha-alpha-missing",
            "shelters/alpha-camp/alpha-missing.jpg",
            "image/jpeg",
            10,
            None,
            None,
            "failed",
            None,
            "2026-05-05T00:00:00Z",
        ),
    )
    missing_asset_id = migrated_connection.execute("SELECT last_insert_rowid() AS id").fetchone()["id"]
    migrated_connection.execute(
        "INSERT INTO photo_asset_links (photo_id, asset_id, observed_source_rel_path, linked_at, last_verified_at) VALUES (?, ?, ?, ?, ?)",
        (1003, missing_asset_id, "shelters/alpha-camp/alpha-missing.jpg", "2026-05-05T00:00:00Z", "2026-05-05T00:00:00Z"),
    )
    migrated_connection.commit()

    repository = PhotoRepository(migrated_connection)
    slides = repository.list_gallery_slides("alpha-camp")

    assert [slide.photo_id for slide in slides] == [1001, 1002]
    assert all(slide.image_url.startswith("https://example.org/") for slide in slides)


def test_default_photo_lookup_returns_displayable_default(migrated_connection, insert_uploaded_asset):
    insert_uploaded_asset(3001, "sha-gamma-default", "shelters/gamma-camp/gamma-default.jpg", 301, "https://example.org/gamma.jpg")

    repository = PhotoRepository(migrated_connection)
    gallery_slides = repository.list_gallery_slides("gamma-camp")
    fallback_slide = repository.get_default_fallback_slide("gamma-camp")

    assert gallery_slides == []
    assert fallback_slide is not None
    assert fallback_slide.is_fallback is True
    assert fallback_slide.image_url == "https://example.org/gamma.jpg"


def test_candidate_photo_selection_excludes_hidden_shelters(migrated_connection):
    repository = PhotoRepository(migrated_connection)

    photo_ids = [photo.photo_id for photo in repository.list_candidate_photos()]

    assert 5001 not in photo_ids
    assert 4001 in photo_ids

