# Feature Specification: Publish to Google Drive

**Feature Branch**: `009-publish-gdrive`  
**Created**: 2026-05-27  
**Status**: Draft  
**Input**: User description: "refactor 'publish to web' so that it builds dist package and then does what deploy_to_drive.py does, essentially deploying manifest, and slug folders in dist to the google drive. Use the settings found in settings page, Publishing · web output."

## Clarifications

### Session 2026-05-27

- Q: When the previous Drive manifest cannot be fetched (first publish, deleted, or network error reading it), what should the deploy do? → A: Proceed with full upload — treat every photo as needing upload (as if `updated` is always newer).
- Q: When a photo needs to be re-uploaded (newer `updated` timestamp), should the existing Drive file be updated in-place (preserving its share link) or re-uploaded as a new file (new Drive ID)? → A: Update existing Drive file in-place — same `driveFileId` retained, file content replaced, share link preserved.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One-Click Publish: Build and Deploy to Google Drive (Priority: P1)

An archive maintainer clicks "Publish to web" in the app header. The app builds the dist package (same pipeline as Export), then deploys the result to Google Drive using the configuration stored in Settings › Publishing. Slug-named subfolders and their photo files are uploaded to the configured Drive root folder, Drive file IDs are written back into the manifest, and the updated manifest is uploaded to the root of the Drive folder. A progress summary is shown in-app when complete.

**Why this priority**: This is the primary user action. The existing "Publish to web" button is a stub; wiring it to the full build + deploy pipeline is the core deliverable.

**Independent Test**: With valid Publishing settings configured, click "Publish to web". Verify the app does not open a file-save dialog, the progress indicator appears, the Drive root folder contains slug subfolders with photos and an updated manifest, and a result summary (shelters processed, photos uploaded, photos skipped) is shown in-app.

**Acceptance Scenarios**:

1. **Given** Publishing settings have a valid ROOT_FOLDER_ID, DIST_PATH, MANIFEST_NAME, and SCOPES, and credentials are cached, **When** the user clicks "Publish to web", **Then** the build runs silently, the prior Drive manifest is fetched as a baseline, only photos with a newer `updated` timestamp (or no prior `updated` entry) are uploaded, the manifest is written to Drive root in-place, and a success summary is displayed.
2. **Given** a prior Drive manifest exists and a photo's `updated` timestamp has not changed since the last publish, **When** the user clicks "Publish to web", **Then** that photo is not re-uploaded, its existing `driveFileId` is carried forward into the new manifest, and the result summary counts it as skipped.
3. **Given** a prior Drive manifest exists and a photo's `updated` timestamp is newer than the value in that manifest, **When** publish runs, **Then** the photo file content is replaced on Drive using the existing Drive file ID, and the same `driveFileId` is written into the new manifest (no new ID is generated).
4. **Given** no prior Drive manifest exists (first publish) or the prior manifest cannot be fetched, **When** publish runs, **Then** all photos are treated as needing upload and the deploy proceeds as a full upload without aborting.
5. **Given** one photo file is missing from the local build output, **When** publish runs, **Then** the upload continues for all other photos and a warning noting the missing file appears in the result summary.
6. **Given** a photo filename in the build output duplicates another within the same shelter slug, **When** publish runs, **Then** the duplicate is logged as a warning and the unique photos still upload correctly.

---

### User Story 2 - Google Drive Authentication Setup (Priority: P2)

Before using Publish for the first time, the maintainer sets up Google Drive credentials. The app needs an OAuth2 credentials file (downloaded from Google Cloud Console) and will cache the token after first consent. The "Test connection" button in Publishing settings verifies Drive is reachable with the current credentials.

**Why this priority**: Without working credentials, Publish cannot reach Drive. The user needs a clear setup path and the ability to verify their configuration before committing to a full publish.

**Independent Test**: Place a valid credentials file at the expected location, click "Test connection" in Publishing settings, and verify a success or failure status is displayed with a meaningful message (not a spinner that never resolves).

**Acceptance Scenarios**:

1. **Given** a credentials file exists at the configured path and no cached token exists, **When** the user triggers authentication (via "Test connection" or first Publish), **Then** a browser-based OAuth consent flow opens, the user approves, a token is cached locally, and the connection status updates to "Connected".
2. **Given** a valid cached token exists, **When** the user clicks "Test connection", **Then** a Drive API call verifies the root folder is reachable and displays a success status without re-opening the browser.
3. **Given** an expired token exists, **When** the user triggers any Drive operation, **Then** the token is refreshed silently using the refresh token (no browser prompt needed) and the operation proceeds.
4. **Given** no credentials file is found, **When** the user clicks "Test connection" or "Publish to web", **Then** the app shows a clear error explaining that credentials.json must be provided, with instructions on where to place it.

---

### User Story 3 - Publishing Configuration Wired to Deploy (Priority: P3)

The deploy operation reads all of its parameters from the Publishing settings stored in the app (ROOT_FOLDER_ID, DIST_PATH, MANIFEST_NAME, SCOPES) rather than from hard-coded values in a script. Changes saved in Settings › Publishing take effect immediately on the next publish.

**Why this priority**: The Python script hard-codes ROOT_FOLDER_ID and DIST_PATH. Moving these to the app settings makes the deploy configurable without editing source files.

**Independent Test**: Change ROOT_FOLDER_ID in Publishing settings and click "Publish to web". Verify that files are uploaded to the newly configured Drive folder, not the old one.

**Acceptance Scenarios**:

1. **Given** Publishing settings have ROOT_FOLDER_ID set to folder A, **When** the user changes ROOT_FOLDER_ID to folder B and saves, and then clicks "Publish to web", **Then** uploads go to folder B.
2. **Given** DIST_PATH in settings is blank, **When** the user clicks "Publish to web", **Then** the app shows a validation error explaining that DIST_PATH must be configured before publishing.
3. **Given** ROOT_FOLDER_ID in settings is blank, **When** the user clicks "Publish to web", **Then** the app shows a validation error explaining that ROOT_FOLDER_ID must be configured.

---

### Edge Cases

- What happens when the target Drive root folder ID is invalid or the folder has been deleted? The deploy operation halts immediately with a clear error message before processing any shelters.
- What happens when ROOT_FOLDER_ID or DIST_PATH is not configured in Publishing settings? Publish is blocked and the user is shown a configuration error pointing to Settings › Publishing.
- What happens when a photo upload fails mid-run (network error, quota)? The failure is logged, the deploy continues with remaining photos, and the result summary includes a failed-upload count.
- What happens when the dist build step itself fails? The deploy step does not execute; the error from the build is surfaced to the user.
- What happens when credentials.json or the token are deleted while the app is running? The next Drive operation detects missing credentials and prompts for re-authentication.
- What happens when the same publish is triggered while one is already running? A second publish is rejected while one is in progress.
- What happens when the prior Drive manifest cannot be fetched (first publish, deleted, network error)? All photos are treated as needing upload and the deploy proceeds as a full upload; the error is noted in the result summary but does not abort the publish.
- What happens when a photo entry in the prior Drive manifest has no `updated` property? The photo is treated as needing upload (same as if no prior record exists).

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: SQLite database (shelters, photos, sources, map_markers tables); shelter photo files on local filesystem under SHELTERS_ROOT; history markdown files; publishing configuration stored in `gmc.publishing` localStorage key.
- **Derived Outputs**: Built dist package (shelter-manifest.json + slug subfolders with photo files); updated manifest written back locally and uploaded to Google Drive root folder; photo files uploaded to Drive slug subfolders with `driveFileId` values written into the manifest.
- **Out-of-Repo Consumers**: Google Drive (target storage); any downstream consumer reading the Drive-hosted manifest (e.g. a WordPress plugin reading driveFileId values to construct photo URLs).

### Contracts & Operations

- **Contract Artifacts**: The shape of the Drive-uploaded manifest (shelter-manifest.json with `driveFileId` per photo) is the contract boundary with downstream Drive consumers. See `specs/001-gdrive-photo-deploy/` for prior specification of this contract.
- **Operator Documentation**: One-time setup requires downloading OAuth2 Desktop App credentials from Google Cloud Console and placing the file at a location the app can read. Token is cached automatically after first consent.
- **Theme/External Code Boundary**: Google Drive API and downstream consumers of the hosted manifest are outside this repository. The manifest schema is the documented contract.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The "Publish to web" button MUST trigger a full dist build followed immediately by a Google Drive deploy, using the current Publishing settings, without requiring a file-save dialog.
- **FR-002**: The deploy step MUST read ROOT_FOLDER_ID, DIST_PATH, MANIFEST_NAME, and SCOPES exclusively from the Publishing settings stored in the app.
- **FR-003**: The deploy step MUST upload photo files from each slug subfolder in the dist output to a matching named subfolder under ROOT_FOLDER_ID on Drive, creating the subfolder if it does not exist.
- **FR-004**: The deploy step MUST record the Drive file ID (`driveFileId`) for each uploaded or resolved photo in the manifest before uploading the manifest to Drive.
- **FR-005**: Before processing any photos, the deploy step MUST attempt to fetch the existing Drive manifest (by MANIFEST_NAME from ROOT_FOLDER_ID) to use as a comparison baseline. If the manifest cannot be fetched for any reason (first publish, deleted, network error), all photos MUST be treated as needing upload and the deploy MUST proceed without aborting.
- **FR-005a**: For each photo, the deploy step MUST compare the photo's `updated` timestamp in the newly-built manifest against the matching entry (matched by shelter slug and filename) in the prior Drive manifest. The photo MUST be uploaded only if its `updated` value is newer than the prior manifest's value, or if no matching prior entry exists, or if the prior entry has no `updated` property.
- **FR-005b**: For photos that are not re-uploaded (same or older `updated`), the deploy step MUST carry forward the `driveFileId` from the prior Drive manifest into the new manifest without making any Drive API call for that photo.
- **FR-005c**: When a photo requires re-upload and already has a `driveFileId` from the prior manifest, the deploy step MUST update the existing Drive file in-place (replacing its content using the existing file ID) so that the photo's share link remains valid. A new `driveFileId` MUST NOT be generated for an existing Drive file.
- **FR-006**: The deploy step MUST upload or update the manifest file at Drive root using MANIFEST_NAME as the filename. If the manifest file already exists on Drive, it MUST be updated using the existing Drive file ID (not deleted and re-created), so that any existing share links to the manifest remain valid.
- **FR-007**: The deploy step MUST write the manifest with resolved Drive IDs back to the local DIST_PATH before uploading it to Drive.
- **FR-008**: If ROOT_FOLDER_ID or DIST_PATH is blank in Publishing settings, the app MUST block the publish operation and display a configuration error before any build or upload begins.
- **FR-009**: If the target Drive root folder is unreachable (invalid ID, no access), the deploy MUST halt and display a clear error before processing any shelters.
- **FR-010**: If a photo file is missing from the local dist output, the deploy MUST log a warning, preserve any existing driveFileId for that entry, and continue with remaining photos.
- **FR-011**: A second "Publish to web" action MUST be rejected while a publish is already in progress.
- **FR-012**: The app MUST support Google OAuth2 authentication with cached token: first run opens a browser consent flow; subsequent runs use the cached token; expired tokens are refreshed silently.
- **FR-013**: The "Test connection" button in Publishing settings MUST perform a live Drive API call to verify the configured ROOT_FOLDER_ID is reachable and display a success or failure status.
- **FR-014**: If credentials are missing, both "Publish to web" and "Test connection" MUST display a clear error explaining how to supply credentials.
- **FR-015**: On completion, the app MUST display a result summary: shelters processed, photos uploaded, photos already on Drive (skipped), photos failed, and photos missing from local dist.

### Key Entities

- **Publishing Config**: ROOT_FOLDER_ID (Drive folder ID), DIST_PATH (local build output path), MANIFEST_NAME (manifest filename), SCOPES (OAuth2 scope list). Persisted in app settings.
- **OAuth2 Credential**: credentials.json (downloaded from Google Cloud Console, path configurable in settings or convention-based). Cached token stored locally after first consent.
- **Drive Subfolder**: Named after a shelter slug, child of ROOT_FOLDER_ID. Created on first publish for that slug; reused on subsequent publishes.
- **Drive Manifest**: shelter-manifest.json (or MANIFEST_NAME) stored at Drive root. Created on first publish; updated in place on subsequent publishes.
- **Photo Upload Record**: `driveFileId` written into each photo entry in the manifest after upload or ID resolution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A full publish (build + deploy) for a complete archive completes without user intervention beyond clicking "Publish to web", assuming credentials are already configured.
- **SC-002**: Re-running Publish on an unchanged archive (no photo `updated` timestamps have changed) results in zero new Drive uploads; all photo entries in the new manifest carry forward their existing `driveFileId` values from the prior Drive manifest.
- **SC-003**: Publish blocked when ROOT_FOLDER_ID or DIST_PATH is unconfigured — error is shown before any build or network activity begins.
- **SC-004**: The result summary accounts for every photo in the manifest: uploaded + skipped + failed + missing = total photos processed.
- **SC-005**: "Test connection" returns a definitive success or failure status within 10 seconds under normal network conditions.
- **SC-006**: A second Publish click while one is in progress produces no duplicate operations and displays a "publish already running" indicator.
- **SC-007**: After a photo is updated and re-published, the Drive share link for that photo (constructed from its `driveFileId`) resolves to the updated file content without changing.

## Assumptions

- The app runs as an Electron desktop application with access to the local filesystem and the ability to launch a local HTTP server for the OAuth2 callback redirect.
- OAuth2 credentials are obtained by the operator from Google Cloud Console as a Desktop App credential type; the app does not manage credential creation.
- The credentials file path and token cache path will follow a convention (e.g., relative to a user data directory) or be configurable via Publishing settings; exact path configuration is a planning decision.
- The dist build output structure (slug subfolders + manifest at root) is produced by the existing Export/build pipeline and is not changed by this feature.
- History markdown files (the `history` entry per shelter) are not uploaded to Drive as part of this feature; only photos and the manifest are deployed.
- The Publishing settings page `gmc.publishing` localStorage entry is the authoritative source for deploy configuration; the feature does not use any external config file for these values.
- Drive quota and rate limits are handled through retry logic (consistent with the existing Python script's `num_retries=5` pattern); advanced quota management is out of scope.
