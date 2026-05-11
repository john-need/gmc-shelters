from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable


def utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def connect_db(db_path: Path | str) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path))
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def apply_migrations(connection: sqlite3.Connection, migrations_dir: Path | str) -> None:
    for migration_path in sorted(Path(migrations_dir).glob("*.sql")):
        connection.executescript(migration_path.read_text(encoding="utf-8"))
    connection.commit()


def create_upload_run(connection: sqlite3.Connection, mode: str, target_base_url: str, requested_count: int) -> int:
    cursor = connection.execute(
        """
        INSERT INTO photo_upload_runs (
            started_at,
            mode,
            target_base_url,
            requested_count,
            uploaded_count,
            skipped_count,
            failed_count,
            status
        ) VALUES (?, ?, ?, ?, 0, 0, 0, 'running')
        """,
        (utc_now(), mode, target_base_url, requested_count),
    )
    connection.commit()
    return int(cursor.lastrowid)


def complete_upload_run(connection: sqlite3.Connection, run_id: int, uploaded: int, skipped: int, failed: int) -> None:
    status = "completed_with_failures" if failed else "completed"
    connection.execute(
        """
        UPDATE photo_upload_runs
        SET finished_at = ?, uploaded_count = ?, skipped_count = ?, failed_count = ?, status = ?
        WHERE id = ?
        """,
        (utc_now(), uploaded, skipped, failed, status, run_id),
    )
    connection.commit()


def mark_upload_run_failed(connection: sqlite3.Connection, run_id: int) -> None:
    connection.execute(
        "UPDATE photo_upload_runs SET finished_at = ?, status = 'failed' WHERE id = ?",
        (utc_now(), run_id),
    )
    connection.commit()


def get_managed_asset_by_sha(connection: sqlite3.Connection, source_sha256: str):
    return connection.execute(
        "SELECT * FROM photo_managed_assets WHERE source_sha256 = ?",
        (source_sha256,),
    ).fetchone()


def is_displayable_asset(asset_row: sqlite3.Row | None) -> bool:
    if asset_row is None:
        return False
    return (
        asset_row["status"] == "uploaded"
        and asset_row["wp_attachment_id"] is not None
        and bool(asset_row["wp_media_url"])
    )


def upsert_managed_asset(
    connection: sqlite3.Connection,
    *,
    source_sha256: str,
    canonical_source_rel_path: str,
    mime_type: str,
    byte_size: int,
    status: str,
    wp_attachment_id: int | None = None,
    wp_media_url: str | None = None,
    title: str | None = None,
    alt_text: str | None = None,
) -> int:
    existing = get_managed_asset_by_sha(connection, source_sha256)
    timestamp = utc_now()
    if existing:
        connection.execute(
            """
            UPDATE photo_managed_assets
            SET canonical_source_rel_path = ?,
                mime_type = ?,
                byte_size = ?,
                wp_attachment_id = ?,
                wp_media_url = ?,
                title = ?,
                alt_text = ?,
                status = ?,
                uploaded_at = CASE WHEN ? = 'uploaded' THEN COALESCE(uploaded_at, ?) ELSE uploaded_at END,
                last_verified_at = ?
            WHERE id = ?
            """,
            (
                existing["canonical_source_rel_path"] or canonical_source_rel_path,
                mime_type,
                byte_size,
                wp_attachment_id,
                wp_media_url,
                title,
                alt_text,
                status,
                status,
                timestamp,
                timestamp,
                existing["id"],
            ),
        )
        connection.commit()
        return int(existing["id"])

    cursor = connection.execute(
        """
        INSERT INTO photo_managed_assets (
            source_sha256,
            canonical_source_rel_path,
            mime_type,
            byte_size,
            wp_attachment_id,
            wp_media_url,
            title,
            alt_text,
            status,
            uploaded_at,
            last_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source_sha256,
            canonical_source_rel_path,
            mime_type,
            byte_size,
            wp_attachment_id,
            wp_media_url,
            title,
            alt_text,
            status,
            timestamp if status == "uploaded" else None,
            timestamp,
        ),
    )
    connection.commit()
    return int(cursor.lastrowid)


def touch_managed_asset(connection: sqlite3.Connection, asset_id: int) -> None:
    connection.execute(
        "UPDATE photo_managed_assets SET last_verified_at = ? WHERE id = ?",
        (utc_now(), asset_id),
    )
    connection.commit()


def upsert_photo_link(
    connection: sqlite3.Connection,
    *,
    photo_id: int,
    asset_id: int,
    observed_source_rel_path: str,
) -> None:
    timestamp = utc_now()
    existing = connection.execute(
        "SELECT id FROM photo_asset_links WHERE photo_id = ?",
        (photo_id,),
    ).fetchone()
    if existing:
        connection.execute(
            """
            UPDATE photo_asset_links
            SET asset_id = ?, observed_source_rel_path = ?, last_verified_at = ?
            WHERE photo_id = ?
            """,
            (asset_id, observed_source_rel_path, timestamp, photo_id),
        )
    else:
        connection.execute(
            """
            INSERT INTO photo_asset_links (photo_id, asset_id, observed_source_rel_path, linked_at, last_verified_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (photo_id, asset_id, observed_source_rel_path, timestamp, timestamp),
        )
    connection.commit()


def record_run_item(
    connection: sqlite3.Connection,
    *,
    run_id: int,
    photo_id: int,
    asset_id: int | None,
    source_sha256: str | None,
    outcome: str,
    reason: str | None,
    wp_attachment_id: int | None,
) -> None:
    connection.execute(
        """
        INSERT INTO photo_upload_run_items (
            run_id,
            photo_id,
            asset_id,
            source_sha256,
            outcome,
            reason,
            wp_attachment_id,
            processed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (run_id, photo_id, asset_id, source_sha256, outcome, reason, wp_attachment_id, utc_now()),
    )
    connection.commit()

