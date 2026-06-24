# Feature Specification: Move Photo To Another Shelter

**Feature Branch**: `011-move-photo-shelter`
**Created**: 2026-06-24
**Status**: Draft
**Input**: User description: "on the photos tab, in the right aside, add a new icon button in the header. This will be 'move image' feature. clicking this will allow the user to move the selected photo to another shelter. this will move the photo and thumbnnails to the target shelter folder. It will also update the database."

## Clarifications

### Session 2026-06-24

- Q: How should thumbnails be handled when a photo moves to another shelter? → A: Thumbnails stay in the existing global cache (keyed by filename/mtime); no per-shelter thumbnail folder is introduced, and stale cache entries are purged if the filename changes.
- Q: Does picking a target shelter immediately move the photo, or is a separate explicit confirm step required? → A: Two-step: pick the target shelter in a picker, then a separate explicit "Confirm move" action executes it, mirroring the existing delete confirmation pattern.
- Q: After a successful move, does the app stay on the source shelter's Photos tab or switch the active view to the target shelter? → A: Stay on the source shelter's Photos tab; the moved photo just disappears from the list, no automatic shelter switch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Move a photo to a different shelter (Priority: P1)

A user viewing a photo's details on the Photos tab realizes it was filed under the wrong shelter. They click a "Move to shelter" icon button in the photo detail header, pick the correct shelter from a list, and confirm. The photo (and its cached thumbnails) end up filed under the new shelter, and the photo no longer appears under the old shelter.

**Why this priority**: This is the entire feature; there is no smaller useful slice.

**Independent Test**: Select a photo belonging to Shelter A, move it to Shelter B, and verify it now appears under Shelter B's photo list and no longer under Shelter A's, with the underlying file relocated and database record updated.

**Acceptance Scenarios**:

1. **Given** a photo is selected and shown in the Photos tab detail pane, **When** the user clicks the "Move to shelter" icon button, **Then** a picker listing all other shelters is shown, along with a separate explicit "Confirm move" action that is disabled until a target shelter is chosen.
2. **Given** the move picker is open and a target shelter is chosen, **When** the user activates "Confirm move", **Then** the photo file is relocated to the target shelter's photo folder, the database record's shelter association is updated to the target shelter, and the photo disappears from the source shelter's photo list and appears under the target shelter.
3. **Given** the move completes, **When** the user views the moved photo, **Then** previously generated thumbnails for that photo are still displayed correctly via the existing shared thumbnail cache, with no broken image.
4. **Given** the move picker is open, **When** the user cancels (without activating "Confirm move"), **Then** no changes are made to the photo, file, or database.

---

### User Story 2 - Moved photo was the shelter's featured/default photo (Priority: P2)

A user moves a photo that had been set as the source shelter's default/featured photo. The source shelter should no longer reference a photo that has moved away.

**Why this priority**: Prevents a broken reference left behind on the source shelter after a move; lower priority than the core move because it only applies to the subset of photos marked as default.

**Independent Test**: Set a photo as a shelter's default photo, move it to another shelter, and verify the source shelter no longer lists it as its default photo (and the target shelter's default photo is unaffected unless the moved photo is also set as default there).

**Acceptance Scenarios**:

1. **Given** the photo being moved is currently set as its source shelter's default photo, **When** the move completes, **Then** the source shelter's default photo reference is cleared.

---

### User Story 3 - Moved photo is referenced by a map marker (Priority: P3)

A user moves a photo that is currently linked to a map marker pin. The map marker should not be left pointing at a photo that now belongs to a different shelter.

**Why this priority**: Edge case affecting only photos that have been attached to a map marker; the core move (P1) delivers value without this.

**Independent Test**: Attach a photo to a map marker, move the photo to another shelter, and verify the map marker reference to that photo is cleared.

**Acceptance Scenarios**:

1. **Given** the photo being moved is referenced by a map marker, **When** the move completes, **Then** the map marker no longer references the moved photo.

### Edge Cases

- A photo file with the same name already exists in the target shelter's photo folder: the system MUST rename the incoming file (e.g. append a numeric suffix) so the move never overwrites or fails on a name collision.
- The user attempts to move a photo to the shelter it already belongs to: the target shelter list MUST exclude the photo's current shelter, so this case cannot be initiated.
- The underlying photo file is missing from disk when a move is attempted: the system MUST report the error to the user and leave the database record and any other shelter state unchanged.
- The move is attempted while no shelter exists other than the current one: the "Move to shelter" button MUST be disabled or the picker MUST indicate no destinations are available.
- The file move partially succeeds (e.g. disk error after the database update): the system MUST keep the database and file system consistent — apply the database update only after the file has been successfully relocated, or roll back the database change if the file relocation fails.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The local SQLite `photos` table (shelter association), the per-shelter photo folders on disk, and the local thumbnail cache.
- **Derived Outputs**: Updated `photos.shelter_id` (and any default-photo / map-marker references) and the relocated photo file under the target shelter's folder. The shared thumbnail cache is unaffected except for purging stale entries if the filename changes.
- **Out-of-Repo Consumers**: None — this is a fully local operation with no external system or remote upload involved.

### Contracts & Operations

- **Contract Artifacts**: N/A — purely a local desktop UI + file system + database operation, no external contract.
- **Operator Documentation**: N/A — no operator-facing process changes; this is an end-user-facing app feature.
- **Theme/External Code Boundary**: N/A.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Photos tab's photo detail header MUST include a "Move to shelter" icon button alongside the existing action icons (metadata, set-default, export, delete).
- **FR-002**: The "Move to shelter" button MUST be available only when a photo is selected and at least one other shelter exists.
- **FR-003**: Clicking "Move to shelter" MUST present the user with a list of all shelters except the photo's current shelter, plus a separate explicit "Confirm move" action (disabled until a target shelter is chosen) and a way to cancel.
- **FR-004**: Confirming the move MUST relocate the photo's file from the source shelter's photo folder to the target shelter's photo folder.
- **FR-005**: Confirming the move MUST update the photo's database record so it is associated with the target shelter.
- **FR-006**: If a filename collision occurs at the target shelter's photo folder, the system MUST rename the incoming file rather than overwrite the existing one.
- **FR-007**: Confirming the move MUST ensure thumbnails for the photo remain valid and correctly displayed after the move using the existing shared thumbnail cache (no per-shelter thumbnail storage); if the file's name changes during the move, stale cache entries for the old name MUST be purged so no broken or stale thumbnail is shown.
- **FR-008**: If the moved photo was the source shelter's default/featured photo, the system MUST clear that reference on the source shelter.
- **FR-009**: If the moved photo was referenced by a map marker, the system MUST clear that reference.
- **FR-010**: Canceling the move picker MUST leave the photo's file, database record, and any related references unchanged.
- **FR-011**: If the move fails partway (e.g. file system error), the system MUST leave the database and file system in a consistent state and MUST inform the user that the move did not complete.
- **FR-012**: After a successful move, the photo MUST no longer appear in the source shelter's photo list and MUST appear in the target shelter's photo list. The user remains on the source shelter's Photos tab; the app does not automatically switch the active view to the target shelter.

### Key Entities

- **Photo**: A single image record tied to exactly one shelter; has a file on disk, optional cached thumbnails, and may be referenced as a shelter's default photo or by a map marker.
- **Shelter**: An entity with its own photo folder on disk; may reference one photo as its default/featured photo.
- **Map Marker**: An optional reference from a map pin to a specific photo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can move a photo to a different shelter and see it reflected under the new shelter in under 5 seconds for typical photo file sizes.
- **SC-002**: 100% of moved photos display a correct, non-broken thumbnail and full image immediately after the move.
- **SC-003**: After a move, 0 dangling references remain (no shelter default-photo or map-marker reference points at a photo that has moved away).
- **SC-004**: A failed or canceled move results in 0 changes to the photo's file location, database record, or related references.

## Assumptions

- Only one photo can be moved at a time, matching the existing single-photo detail pane in the Photos tab; bulk/multi-select move is out of scope.
- "Move" relocates the file rather than copying it — the photo no longer exists under the source shelter after a successful move.
- The target shelter selection is presented as a simple list/picker of existing shelters; creating a new shelter from within the move picker is out of scope.
