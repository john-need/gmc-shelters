# Feature Specification: Safe Shelter Slug Renames

**Feature Branch**: `012-shelter-slug-rename`
**Created**: 2026-06-25
**Status**: Draft
**Input**: User description: "Allow safe shelter slug renames"

## Clarifications

### Session 2026-06-25

- Q: If sanitizing a staff-entered slug strips it down to an empty string (e.g., they typed only symbols or spaces), what should happen? → A: Reject with a clear error before any DB/disk change.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rename a shelter's slug without losing its photos or history (Priority: P1)

A staff member editing a shelter's profile changes its slug (the short identifier used to organize the shelter's files). After saving, the shelter's photos, history notes, and folder on disk all continue to work under the new slug — nothing goes missing or breaks.

**Why this priority**: This is the core problem. Today a rename silently orphans the shelter's files and breaks the photo gallery and history view. Without this, the slug field is unsafe to use.

**Independent Test**: Create a shelter, add a photo and a history note, rename its slug, and verify the photo still displays, the history note still loads, and no orphaned folder is left behind.

**Acceptance Scenarios**:

1. **Given** a shelter with an existing slug, photos, and history, **When** staff change the slug and save, **Then** the shelter's folder is renamed, its photos still display correctly, and its history still loads correctly.
2. **Given** a shelter with no custom history yet, **When** staff rename its slug, **Then** the rename completes without error and the shelter's folder and photos move to the new name.
3. **Given** a shelter whose slug is unchanged on save (other fields edited), **When** staff save, **Then** no rename/move logic runs and nothing on disk is touched.

---

### User Story 2 - Reject duplicate slugs with a clear message (Priority: P2)

A staff member tries to rename a shelter's slug to one that's already used by another shelter. Instead of a crash or unexplained failure, they see a clear message telling them the slug is already taken, and nothing changes.

**Why this priority**: Prevents silent failures and unhandled database errors from reaching the user; without this, a collision currently surfaces as a raw, confusing error.

**Independent Test**: Create two shelters, attempt to rename one to the other's slug, and verify a clear in-app error message appears and neither shelter's data or files changed.

**Acceptance Scenarios**:

1. **Given** two existing shelters with different slugs, **When** staff rename the first shelter's slug to match the second shelter's slug, **Then** the save is rejected with a clear "already in use" message, and the first shelter's data and files are unchanged.
2. **Given** a rename that collides with an existing slug, **When** the save is rejected, **Then** no files are moved and no database rows are modified.

---

### User Story 3 - Slug is always sanitized to a safe value (Priority: P3)

A staff member enters a slug with spaces, punctuation, capital letters, or stray characters like `/` or `..`. The system automatically converts it to a safe, predictable value before it's ever used to name a folder, so it can never be used to write outside the intended shelter storage location.

**Why this priority**: Closes a path-safety gap (todays free-text field has no sanitization), but is lower priority than the rename/duplicate-handling behavior since it's a hardening measure rather than the main workflow.

**Independent Test**: Enter a slug containing spaces, uppercase letters, and a `/` character, save, and verify the stored and on-disk slug is a sanitized lowercase-hyphenated value with no path-traversal characters.

**Acceptance Scenarios**:

1. **Given** a slug input containing uppercase letters, spaces, or symbols, **When** staff save, **Then** the stored slug is converted to lowercase, hyphen-separated form with no invalid characters.
2. **Given** a slug input containing characters that could reference a different file path (such as `/` or `..`), **When** staff save, **Then** those characters are stripped or replaced so the resulting slug cannot resolve outside the shelter's own storage folder.

### Edge Cases

- What happens when the shelter's old folder is missing from disk (e.g., already deleted manually) at rename time? The rename should still update the database and not fail the whole save — proceed with a logged warning, since there's nothing to move.
- What happens when a folder already exists on disk at the new slug name, but it isn't a tracked shelter (stray/leftover folder)? The rename must be rejected with a clear message rather than overwriting or merging into that folder.
- What happens if renaming the database records succeeds but moving the folder on disk fails partway through (e.g., permissions error)? The system must roll back the database change so the shelter's slug, photos, and history references stay consistent with whatever is actually on disk — never left half-renamed.
- How is rerun behavior handled when the same import/sync input is processed twice? Not applicable — this feature is a synchronous, user-initiated save action with no batch import/sync step.
- What happens when sanitizing the entered slug strips it down to an empty string? The save is rejected with a clear error before any database or disk change is made.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The `shelters` table (slug, history columns) and `photos` table (file_name column) in the local SQLite database; the shelter's folder and photo files on local disk under the configured shelters storage root.
- **Derived Outputs**: The renamed shelter folder and photo files on disk; updated `photos.file_name` and `shelters.history` values that reference the new slug.
- **Out-of-Repo Consumers**: None for this feature — already-published exports (e.g., previously generated Google Drive folders or manifest files referencing an old slug) are a known, out-of-scope limitation and are not updated retroactively by a rename.

### Contracts & Operations

- **Contract Artifacts**: N/A — this is an internal data-consistency fix to an existing save workflow; no new external contract is introduced.
- **Operator Documentation**: None required beyond noting in release notes that slug renames now safely move files; no operator workflow changes.
- **Theme/External Code Boundary**: N/A — no external theme or hosted-site code is touched by this feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow staff to change a shelter's slug and have that shelter's folder, photo references, and history reference all consistently reflect the new slug after saving.
- **FR-002**: System MUST sanitize any slug value to a safe, predictable format (lowercase, hyphen-separated, no path-traversal or path-separator characters) before it is used to name or locate any file or folder.
- **FR-002a**: System MUST reject a save if sanitizing the entered slug results in an empty value, with a clear error message, before any database or disk change is made.
- **FR-003**: System MUST reject a slug rename that would collide with another existing shelter's slug, and MUST do so before any files are moved or other records are changed.
- **FR-004**: System MUST present a clear, specific error message to staff when a slug rename is rejected for being a duplicate.
- **FR-005**: System MUST reject a slug rename that would collide with an existing, untracked folder on disk at the target name, rather than overwriting or merging into it.
- **FR-006**: System MUST NOT move, rename, or otherwise touch any files on disk when a shelter is saved without a change to its slug.
- **FR-007**: System MUST keep the database and on-disk folder/file state consistent with each other if any part of a rename fails partway through — i.e., never leave the slug recorded in the database different from what the folder is actually named on disk.

### Key Entities *(include if feature involves data)*

- **Shelter**: Has a unique slug identifying its folder on disk and its history file; renaming changes the slug and must keep the folder, history, and photo references in sync.
- **Photo**: Belongs to a shelter; its stored file reference is prefixed with the shelter's slug and must be updated when the shelter's slug changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful shelter slug renames result in the shelter's photos and history remaining viewable immediately after the rename, with zero orphaned folders left on disk.
- **SC-002**: 100% of attempted renames to an already-used slug are rejected with a clear, readable message, with zero unhandled errors or app crashes.
- **SC-003**: Zero shelter records end up with a slug that does not match an actual folder name on disk, even after a failed or interrupted rename attempt.
- **SC-004**: Any slug entered with disallowed characters (spaces, uppercase, symbols, path separators) is always stored and displayed in its sanitized form, with zero instances of files being written outside a shelter's own storage folder.

## Assumptions

- Target users are internal staff using the desktop app to manage shelter records; no external/public-facing users are involved.
- Slug renames are infrequent, single-shelter, user-initiated actions — no bulk or scripted renaming is in scope.
- The shelters storage root and existing folder-per-slug layout (`{sheltersRoot}/{slug}/`, with a `photos/` subfolder) remain the repository-owned source of truth for shelter files; this feature does not change that layout.
- Previously published/exported copies of a shelter (e.g., to Google Drive) referencing the old slug are out of scope for this feature and are not retroactively updated.
