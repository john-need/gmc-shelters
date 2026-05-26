# Feature Specification: Photo Metadata Dialog

**Feature Branch**: `007-photo-metadata-dialog`
**Created**: 2026-05-26
**Status**: Revised
**Revision**: Design updated after grilling session — dialog now reads/writes the File Layer directly (not the Editorial Layer). See ADR-0004.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Photo File Metadata (Priority: P1)

An operator is working in the Photos tab with a photo selected. They want to inspect every piece of metadata embedded in the photo file — camera make/model, exposure settings, GPS coordinates, any titles or descriptions written by previous tools. They click the new metadata icon button at the top of the right column. A brief loading indicator appears while the file is read. Once loaded, a dialog displays the complete set of metadata tags from the photo file, organized by metadata standard (file properties, camera/EXIF data, editorial/IPTC data, extended/XMP data). Tags with no value show a clear empty-state indicator. Tags are labelled with human-readable names alongside their raw tag key.

**Why this priority**: Viewing file metadata is the primary purpose of the dialog. Every other story (copy, edit, dismiss) depends on this view existing first.

**Independent Test**: Select a photo on the Photos tab and click the metadata icon button. After loading, the dialog must show all metadata tags embedded in the photo file, organized by group, with labels and values.

**Acceptance Scenarios**:

1. **Given** a photo is selected, **When** the operator clicks the metadata icon button, **Then** a loading indicator appears while the file metadata is being read from disk.
2. **Given** the file read completes successfully, **When** the dialog renders, **Then** all metadata tags returned from the file are displayed, organized by metadata standard group, with a human-readable label and the raw tag value for each.
3. **Given** a metadata tag has no value in the file, **When** the dialog renders, **Then** the tag is displayed with a clear empty-state indicator (e.g., "—") rather than a blank.
4. **Given** the file read fails (file missing, permissions error), **When** the dialog renders, **Then** an inline error message is shown along with a Retry button that re-triggers the file read.
5. **Given** no photo is selected on the Photos tab, **When** the operator looks at the right column, **Then** the metadata icon button is absent.
6. **Given** the dialog is open, **When** the operator looks at the right column, **Then** the "Sync from File" button (formerly "Import from File") is still present and labelled to clarify that it copies file metadata values into the editorial record.

---

### User Story 2 - Copy Metadata Field to Clipboard (Priority: P1)

The operator has the metadata dialog open and wants to copy the GPS coordinates to paste into a mapping tool. They click the copy icon button next to the GPS field. The value is written to the clipboard. A brief visual confirmation (copy icon momentarily changes to a checkmark) confirms success.

**Why this priority**: Clipboard copy is a named primary capability of the dialog. It allows operators to reuse any metadata value from the file without manual selection.

**Independent Test**: Open the metadata dialog for a photo with a non-empty title tag. Click the copy icon next to that tag. Paste into a text editor and verify the pasted value matches.

**Acceptance Scenarios**:

1. **Given** the metadata dialog is open, **When** the user clicks the copy icon next to any metadata tag row, **Then** that tag's displayed value is written to the system clipboard.
2. **Given** the copy icon is clicked, **When** the clipboard write resolves, **Then** the icon changes to a checkmark for approximately 1.5 seconds before reverting to the copy icon.
3. **Given** a tag has no value, **When** the user clicks its copy icon, **Then** an empty string is written to the clipboard and the brief checkmark confirmation still appears.

---

### User Story 3 - Edit Metadata Fields and Save to File (Priority: P1)

The operator notices the title embedded in the file is wrong. They click the edit button at the top of the dialog. All writable metadata tags switch from read-only display to editable inputs. File-system intrinsic tags (dimensions, file size, MIME type) remain as plain text — they cannot be written. The operator corrects the title. They click "Save". The corrected value is written directly to the photo file. The dialog closes. The right column is unchanged — the Editorial Layer is not updated.

**Why this priority**: Writing corrected metadata back to the file is the save action for this dialog. It operates exclusively on the File Layer.

**Independent Test**: Open the metadata dialog, enable edit mode, change the title tag, click Save. Verify the file's title tag is updated (re-open the dialog and confirm), and verify the right column title is unchanged.

**Acceptance Scenarios**:

1. **Given** the dialog is open in view mode, **When** the user clicks the edit button, **Then** all writable metadata tags switch to input controls; non-writable file-intrinsic tags remain as plain text.
2. **Given** edit mode is active, **When** the user modifies one or more fields and clicks "Save", **Then** only the changed tag values are written to the photo file, the dialog closes, and the right column (Editorial Layer) is not updated.
3. **Given** edit mode is active, **When** the user clicks "Cancel", **Then** all edits are discarded, the dialog closes, and the file is unchanged.
4. **Given** the file write fails, **When** Save is clicked, **Then** an inline error message is shown; the dialog does not close.

---

### User Story 4 - Cancel / Dismiss Without Editing (Priority: P2)

The operator opened the dialog just to look and is done. They press Escape or click the close button or click the overlay. The dialog closes. No file write occurs.

**Independent Test**: Open the dialog without entering edit mode. Press Escape. The dialog closes; nothing on disk has changed.

**Acceptance Scenarios**:

1. **Given** the dialog is open in view mode, **When** the user presses Escape, **Then** the dialog closes with no file or state changes.
2. **Given** the dialog is open in view mode, **When** the user clicks outside the dialog overlay, **Then** the dialog closes with no file or state changes.
3. **Given** the dialog is open in view mode, **When** the user clicks the close button (✕), **Then** the dialog closes with no file or state changes.
4. **Given** the dialog is open in edit mode and Escape is pressed, **Then** the dialog closes and the file is unchanged (same as Cancel).

---

### Edge Cases

- What if a metadata tag value is a complex object (e.g., GPS coordinate as a struct)? The dialog displays the value serialized to a human-readable string; it is copyable but not directly editable (treat as non-writable for editing purposes).
- What if the photo file changes on disk while the dialog is open? The dialog shows the snapshot loaded on open; changes to the file after open are not reflected until the dialog is closed and reopened.
- What if a writable tag is cleared to empty by the operator? An empty value is written to the file (the tag is cleared), subject to ExifTool's behavior for that tag type.
- What if the clipboard write fails? The failure is silently ignored; no toast or error is shown. Clipboard writes are non-critical.
- What if an `Identifier` tag appears in the file (written by the system to record the photo's database ID)? The `Identifier` tag MUST be treated as non-writable and rendered as plain text even in edit mode. Allowing the user to change this value would desync the file's identifier from the database record.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The photo file on disk, read via an async IPC call when the dialog opens. The Editorial Layer (Redux/DB) is NOT read by this dialog.
- **Derived Outputs**: When the operator saves edits, only the changed tag values are written to the photo file via an IPC call. No Redux action is dispatched. No database write occurs.
- **Out-of-Repo Consumers**: WordPress or any downstream consumer that reads the photo file will see updated embedded metadata after a save.

### Contracts & Operations

- **New IPC — Read**: `photos.readFileMetadata(slug, fileName, sheltersRoot)` → `Promise<FileMetadataTag[]>` where `FileMetadataTag = { group: string; key: string; label: string; value: string | null; writable: boolean }`. This is a new channel; the existing `photos.readMetadata` channel is unchanged.
- **New IPC — Write**: `photos.writeFileMetadata(slug, fileName, sheltersRoot, tags: Record<string, string>)` → `Promise<void>`. Writes only the provided key/value pairs to the file. This is a new channel; `photos.update` is unchanged.
- **Renamed UI**: The "Import from File" button in the right column is relabelled to "Sync from File" with a tooltip: "Copy file metadata values into the editorial record".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A metadata icon button MUST be added to `photo-detail-head` in the Photos tab, alongside existing action buttons. It MUST be absent when no photo is selected.
- **FR-002**: Clicking the metadata icon button MUST open the metadata dialog and immediately trigger an async read of all metadata tags from the photo file.
- **FR-003**: While the file read is in flight, the dialog MUST display a loading indicator.
- **FR-004**: Once loaded, the dialog MUST display all metadata tags returned by the file read, organized by metadata standard group, each row showing a human-readable label, the tag key, and the value (or "—" if absent).
- **FR-005**: If the file read fails, the dialog MUST display an inline error message and a Retry button that re-triggers the file read.
- **FR-006**: Every metadata tag row MUST include a copy icon button. Clicking it MUST write the tag's displayed value to the system clipboard.
- **FR-007**: After a successful clipboard write, the copy icon MUST display a checkmark for approximately 1.5 seconds before reverting.
- **FR-008**: The dialog MUST include an edit button. Clicking it MUST switch all writable tags from read-only display to input controls. Non-writable tags MUST remain as plain text in edit mode.
- **FR-009**: In edit mode, a "Save" and "Cancel" button MUST be visible. The edit button MUST be hidden while in edit mode.
- **FR-010**: Clicking "Save" MUST call `window.api.photos.writeFileMetadata(...)` with only the changed tags, then close the dialog. No Redux action MUST be dispatched and no `photos.update` call MUST be made.
- **FR-011**: If the file write fails, an inline error MUST be shown and the dialog MUST remain open.
- **FR-012**: Clicking "Cancel", pressing Escape, or clicking the overlay MUST discard all edits and close the dialog without writing to the file.
- **FR-013**: Keyboard focus MUST be trapped inside the dialog while open. Tab and Shift+Tab MUST cycle only through controls within the dialog.
- **FR-014**: The "Import from File" button in the right column MUST be relabelled "Sync from File" and MUST include a descriptive tooltip clarifying that it copies file metadata values into the editorial record.

### Key Entities

- **FileMetadataTag**: `{ group: string; key: string; label: string; value: string | null; writable: boolean }` — the display unit returned by the read IPC. Computed and annotated in the main process; never stored.
- **File Layer**: Metadata embedded in the photo file. Source of truth for this dialog.
- **Editorial Layer**: Metadata in the `photos` database table. Untouched by this dialog's save path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The metadata icon button is reachable in one click from the Photos tab whenever a photo is selected.
- **SC-002**: The dialog displays the complete set of file metadata tags (all groups) with a scroll if needed; no tags are hidden or truncated by default.
- **SC-003**: Each tag's copy button delivers the value to the clipboard in under 500 milliseconds from click.
- **SC-004**: Clicking "Save" in edit mode results in the changed values being written to the photo file and NO change to the `photos` database record — verifiable by confirming `photos.update` IPC is not called and the right column values are unchanged after save.
- **SC-005**: Clicking "Cancel" or pressing Escape results in zero file changes — verifiable by confirming `photos.writeFileMetadata` IPC is not called.

## Assumptions

- Tags returned by the file read that have complex object values (GPS structs, dates with timezone) are serialized to a human-readable string in the main process before crossing the IPC boundary; the renderer treats all tag values as strings.
- The set of non-writable tags is determined in the main process. Non-writable tags are: (a) all tags in the ExifTool family-0 "File" group (FileSize, ImageWidth, ImageHeight, FileType, FileTypeExtension, MIMEType, ExifToolVersion, FileName, Directory, FileModifyDate, FileAccessDate, FileInodeChangeDate, FilePermissions, EncodingProcess, BitsPerSample, ColorComponents, YCbCrSubSampling), and (b) the `Identifier` tag regardless of group.
- Metadata tags are grouped using ExifTool's family-0 group values. The expected groups are: `File`, `EXIF`, `IPTC`, `XMP`, `GPS`, `Composite`. Each group is rendered as a labelled section in the dialog.
- Tag labels are humanized from the raw tag key by splitting on camelCase boundaries (e.g., `ExposureTime` → "Exposure Time", `GPSLatitude` → "GPS Latitude").
- The existing `photos.readMetadata` IPC channel (used by "Sync from File") remains unchanged; it continues to return `Partial<Photo>` for the 7 mapped fields.
- The `include_in_post` flag has no counterpart in the file metadata and is NOT shown in the metadata dialog.
- Clipboard copy failures are silently ignored (non-critical convenience feature).
- The dialog is modal and blocks interaction with the rest of the application while open.
- A tag is considered "changed" only if its draft value (string) differs from the value loaded from the file at dialog open. If the user edits a field and then restores the original value, the tag is not included in the write payload.
