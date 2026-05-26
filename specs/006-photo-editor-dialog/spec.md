# Feature Specification: Photo Editor Dialog

**Feature Branch**: `006-photo-editor-dialog`  
**Created**: 2026-05-26  
**Status**: Draft  
**Input**: User description: "Move photo editing to a full-screen dialog. On the photos tab, clicking a photo in the right aside column should open dialog with the photo editing controls. Currently editing happens in the small box in the right column, this is too small to edit a photo. Open the editor in a full screen dialog when the photo is clicked. move the editing tools, 'crop', 'rotate', etc. to the dialog. Users should click 'Save' to save and close the edits, or 'cancel' to cancel all edits and close the dialog."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Photo Editor Dialog (Priority: P1)

An operator is reviewing the photographs for a shelter and wants to crop and rotate a photo to improve its presentation. They click on the photo thumbnail in the right-aside column. A full-screen dialog opens, displaying the photo at a large size alongside the editing tools (crop, rotate, flip, and zoom). The operator can see the photo clearly and make precise edits without the constraints of the small right-column panel.

**Why this priority**: This is the core interaction change requested. Without this, the feature does not exist.

**Independent Test**: Open the Photos tab with at least one photo loaded. Click the photo in the right-aside column. The full-screen editor dialog must open.

**Acceptance Scenarios**:

1. **Given** the Photos tab is open and a photo is selected in the left grid/list, **When** the user clicks the photo thumbnail in the right-aside column, **Then** a full-screen dialog opens displaying the selected photo at maximum available size.
2. **Given** the editor dialog is open, **When** the dialog renders, **Then** all editing tools (crop, rotate left, rotate right, flip horizontal, zoom in/out) are visible and interactive within the dialog.
3. **Given** the editor dialog is open, **When** the photo cannot be loaded (e.g., file missing), **Then** the dialog shows the placeholder initial letter and editing tools remain accessible.
4. **Given** the Photos tab is open in grid or list view, **When** the user double-clicks a photo card, **Then** the editor dialog opens for that photo (selecting it if it was not already selected).

---

### User Story 2 - Save Edits from Dialog (Priority: P1)

The operator has rotated and cropped the photo inside the full-screen dialog and is satisfied with the result. They click the "Save" button. The edits (rotation, flip, crop) are applied and persisted. The dialog closes. The photo thumbnail in the photos list reflects the updated image.

**Why this priority**: Saving is the primary goal of opening the editor; without it the dialog has no purpose.

**Independent Test**: Open the dialog, apply at least one edit (e.g., rotate 90°), click Save. Verify the dialog closes and the photo tile in the list reflects the change.

**Acceptance Scenarios**:

1. **Given** the editor dialog is open with pending edits (rotation, flip, or crop applied), **When** the user clicks "Save", **Then** the edits are persisted to the photo record, the dialog closes, and the photo in the list is updated.
2. **Given** the editor dialog is open with no edits applied, **When** the user clicks "Save", **Then** the dialog closes with no changes written and no error is shown.
3. **Given** an edit save is in progress, **When** the save operation is running, **Then** the Save button is disabled and a loading indicator is shown until the operation completes.

---

### User Story 3 - Cancel Edits from Dialog (Priority: P1)

The operator has rotated the photo but decides the edit was a mistake. They click "Cancel". The dialog closes and no changes are applied to the photo record. The photo in the list remains unchanged.

**Why this priority**: Cancel gives operators a safe exit without unintended data changes.

**Independent Test**: Open the dialog, apply an edit, click Cancel. Verify the dialog closes and the photo is unchanged in the list.

**Acceptance Scenarios**:

1. **Given** the editor dialog is open with pending edits, **When** the user clicks "Cancel", **Then** all in-progress edits are discarded, the dialog closes, and the persisted photo record remains unchanged.
2. **Given** the editor dialog is open, **When** the user presses the Escape key, **Then** the dialog closes and all pending edits are discarded (same behavior as Cancel).
3. **Given** the editor dialog is open, **When** the user clicks outside the dialog overlay, **Then** the dialog closes and all pending edits are discarded (same behavior as Cancel).

---

### User Story 4 - Editing Tools Removed from Right-Aside Column (Priority: P2)

After the dialog feature is in place, the crop, rotate, flip, and zoom controls no longer appear inline inside the small right-aside detail panel. The right-aside panel retains the photo thumbnail and metadata fields, but the editing tools that have moved to the dialog are removed to avoid duplication and confusion.

**Why this priority**: Removing the tools from the column cleans up the UI and makes the dialog the single place for image editing. Without cleanup the UX goal of the feature is only half achieved.

**Independent Test**: Open the Photos tab. Verify the right-aside column does not show crop, rotate, flip, or zoom controls. Verify those controls do appear inside the opened editor dialog.

**Acceptance Scenarios**:

1. **Given** the Photos tab is open and a photo is selected, **When** the right-aside detail panel is visible, **Then** crop, rotate, flip, and zoom controls are not present in the panel.
2. **Given** the Photos tab is open, **When** the right-aside detail panel is visible, **Then** the photo thumbnail remains clickable as the trigger to open the editor dialog.

---

### Edge Cases

- What happens if the save operation fails (e.g., disk error, IPC failure)? An error toast is shown, the dialog remains open with edits intact, and the Save button is re-enabled for retry.
- What happens when the user clicks the thumbnail while a save is already in progress from a previous dialog session? The dialog must not open until the prior save completes, or must show the latest persisted state when it opens.
- How does the dialog handle a very wide or very tall photo? The image must fit within the dialog viewport without overflowing; the layout adapts to portrait and landscape orientations.
- What happens if the user opens the dialog, switches focus to another application, then returns? The dialog must remain open and retain the unsaved edits.
- What happens when the user applies crop mode, then clicks Cancel without confirming the crop? The crop mode is exited and no crop is recorded (same as current Cancel behavior for the overall dialog).

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The `photos` SQLite table (via `better-sqlite3`) is the authoritative store for photo metadata including rotation, flip, and crop values. Photo image files live under `shelters/<slug>/photos/` in the repository filesystem and are the source for the displayed image.
- **Derived Outputs**: No new derived outputs are introduced. The existing `savePhotoMetadata` IPC call writes the transformed image file back to `shelters/<slug>/photos/` and updates the database record. This behavior is unchanged; only the UI surface that triggers it changes.
- **Out-of-Repo Consumers**: None directly. WordPress publication consumers read the already-processed image files via the existing export/sync workflow; this feature does not alter those files or that contract.

### Contracts & Operations

- **Contract Artifacts**: N/A — this feature is a renderer-only UI change. No IPC contracts, payload shapes, or CLI interfaces change.
- **Operator Documentation**: No operator documentation update required. The feature is self-evident UI; no scripts, quickstart, or README steps are affected.
- **Theme/External Code Boundary**: N/A — no WordPress theme or external system integration is added or changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Clicking the photo preview area in the right-aside detail panel MUST open a full-screen modal dialog containing the selected photo and all image-editing controls. Double-clicking a photo card in the left grid or list view MUST also open the editor dialog for that photo (selecting it if not already selected).
- **FR-002**: The editor dialog MUST display the photo at the largest size that fits the available dialog viewport, preserving aspect ratio.
- **FR-003**: The editor dialog MUST include crop, rotate left, rotate right, flip horizontal, and zoom in/out controls, with the same behavior as the current inline tools.
- **FR-004**: The editor dialog MUST include a clearly labelled "Save" button that persists **only** image edits (rotation, flip, and crop) and closes the dialog. Metadata field changes (title, photographer, caption, etc.) are unaffected by this Save and continue to be saved independently via the "Save Metadata" button in the right-aside panel.
- **FR-005**: The editor dialog MUST include a clearly labelled "Cancel" button that discards all pending edits and closes the dialog without writing changes.
- **FR-006**: Pressing Escape or clicking outside the dialog overlay MUST discard all pending edits and close the dialog, equivalent to pressing Cancel.
- **FR-007**: The crop, rotate, flip, and zoom controls MUST be removed from the right-aside detail panel once they are available in the dialog.
- **FR-008**: The right-aside detail panel's photo preview area MUST remain visible and serve as the click target to open the editor dialog. On hover, the preview MUST display a pointer cursor and a subtle darkened overlay to signal it is interactive.
- **FR-009**: Pending edits inside the dialog (rotation, flip, crop) MUST NOT be persisted unless the user explicitly clicks "Save".
- **FR-010**: While a save operation is in progress, the Save button MUST be disabled to prevent duplicate submissions.
- **FR-011**: If the save operation fails, the system MUST display an error toast notification, keep the editor dialog open with all pending edits intact, and re-enable the Save button so the user can retry or cancel.
- **FR-012**: Keyboard focus MUST be trapped inside the editor dialog while it is open — Tab and Shift+Tab MUST cycle only through controls within the dialog. When the dialog closes, focus MUST return to the element that triggered it (the photo preview or photo card).

### Key Entities *(include if feature involves data)*

- **Photo**: The existing `Photo` record in the SQLite database, containing `id`, `shelter_id`, `file_name`, `rotation`, `flipped`, `crop`, and metadata fields. This feature does not change the entity structure.
- **Editor Dialog State**: Transient UI state (rotation delta, flip toggle, active crop rectangle) that exists only while the dialog is open and is discarded on Cancel.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can open the photo editor dialog by clicking the photo preview in the right-aside column in a single click, with the dialog appearing within one second on a standard development machine.
- **SC-002**: Users can apply rotation, flip, and crop edits and save them without leaving the dialog, completing a full edit-and-save workflow in under 60 seconds.
- **SC-003**: Zero editing operations (rotate, flip, crop) remain accessible in the right-aside column after the dialog feature is shipped; all such controls appear exclusively in the editor dialog.
- **SC-004**: Clicking Cancel or pressing Escape results in zero changes written to the database or image file, verifiable by inspecting the photo record before and after a cancelled editing session.
- **SC-005**: The editor dialog photo area utilizes at least 60% of the dialog's available height, measurably larger than the prior inline preview area.

## Clarifications

### Session 2026-05-26

- Q: When the user clicks "Save" inside the editor dialog, should it persist only image edits (crop/rotate/flip), or also persist any unsaved metadata field changes? → A: Save only image edits (crop, rotate, flip) — metadata save remains independent via the existing "Save Metadata" button in the right-aside panel.
- Q: Should clicking a photo card in the left grid or list view also open the editor dialog? → A: Double-clicking a photo card in the grid or list view opens the editor dialog; single-click retains current select-only behaviour.
- Q: If the save operation inside the editor dialog fails, what should happen? → A: Show an error toast, keep the dialog open with edits intact, re-enable the Save button for retry.
- Q: Should keyboard focus be trapped inside the editor dialog while it is open? → A: Yes — Tab/Shift+Tab cycle only within dialog controls; focus returns to the triggering element on close.
- Q: What visual affordance should indicate the right-aside photo preview is clickable? → A: Pointer cursor on hover plus a subtle darkened overlay on the preview image.

## Assumptions

- The metadata editing fields (title, photographer, date taken, caption, alt text, description, internal notes, include-in-post toggle) remain in the right-aside detail panel and are not moved to the editor dialog, since the user's request specifically targets image-manipulation tools (crop, rotate, etc.).
- The existing `savePhotoMetadata` IPC call and its handling of `rotation`, `flipped`, and `crop` parameters continue unchanged; only the renderer UI layer changes.
- "Full-screen" means the dialog occupies the full application window viewport (or as close as practical), not the operating-system desktop full-screen mode.
- The editor dialog can be opened from two surfaces: the right-aside photo preview (single click) and a photo card in the grid or list view (double-click).
- The zoom control is an in-dialog-only preview aid and does not result in a saved zoom level; this matches current behavior where zoom is purely a display adjustment.
- Keyboard focus is trapped inside the dialog while open (Tab/Shift+Tab cycle within dialog controls only); focus returns to the triggering element on close. This follows the ARIA modal pattern already used by `ReconcileModal`.
