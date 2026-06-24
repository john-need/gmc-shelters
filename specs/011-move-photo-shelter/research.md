# Research: Move Photo To Another Shelter

## Decision: File relocation strategy

**Decision**: Move = `fs.copyFile` to the target shelter's `photos/` folder followed by `fs.unlink` of the source file, not `fs.rename`.

**Rationale**: `fs.rename` fails across filesystem/device boundaries (e.g. if `sheltersRoot` is later moved to a different volume or network share), and the existing codebase already favors `copyFile` for cross-shelter file operations (`copyPhotoToShelter` in `src/main/fs/photos.ts:30`). Copy-then-unlink keeps the same safety property the spec requires (FR-011): if the copy fails, the source file and DB record are untouched; only after a successful copy does the code proceed to delete the source and update the DB.

**Alternatives considered**: `fs.rename` — rejected, not guaranteed to work across filesystem boundaries and offers no benefit since both directories are local. A move-DB-first approach (update DB then move file) — rejected, because a failed file move after a DB commit would leave `photos.shelter_id` pointing at a shelter whose folder doesn't have the file, violating FR-011's consistency requirement; file-first matches the existing precedent in `deletePhoto`'s "DB-first only when the file op can't fail the record" reasoning, inverted here because the file op can fail more often than the DB op.

## Decision: Filename collision handling at destination

**Decision**: Reuse the same `-{timestamp}` suffixing strategy already used by `copyPhotoToShelter` (`src/main/fs/photos.ts:38-41`) when the destination folder already has a file with the same name.

**Rationale**: Consistent with existing upload behavior; no new collision-naming scheme to design, test, or explain to users. Constitution Principle V (minimal additions) favors reusing the established pattern.

**Alternatives considered**: Prompting the user to rename — rejected as unnecessary UI complexity for an edge case (FR-006 only requires never overwriting, not user involvement).

## Decision: Thumbnail handling

**Decision**: No file move for thumbnails. The cache in `src/main/fs/thumbnails.ts` is keyed by sanitized basename + mtime (not shelter), so it remains valid after a DB/folder move as long as the filename and mtime don't change. If the move generates a new filename (collision-rename case), call the existing `purgeThumbnailsForSource(oldFilePath)` (already used by `PHOTOS_DELETE`) so stale cache entries for the old name don't linger.

**Rationale**: Confirmed via the spec Clarifications session (2026-06-24) and via reading `purgeThumbnailsForSource`'s existing call site in `src/main/ipc/photos.ts:96-101`. Building a parallel per-shelter thumbnail store would be new structure the constitution's minimal-change principle doesn't justify.

**Alternatives considered**: Per-shelter thumbnail folders mirroring the photo folder structure — rejected per Clarifications answer; would require a broader thumbnail-cache redesign outside this feature's scope.

## Decision: Reference cleanup (default photo, map marker)

**Decision**: On a successful move, run `clearDefaultPhoto(sourceShelterId, photoId)` (already exists, `src/main/db/photos.ts:119-121`) and a new `UPDATE map_markers SET photo_id = NULL WHERE photo_id = ?` clear (same statement already used inside `deletePhoto`, `src/main/db/photos.ts:108`), inside the same DB transaction that updates `shelter_id`.

**Rationale**: Matches the exact pattern `deletePhoto` already uses to null inbound references before mutating/removing the row, satisfying FR-008/FR-009 with no new abstraction.

**Alternatives considered**: Leaving the map marker reference intact since the photo still exists (just elsewhere) — rejected per spec User Story 3, which explicitly requires the reference to be cleared since a map marker's photo is expected to belong to that marker's shelter.

## Decision: UI flow shape (two-step picker)

**Decision**: New `MovePhotoDialog` component, structurally similar to `ConfirmDialog` (overlay + dialog box) but with a `<select>` of candidate shelters (excluding the current one) plus a disabled-until-selected "Confirm move" button, instead of `ConfirmDialog`'s plain message + confirm/cancel.

**Rationale**: Confirmed via Clarifications — explicit two-step (pick, then confirm) rather than instant-move-on-select. Reusing the existing `state.shelters.list` (Redux) for the shelter options, following the same plain `<select className="select">` pattern already used in `ShelterTab.tsx`/`ArchitecturesPage.tsx`, avoids introducing a new dependency (no combobox library).

**Alternatives considered**: Extending `ConfirmDialog` with an optional `<select>` slot — rejected; `ConfirmDialog`'s props are message-only and used elsewhere for plain yes/no confirmations, so widening its contract for one caller would leak move-specific concerns into a shared component.
