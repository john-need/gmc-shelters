from __future__ import annotations

from scripts.lib.photo_importer import run_photo_import


def test_apply_mode_uploads_missing_files_and_persists_audit_rows(migrated_db_path, fixture_repo, fake_wordpress_client):
    summary = run_photo_import(
        db_path=migrated_db_path,
        repo_root=fixture_repo,
        base_url="https://example.org",
        wordpress_client=fake_wordpress_client,
        shelter_slug="rerun-camp",
        dry_run=False,
    )

    assert summary.run_id is not None
    assert summary.uploaded == 1
    assert summary.skipped == 1
    assert summary.failed == 1
    assert len(fake_wordpress_client.upload_calls) == 1

    from scripts.lib.photo_db import connect_db

    connection = connect_db(migrated_db_path)
    run_row = connection.execute(
        "SELECT requested_count, uploaded_count, skipped_count, failed_count, status FROM photo_upload_runs WHERE id = ?",
        (summary.run_id,),
    ).fetchone()
    assert tuple(run_row) == (3, 1, 1, 1, "completed_with_failures")

    asset_count = connection.execute("SELECT COUNT(*) AS count FROM photo_managed_assets").fetchone()["count"]
    link_count = connection.execute("SELECT COUNT(*) AS count FROM photo_asset_links").fetchone()["count"]
    item_count = connection.execute("SELECT COUNT(*) AS count FROM photo_upload_run_items WHERE run_id = ?", (summary.run_id,)).fetchone()["count"]

    assert asset_count == 1
    assert link_count == 2
    assert item_count == 3
    connection.close()

