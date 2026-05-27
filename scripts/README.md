# Repository automation

## Shelter file size audit

- `python3 scripts/check_shelter_file_sizes.py [--root /absolute/path/to/shelters] [--dry-run] [--format human|json]`
  - Scans every file under `shelters/` by default.
  - Resizes supported raster images larger than 50MB down to 49MB or smaller.
  - Reports oversized non-image files and any oversized images it could not reduce.
  - Accepts `--max-bytes` and `--target-bytes` overrides for testing or one-off runs.

## Shelter photo carousel and bulk upload

- `python3 scripts/export_shelter_gallery_view.py --db /absolute/path/to/database/gmc_shelters.sqlite --shelter <slug> --validate`
  - Exports the repository-owned shelter gallery payload.
  - Validates the payload against the consumer rules before handoff.
- `python3 scripts/import_shelter_photos.py --db /absolute/path/to/database/gmc_shelters.sqlite --base-url https://gmcburlington.org --username "$WP_USERNAME" --app-password "$WP_APP_PASSWORD" --shelter <slug> [--dry-run] [--format human|json]`
  - Uploads missing shelter images to WordPress.
  - Reuses managed assets by `source_sha256` on same-run and later reruns.
  - Writes SQLite run history, managed assets, and photo links in apply mode.

## Export dist package

The in-app **Export** button (header bar) supersedes `build_dist_package.py` + manual zip.
Click Export, select a destination folder, and the app writes `gmc-shelters-export-YYYYMMDD.zip`
there. See `specs/008-export-dist-zip/quickstart.md` for operator steps.

> **Note**: `build_dist_package.py` / `build_shelter_manifest.py` are kept for reference but
> `manifest_db.py` queries the deprecated `timelines` table (dropped in migration 004) and will
> fail against the current schema. Use the in-app Export for current exports.

## Existing shelter list conversion

Convert `sheleter-list.xlsx` to slug-keyed JSON.

```zsh
/Users/johnneed/Projects/gmc-shelters/scripts/convert-shelter-list.sh
```

```zsh
/Users/johnneed/Projects/gmc-shelters/scripts/convert-shelter-list.sh \
  --input /Users/johnneed/Projects/gmc-shelters/sheleter-list.xlsx \
  --output /Users/johnneed/Projects/gmc-shelters/shelter-list.json
```
