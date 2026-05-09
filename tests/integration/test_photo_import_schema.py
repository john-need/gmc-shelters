from __future__ import annotations

from pathlib import Path

from scripts.lib.photo_db import apply_migrations, connect_db


REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"


def test_apply_migrations_creates_photo_import_tables(raw_db_path):
    connection = connect_db(raw_db_path)
    apply_migrations(connection, MIGRATIONS_DIR)

    tables = {
        row["name"]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }
    assert {
        "photo_managed_assets",
        "photo_asset_links",
        "photo_upload_runs",
        "photo_upload_run_items",
    }.issubset(tables)

    asset_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(photo_managed_assets)")
    }
    assert {"source_sha256", "canonical_source_rel_path", "wp_attachment_id", "status", "last_verified_at"}.issubset(asset_columns)

    link_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(photo_asset_links)")
    }
    assert {"photo_id", "asset_id", "observed_source_rel_path", "last_verified_at"}.issubset(link_columns)

    run_item_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(photo_upload_run_items)")
    }
    assert {"run_id", "photo_id", "asset_id", "source_sha256", "outcome", "reason"}.issubset(run_item_columns)

    indexes = {
        row["name"] for row in connection.execute("PRAGMA index_list(photo_asset_links)")
    }
    assert "idx_photo_asset_links_photo_id" in indexes or any("photo_id" in name for name in indexes)

    connection.close()

