# Research: Google Drive Photo Deploy

**Date**: 2026-05-10  
**Feature**: `specs/001-gdrive-photo-deploy/spec.md`

---

## Decision 1: Google Drive API Client Library

**Decision**: `google-api-python-client` + `google-auth-oauthlib`

**Rationale**: The official Google client library for Python. Provides the Drive v3 API surface (`files.list`, `files.create`, `files.update`), built-in OAuth2 flow helpers, and a `num_retries` parameter on every `.execute()` call that implements exponential back-off automatically.

**Alternatives considered**:
- `PyDrive2` — higher-level wrapper but adds abstraction over Drive v3 that makes fine-grained control (update-in-place, MIME type handling) harder.
- `gdrive` CLI — good for manual use but subprocess orchestration from Python is fragile for 1000s of files.
- Google Sheets + Apps Script — useful for one-off ID dumps but not scriptable from Python.

**New dependencies to add to `scripts/requirements-drive-deploy.txt`**:
```
google-api-python-client>=2.0.0
google-auth-oauthlib>=1.0.0
google-auth-httplib2>=0.2.0
```

---

## Decision 2: OAuth2 Scope

**Decision**: `https://www.googleapis.com/auth/drive`

**Rationale**: The target folder is a shared folder not created by our OAuth application, so `drive.file` scope (which only grants access to files the app created) is insufficient. Full `drive` scope is needed to: (1) list existing files in the shared folder, (2) create subfolders and upload photos, (3) update the manifest file in place.

**Alternatives considered**:
- `drive.file` only — would work for new uploads but cannot list or update files not created by the app. Breaks idempotency.
- `drive.readonly` + `drive.file` — still can't update a manifest uploaded by a different session.

**Auth flow**:
1. Place `credentials.json` (OAuth 2.0 Desktop App credentials from Google Cloud Console) in project root.
2. On first run, browser opens for user consent; token cached to `token.json`.
3. Subsequent runs use `token.json` (auto-refreshed if expired).
4. Both files should be in `.gitignore`.

---

## Decision 3: Idempotency Strategy — Pre-fetch Folder Index

**Decision**: Before processing each shelter slug, call `files.list` once to fetch all files in the Drive subfolder, building a `name → file_id` dict. Use dict lookup (O(1)) for every photo rather than per-photo API calls.

**Rationale**: With up to ~20 photos per shelter × 257 shelters, a per-file `files.list` check would issue ~5000 API calls. Pre-fetching per folder reduces this to ~257 list calls total. The folder index is built lazily (only when we start processing a shelter) and held in memory for that shelter's duration.

**Query pattern**:
```python
q = f"'{folder_id}' in parents and trashed=false"
fields = "files(id, name)"
```

---

## Decision 4: Exponential Back-off Strategy

**Decision**: Use `execute(num_retries=5)` on all Drive API calls — the built-in retry mechanism in `google-api-python-client`.

**Rationale**: `num_retries=5` triggers exponential back-off (1s, 2s, 4s, 8s, 16s) on HTTP 429 and 5xx responses. No additional retry library needed. Each `execute()` call is independently retried, so a rate-limited upload does not abort the whole run.

**Limit**: If all 5 retries are exhausted, `HttpError` is raised and caught by the per-photo error handler (FR-009), which logs and continues.

---

## Decision 5: Manifest Update In-Place

**Decision**: Use `files().update(fileId=existing_id, media_body=MediaFileUpload(...))` to update the manifest file, preserving its Drive file ID.

**Rationale**: Preserving the manifest's Drive file ID means any external bookmarks or plugin configuration referencing it by ID remain valid across re-deploys (clarified Q3).

**First-run detection**: On first deploy the manifest does not exist on Drive. Script searches for `shelter-manifest.json` in the root folder:
```python
q = f"'{root_folder_id}' in parents and name='shelter-manifest.json' and trashed=false"
```
If found: update in place. If not found: create new.

---

## Decision 6: MIME Type Detection

**Decision**: Use Python's `mimetypes.guess_type()` for photo files; use `application/json` for the manifest; use `application/vnd.google-apps.folder` for folder creation.

**Rationale**: `mimetypes` is stdlib, handles `.jpg`, `.webp`, `.png` correctly, no extra dependency.

**Fallback**: If `mimetypes.guess_type()` returns `None`, fall back to `application/octet-stream`.

---

## Decision 7: Progress Logging

**Decision**: Use Python's `logging` module at `INFO` level for normal progress and `WARNING`/`ERROR` for skips and failures. Print a per-shelter summary line.

**Rationale**: Matches the pattern in `fetch_gmc_shelter_system_api.py` which uses `print()` for progress. However `logging` is preferred for structured output and easy suppression. Consistent with the project's existing Python style — `print()` acceptable too since this is a CLI tool.

**Final choice**: `print()` for human-readable progress lines (matching existing project scripts), no external logging library.
