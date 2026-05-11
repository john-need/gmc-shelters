# Quickstart: Shelter Photo Carousel and Bulk Upload

## Purpose
Use this guide to validate the repository-owned upload workflow, gallery contracts, fallback precedence, and rerun-safe behavior. The repository owns the CLI, SQLite state, contracts, and validation guidance; the final shelter post template may live outside this repository.

## Prerequisites
- Python 3.11+
- `requests` available in the active Python environment
- Repository checked out at `/Users/johnneed/Projects/gmc-shelters`
- WordPress account with permission to upload media and an application password
- Network access to `https://gmcburlington.org`

## 1. Verify repository source data
```zsh
cd /Users/johnneed/Projects/gmc-shelters
sqlite3 -header -column database/gmc_shelters.sqlite "SELECT count(*) AS shelters, (SELECT count(*) FROM photos) AS photos, (SELECT count(*) FROM shelters WHERE default_photo_id IS NOT NULL AND default_photo_id > 0) AS usable_default_photo_refs FROM shelters;"
```

Expected current scale:
- 265 shelters
- 2,969 photo rows
- 0 currently usable positive `default_photo_id` values, so the site-wide placeholder is expected to be the common zero-slide fallback until valid defaults are introduced

## 2. Validate the placeholder manifest before gallery handoff
```zsh
cd /Users/johnneed/Projects/gmc-shelters
cat specs/001-shelter-photo-carousel/site-placeholder.json
```

Validate:
- `source_rel_path` points to the repository-owned fallback source image.
- `published_image_url` is set to the final approved public URL before production handoff.
- `alt_text` is suitable for a site-wide missing-image fallback.

## 3. Export and validate a shelter gallery payload
```zsh
cd /Users/johnneed/Projects/gmc-shelters
python3 scripts/export_shelter_gallery_view.py \
  --db /Users/johnneed/Projects/gmc-shelters/database/gmc_shelters.sqlite \
  --shelter aeolus-view-camp \
  --validate
```

Validate:
- The payload contains only shelter-scoped slides.
- Captions and photographer credits appear when available.
- Single-slide galleries disable navigation.
- Zero-slide shelters resolve shelter default first, then the site placeholder.

## 4. Dry-run a small shelter import
```zsh
cd /Users/johnneed/Projects/gmc-shelters
python3 scripts/import_shelter_photos.py \
  --db /Users/johnneed/Projects/gmc-shelters/database/gmc_shelters.sqlite \
  --base-url https://gmcburlington.org \
  --username "$WP_USERNAME" \
  --app-password "$WP_APP_PASSWORD" \
  --shelter aeolus-view-camp \
  --dry-run \
  --format json
```

Validate:
- No WordPress media is created.
- No SQLite audit or link tables are mutated.
- Output predicts per-photo outcomes as `uploaded`, `skipped`, or `failed`.
- Duplicate-source rows, if present, are identified for reuse instead of re-upload.

## 5. Apply the import for the same shelter
```zsh
cd /Users/johnneed/Projects/gmc-shelters
python3 scripts/import_shelter_photos.py \
  --db /Users/johnneed/Projects/gmc-shelters/database/gmc_shelters.sqlite \
  --base-url https://gmcburlington.org \
  --username "$WP_USERNAME" \
  --app-password "$WP_APP_PASSWORD" \
  --shelter aeolus-view-camp \
  --format human
```

Validate:
- Missing media uploads are reported as `uploaded`.
- Existing managed assets or duplicate-source identities are reported as `skipped`.
- Failures do not stop remaining rows.
- Apply mode writes run-audit rows and photo-to-asset links.

## 6. Re-run to verify idempotency
```zsh
cd /Users/johnneed/Projects/gmc-shelters
python3 scripts/import_shelter_photos.py \
  --db /Users/johnneed/Projects/gmc-shelters/database/gmc_shelters.sqlite \
  --base-url https://gmcburlington.org \
  --username "$WP_USERNAME" \
  --app-password "$WP_APP_PASSWORD" \
  --shelter aeolus-view-camp \
  --format json
```

Validate:
- Previously uploaded rows are reported as `skipped`.
- Same-run duplicates use `duplicate-source-identity`.
- Later reruns use `already-managed-asset`.
- No duplicate WordPress media entries are created.
- No duplicate photo-to-asset association rows are created for the same `photo_id`.
- Summary totals still account for every processed row.

## 7. Validate mixed valid/unavailable photo behavior
Use either a fixture database or a controlled test shelter with at least one valid uploaded photo and at least one unreadable or unavailable photo reference.

Validate:
- Every valid uploaded photo appears in `slides[]`.
- Unavailable photos are omitted rather than rendered as broken slides.
- `fallback_mode` remains `gallery` if one or more valid slides remain.

## 8. Validate zero-slide fallback precedence
Check a shelter with no displayable uploaded photos.

Validate:
1. If a usable positive `default_photo_id` resolves to a displayable image, the payload returns `fallback_mode = default-image`.
2. Otherwise the payload returns `fallback_mode = site-placeholder`.
3. Navigation is disabled for both fallback cases.

## 9. Hand off the contract to the external template consumer
Provide the following files to whoever maintains the shelter post template if that code remains outside this repository:
- `specs/001-shelter-photo-carousel/plan.md`
- `specs/001-shelter-photo-carousel/contracts/shelter-gallery-view-model.md`
- `specs/001-shelter-photo-carousel/contracts/bulk-photo-upload-cli.md`
- `specs/001-shelter-photo-carousel/quickstart.md`

## 10. Review run history
```zsh
cd /Users/johnneed/Projects/gmc-shelters
sqlite3 -header -column database/gmc_shelters.sqlite "SELECT id, mode, requested_count, uploaded_count, skipped_count, failed_count, status FROM photo_upload_runs ORDER BY id DESC LIMIT 10;"
```

Validate:
- Each apply run has a complete uploaded/skipped/failed summary.
- Runs with individual item failures still finish as `completed_with_failures`.
- Repeated runs show skip-heavy behavior rather than duplicate uploads.
