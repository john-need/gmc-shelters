# Feature Specification: Photo Metadata Dialog

**Feature Branch**: `007-photo-metadata-dialog`
**Created**: 2026-05-26
**Status**: Draft
**Input**: User description: "Add a new icon button to the top of the right column on the photos tab. this icon button will open a dialog that display all meta data on the selected photo. the meta data will have 'copy' icon buttons next to each meta datum that copies the datum to the clipboard. Include an edit button to the top of the form. When enabled, User can edit any existing meta-datum on the photo. User should also have a 'save' and 'cancel' button. Saving here only updates the meta-data on the photo. not in the db."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Photo Metadata (Priority: P1)

An operator is working in the Photos tab with a photo selected. They want to quickly review all stored metadata for that photo in one place — to confirm values before publishing. They click the new metadata icon button at the top of the right column. A dialog opens showing every metadata field for the selected photo (title, photographer, date taken, caption, alt text, description, internal notes, include-in-post flag, file name, photo ID, shelter ID, created date, updated date). All fields are clearly labelled and presented in read-only form.

**Why this priority**: Viewing metadata is the primary purpose of the dialog. Every other feature (copy, edit) depends on this view existing first.

**Independent Test**: With a photo selected on the Photos tab, click the metadata icon button. The dialog must open and show all metadata fields for that photo.

**Acceptance Scenarios**:

1. **Given** the Photos tab is open and a photo is selected, **When** the user clicks the metadata icon button at the top of the right column, **Then** a dialog opens displaying all metadata fields for the selected photo.
2. **Given** the metadata dialog is open, **When** the dialog renders, **Then** every metadata field is visible: title, photographer, date taken, caption, alt text, description, internal notes, include-in-post status, file name, photo ID, shelter ID, created date, and updated date.
3. **Given** the metadata dialog is open, **When** a metadata field has no value, **Then** the field is displayed with a clear empty-state indicator (e.g., an em dash or "—") rather than a blank space.
4. **Given** no photo is selected on the Photos tab, **When** the operator looks at the right column, **Then** the metadata icon button is either absent or disabled, since there is nothing to view.

---

### User Story 2 - Copy Metadata Field to Clipboard (Priority: P1)

The operator has the metadata dialog open and wants to copy the alt text to paste into a WordPress post. They click the copy icon button next to the alt text field. The value is copied to the clipboard. A brief visual confirmation (e.g., the copy icon momentarily changes to a checkmark) confirms the copy was successful.

**Why this priority**: Clipboard copy is one of the two named capabilities of this dialog. It allows operators to reuse metadata values without manual selection.

**Independent Test**: Open the metadata dialog for a photo with a non-empty alt text field. Click the copy icon next to alt text. Paste into a text editor and verify the value matches.

**Acceptance Scenarios**:

1. **Given** the metadata dialog is open in view mode, **When** the user clicks the copy icon next to a populated metadata field, **Then** that field's value is written to the system clipboard.
2. **Given** the metadata dialog is open, **When** a copy icon is clicked, **Then** the icon changes to a checkmark briefly (approximately 1.5 seconds) before reverting, confirming the copy succeeded.
3. **Given** a metadata field is empty, **When** the user clicks its copy icon, **Then** an empty string is written to the clipboard and the brief confirmation still appears (or the copy icon is hidden — see Assumptions).

---

### User Story 3 - Edit Metadata Fields In-Memory (Priority: P1)

The operator notices the title field contains a typo. They click the edit button at the top of the dialog. All metadata fields switch from read-only display to editable inputs. The operator fixes the title. A "Save" button and a "Cancel" button are now visible. They click "Save". The corrected title is applied to the photo record in the application's working state. The dialog closes. The right-side detail panel and photo list reflect the updated title immediately, but the change is not yet persisted to the database.

**Why this priority**: In-memory editing allows operators to stage metadata corrections and batch-save later using the existing "Save Metadata" button — maintaining the existing save workflow.

**Independent Test**: Open the metadata dialog, enable edit mode, change the title, click Save. Verify the title updates in the right-aside detail panel without a database write (observable by checking that no IPC save call is made).

**Acceptance Scenarios**:

1. **Given** the metadata dialog is open in view mode, **When** the user clicks the edit button, **Then** all editable metadata fields switch to input controls and "Save" and "Cancel" buttons become visible.
2. **Given** the dialog is in edit mode and the user has modified one or more fields, **When** the user clicks "Save", **Then** the changes are applied to the photo's in-memory state (Redux store), the dialog closes, and the updated values are immediately visible in the right-aside detail panel and photo list without a database write.
3. **Given** the dialog is in edit mode and the user has modified one or more fields, **When** the user clicks "Cancel", **Then** all edits are discarded, the dialog closes, and the in-memory photo state is unchanged.
4. **Given** the dialog is in edit mode, **When** the user presses Escape, **Then** the dialog closes and all unsaved edits are discarded (same behaviour as Cancel).
5. **Given** the dialog is in edit mode with unsaved changes, **When** the user clicks outside the dialog overlay, **Then** the dialog closes and edits are discarded (same behaviour as Cancel).

---

### User Story 4 - Cancel Without Editing (Priority: P2)

The operator opened the metadata dialog just to copy a value and has finished. They press Escape or click the close/cancel button. The dialog closes. Nothing has changed.

**Why this priority**: Clean dismissal without side effects is essential for a safe, low-friction workflow.

**Independent Test**: Open the dialog without entering edit mode. Press Escape. Verify the dialog closes and the photo state is unchanged.

**Acceptance Scenarios**:

1. **Given** the metadata dialog is open in view mode, **When** the user presses Escape, **Then** the dialog closes with no changes applied.
2. **Given** the metadata dialog is open in view mode, **When** the user clicks outside the dialog overlay, **Then** the dialog closes with no changes applied.
3. **Given** the metadata dialog is open in view mode, **When** the user clicks a close/cancel button, **Then** the dialog closes with no changes applied.

---

### Edge Cases

- What happens when the user opens the metadata dialog, enters edit mode, then clicks outside the overlay? All unsaved edits are discarded and the dialog closes (Cancel behaviour).
- What happens if the clipboard write fails (browser security restriction or OS denial)? The copy icon does not show the success checkmark and the failure is silently ignored rather than showing an error (clipboard failures are non-critical).
- What happens when the selected photo changes while the metadata dialog is open? The dialog is tied to the photo that was selected when it was opened; the selection change does not reload the dialog.
- What happens when the metadata dialog is open in edit mode and the user attempts to clear a required field (e.g., title)? The field is allowed to be empty; no validation errors are shown — metadata can be sparse.
- What happens if the dialog is opened for a photo whose file no longer exists on disk? The metadata is still displayed from the in-memory record; no file-system check is performed.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The in-memory Redux photo store (`state.photos.byShelter`), populated from the `photos` SQLite table via existing IPC calls. This dialog reads from and optionally writes to in-memory state only.
- **Derived Outputs**: When the operator saves edits in this dialog, the in-memory Redux photo record is updated (identical to the existing `updatePhotoLocal` action). No file-system writes, no IPC calls, and no database writes occur from within this dialog's save path.
- **Out-of-Repo Consumers**: None. This is a renderer-only UI change. The database and any WordPress consumers are unaffected by this feature.

### Contracts & Operations

- **Contract Artifacts**: N/A — this feature introduces no IPC changes, payload shape changes, or CLI interfaces.
- **Operator Documentation**: No operator documentation update required. The metadata icon button and dialog are self-evident. No scripts, quickstart steps, or README sections change.
- **Theme/External Code Boundary**: N/A — no WordPress theme or external system integration is added or changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A metadata icon button MUST be added to the header area at the top of the right column (`photo-detail-head`) on the Photos tab, alongside the existing star and delete buttons.
- **FR-002**: The metadata icon button MUST be absent (not rendered) when no photo is selected.
- **FR-003**: Clicking the metadata icon button MUST open a dialog displaying all metadata fields for the currently selected photo: title, photographer, date taken, caption, alt text, description, internal notes, include-in-post status, file name, photo ID, shelter ID, created date, and updated date.
- **FR-004**: In view mode, every metadata field MUST be read-only. Empty fields MUST display a clear placeholder (e.g., "—") rather than a blank.
- **FR-005**: Every metadata field row in the dialog MUST include a copy icon button. Clicking it MUST write the field's value to the system clipboard.
- **FR-006**: After a successful clipboard copy, the copy icon button MUST briefly display a visual confirmation (e.g., a checkmark) for approximately 1.5 seconds before reverting to the copy icon.
- **FR-007**: The dialog MUST include an edit button at the top of the form. Clicking it MUST switch all editable fields from read-only display to input controls.
- **FR-008**: When edit mode is active, the dialog MUST display "Save" and "Cancel" buttons. The edit button MUST be hidden or replaced by these controls while in edit mode.
- **FR-009**: Clicking "Save" in edit mode MUST apply changes to the in-memory photo record via the existing `updatePhotoLocal` Redux action and MUST close the dialog. No IPC call and no database write MUST be made.
- **FR-010**: Clicking "Cancel" in edit mode, pressing Escape, or clicking outside the dialog overlay MUST discard all unsaved edits and close the dialog.
- **FR-011**: Pressing Escape or clicking outside the dialog overlay in view mode MUST close the dialog with no changes.
- **FR-012**: Keyboard focus MUST be trapped inside the dialog while it is open. Tab and Shift+Tab MUST cycle only through controls within the dialog. When the dialog closes, focus MUST return to the metadata icon button that opened it.
- **FR-013**: Read-only system fields (photo ID, shelter ID, file name, created date, updated date) MUST NOT be editable in edit mode; they remain displayed as read-only values.

### Key Entities *(include if feature involves data)*

- **Photo**: The existing `Photo` record with fields: `id`, `shelter_id`, `file_name`, `file_path`, `title`, `photographer`, `caption`, `date_taken`, `alt_text`, `description`, `notes`, `include_in_post`, `created`, `updated`. This feature does not change the entity structure.
- **Dialog State**: Transient UI state (view/edit mode toggle, per-field draft values, per-field copy confirmation) that exists only while the dialog is open and is discarded on Cancel or Escape.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The metadata icon button is reachable in one click from the Photos tab right column whenever a photo is selected.
- **SC-002**: All 13 metadata fields (title, photographer, date taken, caption, alt text, description, notes, include-in-post, file name, photo ID, shelter ID, created, updated) are visible in the dialog without scrolling on a standard 1280×800 viewport, or with a single compact scroll if the viewport is smaller.
- **SC-003**: Each metadata field's copy button delivers the field value to the clipboard in under 500 milliseconds from click.
- **SC-004**: Entering edit mode, modifying at least one field, and clicking "Save" completes without a database write — verifiable by confirming no `savePhotoMetadata` IPC call is invoked during the operation.
- **SC-005**: Clicking "Cancel" or pressing Escape results in zero in-memory state changes to the photo record, verifiable by comparing the Redux store snapshot before and after a cancelled edit session.

## Assumptions

- The dialog presents all fields from the `Photo` interface; fields added in the future would need a separate update to appear in this dialog.
- The `include_in_post` boolean is displayed as a read-only label (e.g., "Published" / "Not published") in view mode and as a checkbox or toggle in edit mode, consistent with how it appears in the right-aside detail panel.
- Read-only system fields (id, shelter_id, file_name, created, updated) are always non-editable even when edit mode is active, because they are managed by the system and not operator-editable.
- The copy icon for the `include_in_post` field copies a human-readable string ("Published" or "Not published") rather than a raw boolean.
- The "Save" action in this dialog dispatches `updatePhotoLocal` to the Redux store, identical to how inline field changes in the right-aside panel work. The operator must separately click the existing "Save Metadata" button in the right-aside panel to persist these changes to the database.
- Clipboard copy failures (permissions denied, insecure context) are silently ignored; no toast or error is shown, as clipboard writes are non-critical convenience features.
- The dialog is modal and blocks interaction with the rest of the application while open, consistent with `ReconcileModal` and `PhotoEditorDialog` in this codebase.
