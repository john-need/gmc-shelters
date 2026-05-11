# Feature Specification: Google Drive Photo Deploy

**Feature Branch**: `001-gdrive-photo-deploy`  
**Created**: 2026-05-10  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Initial Deploy: Upload Photos and Enrich Manifest (Priority: P1)

A developer or content maintainer runs the deploy script for the first time (or after adding new shelters). The script uploads all photos from the local `dist/` folder into matching slug-named subfolders on Google Drive, records the Drive file ID for every photo, updates `shelter-manifest.json` so each photo entry carries a `driveFileId` and a bare `fileName`, and uploads the updated manifest to the root of the Drive folder.

**Why this priority**: This is the core deliverable. Without it the WordPress plugin has no Drive file IDs to work with and cannot download any photos.

**Independent Test**: Run the script against a fresh Drive folder containing no files. Verify that every photo appears in the correct Drive subfolder, every photo entry in the uploaded manifest has a non-null `driveFileId`, and `fileName` contains only the bare filename with no path prefix.

**Acceptance Scenarios**:

1. **Given** the target Drive folder is empty and `dist/` contains photos across 257 shelter slug subfolders, **When** the deploy script runs, **Then** every photo file appears in a matching subfolder on Drive and the uploaded `shelter-manifest.json` contains `driveFileId` for every photo entry.
2. **Given** a photo entry in the manifest previously had `fileName: "shelters/aeolus-view-camp/gmc-shelters_aeolus-view-camp_img.png"`, **When** the deploy script runs, **Then** that entry's `fileName` in the output manifest is `"gmc-shelters_aeolus-view-camp_img.png"` (bare filename only).
3. **Given** the deploy script has run, **When** a `driveFileId` from the manifest is used to construct a Google Drive file URL, **Then** the URL resolves to the correct photo.

---

### User Story 2 - Idempotent Re-deploy (Priority: P2)

A developer re-runs the deploy script after the initial deploy (e.g., to verify state, after adding a handful of new photos, or after updating the manifest data). Files already present on Drive are not re-uploaded; their existing Drive file IDs are resolved and written into the manifest.

**Why this priority**: Without idempotency the script would duplicate files on Drive on every run, making the manifest IDs unreliable and consuming quota.

**Independent Test**: Run the script twice against the same Drive folder. On the second run no new files appear on Drive, the script exits without error, and the manifest still contains correct `driveFileId` values for all entries.

**Acceptance Scenarios**:

1. **Given** a photo already exists in the correct Drive subfolder, **When** the deploy script runs, **Then** no duplicate file is created and the existing file's Drive ID is written to the manifest.
2. **Given** one shelter has new photos added to `dist/` since the last deploy, **When** the deploy script runs, **Then** only the new photos are uploaded; all previously uploaded photos are skipped.

---

### User Story 3 - Partial or Error Recovery (Priority: P3)

A deploy is interrupted mid-run (network error, quota limit, Ctrl-C). On the next run the script resumes without re-uploading completed shelters, correctly resolves already-uploaded file IDs, and completes the remaining uploads.

**Why this priority**: With 257 shelters and hundreds of photos an interrupted deploy must be recoverable without starting over.

**Independent Test**: Simulate an interruption after the first 10 shelters are uploaded. Re-run the script. Verify that shelters 1–10 produce no new Drive uploads and shelters 11–257 complete normally.

**Acceptance Scenarios**:

1. **Given** an interrupted deploy left photos from 50 shelters on Drive, **When** the script is re-run, **Then** those 50 shelters are skipped (files matched by name) and the remaining shelters are uploaded.
2. **Given** a single photo fails to upload (e.g., transient network error), **When** the script encounters the error, **Then** it logs the failure and continues with remaining photos rather than aborting.

---

### Edge Cases

- What happens when a photo filename in `dist/` does not match any entry in `shelter-manifest.json`? (File uploaded to Drive but no manifest entry to update — log as a warning.)
- What happens when a manifest photo entry references a file not present in `dist/`? (Skip and log as a warning — do not set `driveFileId` for missing files.)
- What happens when two photos in the same slug folder have the same filename? (Should not occur given the naming convention, but log a warning if detected.)
- What happens when the target Drive folder does not exist or is inaccessible? (Script exits immediately with a clear error message.)
- What happens when the manifest contains photos that were uploaded in a previous run but the local manifest no longer has `driveFileId` set? (IDs should be resolved from Drive by name-matching without re-uploading.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The deploy script MUST authenticate with the Google Drive API before performing any file operations.
- **FR-002**: For each shelter slug, the script MUST create a subfolder in the target Drive folder if one does not already exist.
- **FR-003**: The script MUST upload each photo file from `dist/{slug}/` to the matching Drive subfolder.
- **FR-004**: The script MUST skip uploading a photo if a file with the same name already exists in the matching Drive subfolder.
- **FR-005**: The script MUST record the Drive file ID for every photo — whether uploaded in this run or resolved from an existing Drive file.
- **FR-006**: The script MUST update `shelter-manifest.json` so that each photo entry contains a `driveFileId` field (the Drive file ID) and a `fileName` field containing only the bare filename (no directory path prefix).
- **FR-007**: The script MUST update the existing `shelter-manifest.json` file in the root of the target Drive folder in place (preserving its Drive file ID), or upload it as a new file if it does not yet exist on Drive.
- **FR-008**: The script MUST log each action: folder creation, file upload, file skip (already exists), file ID resolution, and any errors.
- **FR-009**: The script MUST continue processing remaining photos if a single photo upload fails, logging the failure without aborting the entire run.
- **FR-010**: The script MUST write the updated manifest locally (overwriting `dist/shelter-manifest.json`) before uploading it to Drive.
- **FR-011**: The script MUST apply exponential back-off with retry for all Drive API calls that return a rate-limit or transient server error, waiting progressively longer between attempts before giving up and logging the failure.

### Key Entities

- **Shelter Slug Folder**: A directory in `dist/` named after a shelter's URL slug (e.g., `dist/battell-shelter-1/`). Contains all photo files for that shelter.
- **Photo File**: An image file (`.jpg`, `.webp`, `.png`) inside a shelter slug folder.
- **Drive File ID**: The unique identifier Google Drive assigns to every uploaded file. Appears in the file's sharing URL between `/d/` and `/view`.
- **Shelter Manifest**: `dist/shelter-manifest.json` — a JSON document listing all shelters, each with an array of `photos`. Each photo entry gains `driveFileId` (Drive file ID) and has `fileName` normalized to a bare filename.
- **Target Drive Folder**: The shared Google Drive folder (ID: `1T0w8pSSIT13y4HzNOKerIPNULjDopD45`) that mirrors the `dist/` structure.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a successful deploy, 100% of photo entries in the uploaded `shelter-manifest.json` have a non-null `driveFileId`.
- **SC-002**: After a successful deploy, 100% of photo entries in the uploaded manifest have a `fileName` that is a bare filename (no `/` characters).
- **SC-003**: Re-running the deploy script on an already-deployed Drive folder produces zero new file uploads and completes without error.
- **SC-004**: A WordPress plugin can construct a valid Google Drive download URL for any photo using only the `driveFileId` from the manifest.
- **SC-005**: The deploy script completes a full run of all 257 shelters without requiring manual intervention.
- **SC-006**: Any upload failure is surfaced in script output with enough detail (shelter slug, filename, error message) to diagnose and retry manually.
- **SC-007**: Transient Drive API errors (rate limits, server errors) are automatically retried and do not cause the deploy to fail unless all retries are exhausted.

## Clarifications

### Session 2026-05-10

- Q: Is the `order` field in photo entries in scope for the deploy script? → A: No — `order` is out of scope; the deploy script does not add or modify it.
- Q: How should Drive API rate-limit / quota errors be handled? → A: Automatic exponential back-off with retry on every rate-limit or transient error.
- Q: Should the manifest file on Drive be updated in place or replaced with a fresh upload each run? → A: Update in place — preserve the manifest's Drive file ID across deploys.
- Directive: Photos must only be uploaded to Drive if they do not already exist there — confirmed by FR-004 (skip by name match within slug subfolder).

## Assumptions

- The developer running the script has a Google account with edit access to the target Drive folder (`1T0w8pSSIT13y4HzNOKerIPNULjDopD45`).
- Authentication uses OAuth2 user credentials stored locally (a `credentials.json` from Google Cloud Console and a `token.json` cache). Service account support is out of scope for v1 but the design should not preclude it.
- The `dist/` folder structure is the authoritative source of truth for which photos to deploy; the manifest is updated to reflect what was actually uploaded.
- Photo filenames within a slug folder are unique (enforced by the existing image naming convention).
- The script is run from the project root. Paths are resolved relative to the working directory.
- The script is added at `scripts/deploy_to_drive.py` following the existing Python script convention in this project.
- Dependencies (`google-api-python-client`, `google-auth-oauthlib`) are added to a `requirements.txt` or equivalent.
- The existing `shelter-manifest.json` may already have some entries with `driveFileId` from a prior partial deploy; the script must preserve those IDs and fill in the missing ones.
- The WordPress plugin uses the Drive file ID to construct download URLs; the exact URL format is the plugin's concern and outside this script's scope.
- The `order` field on photo entries is not set or modified by the deploy script; it is managed by the upstream data pipeline.
