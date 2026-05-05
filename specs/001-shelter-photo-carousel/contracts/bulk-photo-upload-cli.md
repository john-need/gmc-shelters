# Contract: Bulk Photo Upload CLI

## Command
`python3 scripts/import_shelter_photos.py`

## Purpose
Read shelter photo rows from `database/gmc_shelters.sqlite`, upload missing source images to WordPress media, reuse previously managed assets when the same source-image identity is encountered again, upsert canonical photo-to-asset links, and emit a complete uploaded/skipped/failed run summary.

## Ownership boundary
- This repository owns the CLI behavior, SQLite audit state, duplicate-detection rules, and validation guidance.
- WordPress is the remote media target.
- Any final shelter post template or theme code that consumes uploaded assets may live outside this repository and must validate against the repo-owned gallery contract.

## Inputs
### Required flags
- `--db <absolute-path>`: SQLite database path.
- `--base-url <https-url>`: WordPress base URL.
- `--username <string>`: WordPress username for REST auth.
- `--app-password <string>`: WordPress application password.

### Authentication contract
- The CLI authenticates to WordPress REST endpoints with Basic authentication derived from `--username` and `--app-password`.
- Authentication failures are treated as run-level failures and stop processing before per-item work begins.

### Optional filters
- `--shelter <slug>`: Process one shelter only.
- `--photo-id <integer>`: Process one photo row only.
- `--limit <integer>`: Cap processed rows for test runs.
- `--dry-run`: Resolve actions without mutating WordPress or SQLite state.
- `--format <human|json>`: Output formatter. Default: `human`.

## Selection rules
1. Load candidate photo rows from `photos` joined to `shelters`.
2. Ignore rows with blank file paths or `show_on_web = 0` shelters.
3. Resolve each `file_name` relative to the repository root.
4. Normalize the repository-relative source path and compute `source_sha256` for readable files.
5. Use the normalized path for traceability and `source_sha256` as the reusable source-image identity for de-duplication.

## Behavior contract
For each selected photo row:
1. If the local file is unreadable or missing, emit `failed` and do not create a managed asset or photo link.
2. If the current run or prior registry already contains a displayable managed asset for the same `source_sha256`, emit `skipped`, reuse that managed asset, and upsert the canonical `photo_id -> asset_id` link without creating a duplicate WordPress attachment.
3. Otherwise upload the file to `POST /wp-json/wp/v2/media`.
4. After upload, patch attachment metadata as available.
5. Persist exactly one managed asset per uploaded `source_sha256`.
6. Persist or update exactly one current photo link per `photo_id` so reruns do not create duplicate shelter-photo associations.
7. Record one run-item outcome per processed photo row: `uploaded`, `skipped`, or `failed`.
8. In apply mode, append audit rows to `photo_upload_runs` and `photo_upload_run_items`.

## Duplicate-detection and idempotency rules
- The first successful encounter with a new `source_sha256` may create one WordPress attachment.
- Subsequent rows in the same run that resolve to the same `source_sha256` are `skipped`, not re-uploaded.
- Later runs that encounter the same `source_sha256` are also `skipped` unless the prior asset is explicitly missing or failed and is being repaired.
- Reprocessing the same `photo_id` updates the existing photo-link verification metadata instead of inserting a second association row.
- A successful rerun must produce zero duplicate WordPress media entries and zero duplicate photo-link rows for already managed images.

## Output contract
### Human output
- Stream one line per processed item.
- End with a single summary block containing:
  - requested
  - uploaded
  - skipped
  - failed
  - run id when not dry-run

### JSON output
```json
{
  "run_id": 42,
  "mode": "apply",
  "target_base_url": "https://gmcburlington.org",
  "requested": 4,
  "uploaded": 1,
  "skipped": 2,
  "failed": 1,
  "items": [
    {
      "photo_id": 6007,
      "shelter_slug": "aeolus-view-camp",
      "source_rel_path": "shelters/aeolus-view-camp/gmc-shelters_aeolus-view-camp_aeolus-view-camp.png",
      "source_sha256": "abc123...",
      "outcome": "skipped",
      "wp_attachment_id": 12345,
      "reason": "duplicate-source-identity"
    }
  ]
}
```

## Exit codes
- `0`: Run completed, including runs with per-item failures already reported in output.
- `1`: Run-level failure before item processing completes, such as invalid auth, database open failure, or malformed arguments.

## Side effects
- Creates or updates `photo_managed_assets` records.
- Creates or updates `photo_asset_links` records for successful or reused photo rows.
- Appends a `photo_upload_runs` row for each apply execution.
- Appends one `photo_upload_run_items` row per processed photo record.
- Does not create duplicate WordPress attachments for assets already represented by a valid managed-asset record.

## Validation guidance
1. Dry-run a known shelter and confirm no SQLite or WordPress mutations occur.
2. Apply the import once and confirm missing media uploads produce `uploaded` results.
3. Re-run the same input and confirm previously managed items are `skipped` with no new attachments created.
4. Include at least one duplicate-source case and confirm later rows are `skipped` while still linked to the existing managed asset.
5. Include at least one unreadable file and confirm it is `failed` without stopping remaining rows.
