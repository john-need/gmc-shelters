# Feature Specification: Photos Tab Reconcile

**Feature Branch**: `005-photos-reconcile`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Add a new feature to the photos tab, 'Reconcile'. This feature will read the shelters/{slug} folder contents for a shelter and compare them with what's in the database. It will list photos that are in the file system and allow the user to check which ones he wants to add to the database. It will also list rows in the photos table that are not in the file system and allow the user to check which rows he wants to delete. It will then reconcile the two sources. Photos and rows that are not selected will remain as are."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover and Register Untracked Photos (Priority: P1)

An operator has copied photo files directly into a shelter's `photos/` folder on disk (for example, during a bulk import or file transfer) without going through the app's upload flow. These files exist on the filesystem but have no database record. The operator opens the Reconcile view, sees the untracked files listed, selects all or some of them, and registers them into the database so they appear in the Photos tab like any other photo.

**Why this priority**: The most common reconcile scenario — files arrive on disk faster than they are registered. Without this, photos are invisible to the app even though they exist on disk.

**Independent Test**: Given a shelter folder that contains image files not present in the photos table, opening the reconcile view must list those files in the "Files not in database" section.

**Acceptance Scenarios**:

1. **Given** a shelter folder contains three image files with no corresponding database rows, **When** the operator opens the Reconcile view for that shelter, **Then** all three files appear in the "Files not in database" list, each with a checkbox defaulting to unchecked.
2. **Given** the operator has selected two of the three untracked files and clicks "Reconcile", **Then** two new rows are created in the photos table (one per selected file) and the third file remains unregistered.
3. **Given** an untracked file is selected and reconciled, **Then** the new database record uses the filename (without extension) as the default title and leaves all other metadata fields blank.
4. **Given** no untracked files exist for the current shelter, **Then** the "Files not in database" section shows a message indicating no untracked files were found.

---

### User Story 2 - Identify and Clean Up Orphaned Records (Priority: P2)

A shelter's database contains photo records whose files have been deleted or moved from disk. These orphaned rows clutter the Photos tab with broken entries. The operator opens the Reconcile view, sees the orphaned records listed with their titles and filenames, selects the ones to remove, and deletes them from the database.

**Why this priority**: Orphaned records cause broken image previews and confuse operators. Cleaning them up restores the integrity of the photos list.

**Independent Test**: Given rows in the photos table whose referenced files do not exist on disk, opening the reconcile view must list those rows in the "Records with no file" section.

**Acceptance Scenarios**:

1. **Given** two rows in the photos table reference files that do not exist on disk, **When** the operator opens the Reconcile view, **Then** both rows appear in the "Records with no file" list with their title, filename, and a checkbox defaulting to unchecked.
2. **Given** the operator selects one orphaned record and clicks "Reconcile", **Then** that database row is deleted and the other orphaned record remains untouched.
3. **Given** no orphaned records exist for the current shelter, **Then** the "Records with no file" section shows a message indicating no orphaned records were found.

---

### User Story 3 - Confirm a Clean Shelter (Priority: P3)

An operator runs Reconcile on a shelter that is already fully in sync — every file has a database record and every record has a file. They see both sections empty (or indicating no issues) and can close the view with confidence that everything is consistent.

**Why this priority**: Operators need to verify consistency without having to reconcile anything. A clean state should be explicitly communicated.

**Independent Test**: Given a shelter where every file has a record and every record has a file, opening the Reconcile view must show empty lists in both sections with appropriate "all clear" messages.

**Acceptance Scenarios**:

1. **Given** the shelter is fully in sync, **When** the operator opens the Reconcile view, **Then** both sections display a message indicating no discrepancies were found.
2. **Given** the operator clicks "Reconcile" with nothing selected, **Then** nothing changes in the database or on disk.

---

### User Story 4 - Rerun Safety (Priority: P2)

After reconciling, the operator closes and reopens the Reconcile view, or runs it again without making further changes on disk or in the database. The view reflects the current state accurately and does not re-list items that were already reconciled.

**Why this priority**: Operators must be able to rerun the scan safely without risk of duplicates or unintended changes.

**Independent Test**: Run reconcile, add selected files, then reopen reconcile — previously registered files must no longer appear in the "Files not in database" list.

**Acceptance Scenarios**:

1. **Given** the operator reconciled three untracked files in the previous session, **When** they open the Reconcile view again without any new files added to disk, **Then** zero files appear in the "Files not in database" list.
2. **Given** the operator reconciles the same shelter twice in succession, **Then** no duplicate database rows are created.

---

### Edge Cases

- What happens when a shelter's `photos/` folder does not exist on disk? The scan should treat it as empty (zero untracked files) and proceed without error.
- How does the system handle non-image files (PDFs, `.DS_Store`, etc.) found in the photos folder? Only recognised image extensions (JPEG, PNG, TIFF, WEBP) are included in the untracked list; other files are silently ignored.
- What if a file appears in both sections (same filename in DB and on disk but the record references a different path format)? Filename matching must account for the legacy `shelters/` prefix stripping already present in the codebase.
- How is rerun behaviour handled when the same untracked file is processed twice? The second reconcile finds the file already registered and does not create a duplicate row; the item no longer appears in the untracked list.
- What happens if a file is deleted from disk between opening the Reconcile view and clicking "Reconcile"? The system must gracefully skip the missing file and report it as failed rather than crashing.
- What happens if a deleted orphaned record is also the shelter's current default photo? The reconcile action MUST automatically clear the shelter's `default_photo_id` when deleting a record that holds that designation.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The repository-owned `shelters/{slug}/photos/` directory on disk (filesystem) and the `photos` table in the local SQLite database — both are authoritative for their respective views of reality
- **Derived Outputs**: New rows inserted into the `photos` table (for selected untracked files) and rows deleted from the `photos` table (for selected orphaned records); no files are written or deleted from disk by the reconcile action
- **Out-of-Repo Consumers**: None — this is a local, operator-facing data-management tool; no WordPress or external system is involved

### Contracts & Operations

- **Contract Artifacts**: N/A — no external consumers; the feature is internal to the Electron app
- **Operator Documentation**: The reconcile action must be documented in operator guidance once implemented (e.g., in `quickstart.md` or a Photos section of the app README), explaining when and how to use it
- **Theme/External Code Boundary**: N/A — no WordPress theme or remote system is involved

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST scan the `shelters/{slug}/photos/` directory for files with recognised image extensions (JPEG, PNG, TIFF, WEBP) and identify which filenames have no matching row in the `photos` table for the current shelter.
- **FR-002**: System MUST query the `photos` table for the current shelter and identify which rows reference filenames not found in the `shelters/{slug}/photos/` directory (accounting for the legacy `shelters/` prefix stripping).
- **FR-003**: Users MUST be able to open the Reconcile view as a modal dialog by clicking a "Reconcile" button in the Photos tab toolbar; the modal overlays the main photos list without replacing it.
- **FR-003a**: The modal MUST automatically begin the filesystem and database scan as soon as it opens, displaying a loading indicator until results are ready.
- **FR-004**: Users MUST be able to select any combination of untracked files to add to the database, with all items defaulting to unchecked.
- **FR-005**: Users MUST be able to select any combination of orphaned records to delete from the database, with all items defaulting to unchecked.
- **FR-006**: System MUST attempt all selected additions and deletions when the user confirms; items that fail MUST be skipped and reported without preventing other selected items from being applied (best-effort, not all-or-nothing).
- **FR-007**: Photos and records that are not selected MUST remain unchanged after the reconcile action completes.
- **FR-008**: System MUST detect already-processed inputs — rerunning the scan after a reconcile must not re-list items that were already registered or deleted.
- **FR-009**: New database records created during reconciliation MUST use the image filename (without extension) as the default title; all other metadata fields MUST be blank.
- **FR-010**: System MUST provide "Select All" and "Deselect All" controls for each section independently.
- **FR-011**: System MUST display a summary of results after reconciliation that accounts for all attempted items: how many were added, how many were deleted, and how many failed with a brief reason.
- **FR-012**: If a deleted orphaned record is the shelter's current default photo, the system MUST automatically clear the shelter's default photo designation as part of the same reconcile action.

### Key Entities

- **Untracked File**: An image file present in `shelters/{slug}/photos/` on disk with no corresponding `file_name` row in the `photos` table for that shelter.
- **Orphaned Record**: A row in the `photos` table for a shelter whose `file_name` does not match any file present in `shelters/{slug}/photos/` on disk.
- **Reconcile Action**: The user-triggered operation that inserts new rows for selected untracked files and deletes rows for selected orphaned records in a single pass.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators can open the Reconcile view and see a complete, accurate list of discrepancies within 3 seconds for shelters with up to 500 photos.
- **SC-002**: All selected additions and deletions that can succeed are applied in a single reconcile pass; the Photos tab list reloads to reflect the updated state when the operator closes the modal.
- **SC-003**: Rerunning the scan on a previously reconciled shelter (with no new filesystem or database changes) shows zero untracked files and zero orphaned records.
- **SC-004**: Unselected items — both files and database records — remain completely unchanged after any reconcile action.
- **SC-005**: Operators can distinguish at a glance between "untracked files" and "orphaned records" in the reconcile view.

## Clarifications

### Session 2026-05-26

- Q: What UX pattern should the Reconcile view use — modal dialog, inline panel, or separate sub-tab? → A: Modal dialog (Option A) — opened via a "Reconcile" button in the Photos tab toolbar; overlays the main photos list.
- Q: When does the reconcile scan run — automatically on modal open, manually triggered, or auto with manual refresh? → A: Auto-scan on open (Option A) — scan runs immediately when the modal opens; operator sees a loading indicator then results.
- Q: If one item in the reconcile batch fails (e.g., DB insert error), how should the system handle the remaining items? → A: Best-effort (Option B) — apply all items that can succeed; skip and report failures; summary shows what worked and what didn't.
- Q: When does the main Photos tab list refresh to reflect reconciled changes — on modal close, in real time, or manually? → A: Refresh on close (Option A) — the photos list reloads when the operator dismisses the modal after reviewing the summary.
- Q: If a deleted orphaned record is also the shelter's current default photo, what should happen to `default_photo_id`? → A: Auto-clear (Option A) — clear the shelter's default photo designation automatically as part of the reconcile action.

## Assumptions

- The operator is the sole user of this desktop Electron app; no multi-user conflict scenarios need to be handled.
- "Recognised image extensions" means JPEG (`.jpg`, `.jpeg`), PNG (`.png`), TIFF (`.tif`, `.tiff`), and WEBP (`.webp`) — the same set enforced in the existing upload zone.
- File matching is case-insensitive on the filename to tolerate filesystem differences across operating systems.
- The reconcile action does not write or delete any files from disk; it only modifies the database. Operators who want to physically remove orphaned-record files can use the existing delete action in the main Photos tab.
- The `shelters/` legacy prefix strip already present in `photoFilePath()` applies equally to matching logic in the reconcile scan.
- The Reconcile view is a modal dialog opened from a "Reconcile" button in the Photos tab toolbar; it overlays the existing photos list rather than replacing it or adding a new navigation tab.
