from __future__ import annotations

from scripts.lib.photo_db import connect_db
from scripts.lib.photo_importer import run_photo_import


def test_reruns_reuse_existing_assets_without_duplicate_links(migrated_db_path, fixture_repo, fake_wordpress_client):
    first = run_photo_import(
        db_path=migrated_db_path,
        repo_root=fixture_repo,
        base_url="https://example.org",
        wordpress_client=fake_wordpress_client,
        shelter_slug="rerun-camp",
        dry_run=False,
    )
    second = run_photo_import(
        db_path=migrated_db_path,
        repo_root=fixture_repo,
        base_url="https://example.org",
        wordpress_client=fake_wordpress_client,
        shelter_slug="rerun-camp",
        dry_run=False,
    )

    assert first.uploaded == 1
    assert first.skipped == 1
    assert second.uploaded == 0
    assert second.skipped == 2
    assert second.failed == 1
    assert len(fake_wordpress_client.upload_calls) == 1

    connection = connect_db(migrated_db_path)
    asset = connection.execute(
        "SELECT canonical_source_rel_path, source_sha256 FROM photo_managed_assets"
    ).fetchone()
    link_count = connection.execute("SELECT COUNT(*) AS count FROM photo_asset_links").fetchone()["count"]
    duplicate_link_count = connection.execute(
        "SELECT COUNT(*) AS count FROM photo_asset_links WHERE photo_id IN (4001, 4002)"
    ).fetchone()["count"]

    assert asset["canonical_source_rel_path"] == "shelters/rerun-camp/duplicate-a.jpg"
    assert link_count == 2
    assert duplicate_link_count == 2
    connection.close()

