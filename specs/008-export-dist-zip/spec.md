# Feature Specification: Export Dist Package to Zip

**Feature Branch**: `008-export-dist-zip`
**Created**: 2026-05-27
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export Shelter Data Package (Priority: P1)

An operator wants to produce a complete, self-contained archive of all shelter data and photos for
delivery to the WordPress site or for offline backup. They click the **Export** button in the app
header, watch progress feedback while the package is assembled, then choose a destination folder.
The app saves a dated zip archive to that folder and confirms success.

**Why this priority**: This is the sole reason the Export button exists. All other stories are
secondary to this primary workflow.

**Independent Test**: Trigger an export from the app, pick a destination folder, and verify a
`.zip` file is written there containing `shelter-manifest.json` and per-shelter photo directories.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the user clicks Export, **Then** the button enters a
   disabled/loading state and a progress toast appears.
2. **Given** the build completes successfully, **When** the zip is written, **Then** the app
   prompts the user to select a save folder.
3. **Given** the user picks a folder, **When** the folder is confirmed, **Then** the zip file is
   written there and a success toast names the file.
4. **Given** the user dismisses the folder picker without selecting, **When** cancelled,
   **Then** no file is written and the button returns to its normal state with no error.

---

### User Story 2 - Export Failure Feedback (Priority: P2)

The build or zip step fails (e.g. missing photos, disk full, no Python/data available). The user
receives a clear error message explaining what went wrong. The Export button returns to its normal
state so they can retry.

**Why this priority**: Silent failures leave operators with no way to diagnose or retry, which
could mean a stale export gets deployed without the user realising it failed.

**Independent Test**: Simulate a build failure (e.g. corrupt database path) and verify an error
toast is shown and the button re-enables.

**Acceptance Scenarios**:

1. **Given** the build step throws an error, **When** it is caught, **Then** an error toast
   appears with a description of the failure.
2. **Given** an error has occurred, **When** the user reads the message, **Then** the Export
   button is re-enabled so they can retry.

---

### User Story 3 - Export Package Contents (Priority: P1)

The produced zip must contain the exact content the WordPress deployment script expects: the
`shelter-manifest.json` at the archive root and each shelter's photos under a `{slug}/` directory.

**Why this priority**: Without the correct layout the downstream consumer (WordPress deploy) cannot
use the export. This is a correctness constraint, not a nice-to-have.

**Independent Test**: Unzip the produced archive and verify `shelter-manifest.json` is at the root
and that a sample shelter slug directory contains its expected photos.

**Acceptance Scenarios**:

1. **Given** a successful export, **When** the zip is inspected, **Then** `shelter-manifest.json`
   is present at the archive root.
2. **Given** a successful export, **When** a per-shelter directory is examined, **Then** it
   contains the photo files that exist for that shelter on disk.
3. **Given** a shelter has no photos, **When** exported, **Then** no directory is created for
   that shelter in the zip (sparse output is acceptable).

---

### Edge Cases

- What happens when the export is triggered while a previous export is still running? The Export
  button remains disabled until the current run completes.
- What happens when a photo file referenced by the manifest is missing from disk? The missing file
  is skipped and a warning is included in the result; the export still completes.
- What happens when the destination folder is on a read-only volume? The zip write fails gracefully
  and an error toast is shown; no partial file is left behind.
- What happens when the user triggers Export twice in quick succession? The second click is a
  no-op (button is disabled during the first run).
- What happens when `{slug}.md` is absent for a shelter? `historyFile` and `historyUpdated` are
  set to `null` in the manifest entry; the shelter is still included in the export.

## Clarifications

### Session 2026-05-27

- Q: What value should `historyFile` hold in the manifest? → A: Relative path from archive root: `"{slug}/{slug}.md"`
- Q: Does "include the updated time stamp" refer to a new field (file mtime of `{slug}.md`) or the existing DB `updated` field? → A: New field `historyUpdated` — the file system last-modified time of `{slug}.md`, distinct from `shelter.updated`

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: `database/gmc_shelters.sqlite` (shelter records, photo metadata), shelter photo
  files under `shelters/{slug}/`, and the manifest assembly logic already proven in
  `scripts/build_dist_package.py` / `scripts/build_shelter_manifest.py`.
- **Derived Outputs**: A temporary `dist/` directory built during the export, then archived into
  a single `gmc-shelters-export-YYYYMMDD.zip` file at the user-chosen destination.
- **Out-of-Repo Consumers**: WordPress deployment (`scripts/deploy_to_drive.py`) and any operator
  consuming the export zip. Neither is changed by this feature.

### Contracts & Operations

- **Contract Artifacts**: `specs/008-export-dist-zip/contracts/zip-layout.md` — describes the
  required directory structure inside the archive so downstream consumers can validate it.
- **Operator Documentation**: Update `scripts/README.md` to note that the in-app Export button
  supersedes running `build_dist_package.py` + manual zip by hand.
- **Theme/External Code Boundary**: The export zip is a data payload; WordPress theme and deploy
  scripts are external and not changed here.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Export button in the app header MUST initiate a full dist package build using the
  same logic as `scripts/build_dist_package.py`: clear the temp build area, build the shelter
  manifest from the SQLite database, copy manifest and photos into the build directory.
- **FR-002**: The dist package builder MUST be implemented in TypeScript and run inside the
  Electron main process so it can be invoked without spawning an external Python process.
- **FR-003**: After the build completes, the system MUST produce a single zip archive containing
  `shelter-manifest.json` at the root and per-shelter photo directories.
- **FR-004**: The zip filename MUST embed the current date in `YYYYMMDD` format
  (e.g. `gmc-shelters-export-20260527.zip`) so exports are distinguishable by date.
- **FR-005**: The system MUST present a native folder-picker dialog so the user can select where
  the zip is saved. Cancelling the dialog MUST abort the save without error.
- **FR-006**: The Export button MUST be disabled and show a loading state during the entire export
  operation (build + zip + save) to prevent duplicate runs.
- **FR-007**: On success, the system MUST show a toast confirming the file name and destination
  path. On failure, the system MUST show an error toast with the failure reason and re-enable the
  button.
- **FR-008**: Photo files listed in the manifest but absent from disk MUST be skipped silently;
  the export MUST still complete with the files that are present.
- **FR-009**: The system MUST clean up the temporary build directory after the zip is written (or
  after a failure) so no partial artefacts are left in the repo working tree.
- **FR-010**: Each shelter entry in the manifest MUST include a `historyFile` field set to the
  relative path `"{slug}/{slug}.md"` from the archive root. If `{slug}.md` is absent from disk,
  `historyFile` MUST be `null`.
- **FR-011**: Each shelter entry in the manifest MUST include a `historyUpdated` field containing
  the ISO 8601 file system last-modified timestamp of `{slug}.md`. If `{slug}.md` is absent from
  disk, `historyUpdated` MUST be `null`.
- **FR-012**: Each photo entry in the manifest MUST include an `updated` field (the DB
  record last-modified date). This field is already emitted by the current Python assembler and
  MUST be preserved in the TypeScript reimplementation.

### Key Entities

- **Dist Package**: The assembled set of files (manifest + photos) that form the export payload.
  Built into a temporary directory, then archived.
- **Shelter Manifest**: `shelter-manifest.json` — the JSON document describing all shelters,
  their metadata, and photo references. Generated from the SQLite database using the same
  assembly pipeline as `build_shelter_manifest.py`. Each shelter entry includes:
  - `historyFile` — relative path to the shelter's history markdown file within the archive
    (`"{slug}/{slug}.md"`); `null` if the file is absent from disk.
  - `historyUpdated` — file system last-modified timestamp of `{slug}.md`; `null` if absent.
  - `updated` — DB record last-modified date (already present; required explicitly).
  Each photo entry within a shelter includes `updated` — the DB record last-modified date
  (already present in the current manifest; required explicitly by this feature).
- **Export Archive**: The final zip file saved to the user-chosen folder. Named with a date stamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can go from clicking Export to having a valid zip file on disk in under
  60 seconds for a typical dataset (≤ 300 shelters, ≤ 3 000 photos).
- **SC-002**: The produced zip passes structural validation: `shelter-manifest.json` present at
  root, and every photo referenced in the manifest that exists on disk is present in the archive.
- **SC-003**: Cancelling the folder picker leaves zero partial files at any destination.
- **SC-004**: Running Export twice back-to-back (waiting for the first to finish) produces two
  independently valid zip files with no cross-contamination between runs.
- **SC-005**: An export that encounters missing photo files still completes and produces a valid
  (partial) archive rather than failing entirely.
- **SC-006**: Every shelter entry in the produced manifest contains `historyFile` (a relative path
  string or `null`) and `historyUpdated` (an ISO 8601 timestamp string or `null`). Every photo
  entry contains a non-null `updated` field.

## Assumptions

- The Electron main process has full filesystem access to `database/gmc_shelters.sqlite` and the
  `shelters/` directory via `app.getAppPath()`, matching the existing `APP_GET_REPO_ROOT` handler.
- The TypeScript manifest builder will use the same `better-sqlite3` dependency already present in
  the project, reading the same tables and producing the same JSON structure as the Python script.
- A Node.js-native zip library (e.g. `archiver` or `JSZip`) will be used; no external zip binary
  is required at runtime.
- The temporary build directory will be located inside the repo root (e.g. `dist/`) and cleaned up
  after each export run, matching the behaviour of the existing Python script.
- The WordPress deploy script and any other out-of-repo consumers are not changed by this feature;
  they continue to accept the same zip layout they consume today.
- No authentication or access control is required for the Export action; any user who can open the
  app can trigger an export.
