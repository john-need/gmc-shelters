from __future__ import annotations

from pathlib import Path

from scripts.lib.managed_asset_registry import SourceImageError, choose_canonical_source_rel_path, inspect_source_image, resolve_repo_file
from scripts.lib.photo_db import (
    apply_migrations,
    complete_upload_run,
    connect_db,
    create_upload_run,
    get_managed_asset_by_sha,
    is_displayable_asset,
    record_run_item,
    touch_managed_asset,
    upsert_managed_asset,
    upsert_photo_link,
)
from scripts.lib.photo_models import ImportItemResult, ImportSummary
from scripts.lib.photo_repository import PhotoRepository


class RunLevelError(RuntimeError):
    pass


def run_photo_import(
    *,
    db_path: Path | str,
    repo_root: Path | str,
    base_url: str,
    wordpress_client,
    shelter_slug: str | None = None,
    photo_id: int | None = None,
    limit: int | None = None,
    dry_run: bool = False,
) -> ImportSummary:
    repo_root = Path(repo_root)
    connection = connect_db(db_path)
    migrations_dir = Path(__file__).resolve().parents[2] / "database" / "migrations"
    apply_migrations(connection, migrations_dir)
    repository = PhotoRepository(connection)
    photos = repository.list_candidate_photos(shelter_slug=shelter_slug, photo_id=photo_id, limit=limit)

    if not dry_run:
        try:
            wordpress_client.verify_auth()
        except Exception as exc:  # pragma: no cover - covered via CLI contract
            raise RunLevelError(str(exc)) from exc

    run_id = create_upload_run(connection, "apply", base_url, len(photos)) if not dry_run else None
    seen_assets: dict[str, dict] = {}
    items: list[ImportItemResult] = []
    uploaded = skipped = failed = 0

    try:
        for photo in photos:
            source_path = resolve_repo_file(repo_root, photo.file_name)
            try:
                source = inspect_source_image(repo_root, source_path)
            except SourceImageError as exc:
                failed += 1
                item = ImportItemResult(
                    photo_id=photo.photo_id,
                    shelter_slug=photo.shelter_slug,
                    source_rel_path=photo.file_name,
                    source_sha256=None,
                    outcome="failed",
                    wp_attachment_id=None,
                    reason=str(exc),
                )
                items.append(item)
                if run_id is not None:
                    record_run_item(
                        connection,
                        run_id=run_id,
                        photo_id=photo.photo_id,
                        asset_id=None,
                        source_sha256=None,
                        outcome="failed",
                        reason=item.reason,
                        wp_attachment_id=None,
                    )
                continue

            existing_asset = seen_assets.get(source.source_sha256)
            if existing_asset is None:
                persisted = get_managed_asset_by_sha(connection, source.source_sha256)
                if is_displayable_asset(persisted):
                    existing_asset = {
                        "id": persisted["id"],
                        "wp_attachment_id": persisted["wp_attachment_id"],
                        "wp_media_url": persisted["wp_media_url"],
                        "reason": "already-managed-asset",
                    }
                    seen_assets[source.source_sha256] = existing_asset

            if existing_asset is not None:
                skipped += 1
                item = ImportItemResult(
                    photo_id=photo.photo_id,
                    shelter_slug=photo.shelter_slug,
                    source_rel_path=source.source_rel_path,
                    source_sha256=source.source_sha256,
                    outcome="skipped",
                    wp_attachment_id=existing_asset["wp_attachment_id"],
                    reason=existing_asset["reason"],
                )
                items.append(item)
                if run_id is not None:
                    touch_managed_asset(connection, int(existing_asset["id"]))
                    upsert_photo_link(
                        connection,
                        photo_id=photo.photo_id,
                        asset_id=int(existing_asset["id"]),
                        observed_source_rel_path=source.source_rel_path,
                    )
                    record_run_item(
                        connection,
                        run_id=run_id,
                        photo_id=photo.photo_id,
                        asset_id=int(existing_asset["id"]),
                        source_sha256=source.source_sha256,
                        outcome="skipped",
                        reason=existing_asset["reason"],
                        wp_attachment_id=existing_asset["wp_attachment_id"],
                    )
                continue

            if dry_run:
                uploaded += 1
                seen_assets[source.source_sha256] = {
                    "id": -photo.photo_id,
                    "wp_attachment_id": None,
                    "wp_media_url": None,
                    "reason": "duplicate-source-identity",
                }
                items.append(
                    ImportItemResult(
                        photo_id=photo.photo_id,
                        shelter_slug=photo.shelter_slug,
                        source_rel_path=source.source_rel_path,
                        source_sha256=source.source_sha256,
                        outcome="uploaded",
                        wp_attachment_id=None,
                        reason=None,
                    )
                )
                continue

            try:
                alt_text = photo.caption or photo.shelter_name
                upload = wordpress_client.upload_media(
                    Path(source.absolute_path),
                    title=photo.shelter_name,
                    alt_text=alt_text,
                    caption=photo.caption,
                )
                asset_id = upsert_managed_asset(
                    connection,
                    source_sha256=source.source_sha256,
                    canonical_source_rel_path=source.source_rel_path,
                    mime_type=source.mime_type,
                    byte_size=source.byte_size,
                    status="uploaded",
                    wp_attachment_id=int(upload["id"]),
                    wp_media_url=upload["source_url"],
                    title=photo.shelter_name,
                    alt_text=alt_text,
                )
                upsert_photo_link(
                    connection,
                    photo_id=photo.photo_id,
                    asset_id=asset_id,
                    observed_source_rel_path=source.source_rel_path,
                )
                record_run_item(
                    connection,
                    run_id=run_id,
                    photo_id=photo.photo_id,
                    asset_id=asset_id,
                    source_sha256=source.source_sha256,
                    outcome="uploaded",
                    reason=None,
                    wp_attachment_id=int(upload["id"]),
                )
                seen_assets[source.source_sha256] = {
                    "id": asset_id,
                    "wp_attachment_id": int(upload["id"]),
                    "wp_media_url": upload["source_url"],
                    "reason": "duplicate-source-identity",
                }
                uploaded += 1
                items.append(
                    ImportItemResult(
                        photo_id=photo.photo_id,
                        shelter_slug=photo.shelter_slug,
                        source_rel_path=source.source_rel_path,
                        source_sha256=source.source_sha256,
                        outcome="uploaded",
                        wp_attachment_id=int(upload["id"]),
                        reason=None,
                    )
                )
            except Exception as exc:
                failed += 1
                asset_row = get_managed_asset_by_sha(connection, source.source_sha256)
                canonical_path = choose_canonical_source_rel_path(
                    asset_row["canonical_source_rel_path"] if asset_row else None,
                    source.source_rel_path,
                )
                asset_id = upsert_managed_asset(
                    connection,
                    source_sha256=source.source_sha256,
                    canonical_source_rel_path=canonical_path,
                    mime_type=source.mime_type,
                    byte_size=source.byte_size,
                    status="failed",
                )
                record_run_item(
                    connection,
                    run_id=run_id,
                    photo_id=photo.photo_id,
                    asset_id=asset_id,
                    source_sha256=source.source_sha256,
                    outcome="failed",
                    reason=str(exc),
                    wp_attachment_id=None,
                )
                items.append(
                    ImportItemResult(
                        photo_id=photo.photo_id,
                        shelter_slug=photo.shelter_slug,
                        source_rel_path=source.source_rel_path,
                        source_sha256=source.source_sha256,
                        outcome="failed",
                        wp_attachment_id=None,
                        reason=str(exc),
                    )
                )

        if run_id is not None:
            complete_upload_run(connection, run_id, uploaded, skipped, failed)
    finally:
        connection.close()

    return ImportSummary(
        run_id=run_id,
        mode="dry-run" if dry_run else "apply",
        target_base_url=base_url,
        requested=len(photos),
        uploaded=uploaded,
        skipped=skipped,
        failed=failed,
        items=items,
    )

