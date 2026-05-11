# Implementation Plan: Google Drive Photo Deploy

**Branch**: `001-gdrive-photo-sharing` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/001-gdrive-photo-deploy/spec.md`

## Summary

Deploy script (`scripts/deploy_to_drive.py`) that uploads photos from `dist/{slug}/` to a shared Google Drive folder, captures each photo's Drive file ID, and writes those IDs back into `dist/shelter-manifest.json` so the WordPress plugin can locate and download photos. The script is idempotent: existing Drive files are skipped and their IDs resolved by name-match; exponential back-off handles API rate limits.

## Technical Context

**Language/Version**: Python 3.12  
**Primary Dependencies**: `google-api-python-client>=2.0.0`, `google-auth-oauthlib>=1.0.0`, `google-auth-httplib2>=0.2.0`  
**Storage**: Local filesystem (`dist/`) + Google Drive (remote)  
**Testing**: Manual integration test against Drive (no unit test framework required for a deploy script)  
**Target Platform**: macOS / developer workstation (local CLI script)  
**Project Type**: CLI tool / data pipeline script  
**Performance Goals**: Complete full deploy of ~257 shelters without quota exhaustion; back-off handles rate limits automatically  
**Constraints**: Drive API quotas (~10 req/s); must be idempotent; OAuth credentials must not be committed  
**Scale/Scope**: ~257 shelter slugs, estimated 500–1500 photos total

## Constitution Check

Constitution is an unpopulated template — no enforced gates. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-gdrive-photo-deploy/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (via /speckit-tasks)
```

### Source Code (repository root)

```text
scripts/
├── deploy_to_drive.py             ← NEW: main deploy script
├── requirements-drive-deploy.txt  ← NEW: Drive API dependencies
└── requirements-web-scrape.txt    ← existing (unchanged)

dist/
├── shelter-manifest.json   ← updated in-place (driveFileId added, fileName normalised)
└── {slug}/                 ← existing photo files (read-only input)
    └── *.jpg | *.webp | *.png

credentials.json    ← OAuth2 Desktop App credentials (gitignored, not committed)
token.json          ← OAuth2 token cache (gitignored, auto-created on first run)
```

**Structure Decision**: Single-script CLI tool. No `src/` package structure needed. Follows the existing pattern of standalone Python scripts under `scripts/`. No test directory required — correctness validated by running against Drive directly (integration by design).

## Complexity Tracking

No constitution violations. Table not applicable.

---

## Implementation Notes (for /speckit-tasks)

### Core algorithm (per shelter)

1. For each shelter slug in manifest:
   a. Resolve or create the Drive subfolder for this slug (cache folder IDs to avoid duplicate lookups).
   b. Fetch the full file listing for the subfolder in one `files.list` call → build `name → id` dict.
   c. For each photo entry in the manifest:
      - Compute bare `fileName` (strip any path prefix).
      - If `fileName` in the Drive index → record existing `driveFileId`, mark skipped.
      - Else → upload file via `MediaFileUpload`, record new `driveFileId`, mark uploaded.
   d. Write `driveFileId` and normalised `fileName` back to the manifest entry in memory.

2. After all shelters: write updated manifest to `dist/shelter-manifest.json`, then update (or create) `shelter-manifest.json` on Drive in-place.

3. Print summary: shelters processed, photos uploaded, photos skipped, failures, missing-local warnings.

### Key API calls

| Operation | API method | Notes |
|-----------|-----------|-------|
| List folder contents | `files().list(q="'{id}' in parents and trashed=false", fields="files(id,name)")` | Called once per shelter subfolder |
| Create subfolder | `files().create(body={name, mimeType:'application/vnd.google-apps.folder', parents:[root_id]})` | Only if subfolder doesn't exist |
| Upload photo | `files().create(body={name, parents:[subfolder_id]}, media_body=MediaFileUpload(path, mimetype))` | Skip if name exists |
| Update manifest | `files().update(fileId=manifest_id, media_body=MediaFileUpload(path, 'application/json'))` | Preserves file ID |
| Create manifest | `files().create(body={name:'shelter-manifest.json', parents:[root_id]}, media_body=...)` | First run only |

All `.execute()` calls use `num_retries=5` for automatic exponential back-off.

### Auth setup (one-time)

```
1. Create a Google Cloud project
2. Enable Drive API
3. Create OAuth 2.0 Desktop App credentials
4. Download as credentials.json to project root
5. Run script — browser opens for consent, token.json created
```

### `.gitignore` additions required

```
credentials.json
token.json
```
