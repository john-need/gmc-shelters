# Contract: `photos:move` IPC Channel

Internal contract only — renderer (`window.api.photos.move`) ⇄ main process. No external/out-of-repo consumer (Constitution Principle III is N/A for this feature).

## Channel

`CHANNELS.PHOTOS_MOVE = 'photos:move'` (new constant in `src/shared/ipc-types.ts`, alongside existing `PHOTOS_*` channels).

## Request

```ts
interface PhotoMoveInput {
  photoId: number;
  targetShelterId: number;
  sheltersRoot: string;
}
```

Preload bridge: `window.api.photos.move(photoId, targetShelterId, sheltersRoot): Promise<Photo>`

## Behavior

1. Look up the photo's current `shelter_id` and `file_name`, and the source + target shelters' `slug`s.
2. If `targetShelterId === photo.shelter_id`: reject with an error (the renderer's picker already excludes the current shelter, so this is a defensive guard, not a user-facing path).
3. Copy the file from the source shelter's `photos/` folder to the target shelter's `photos/` folder, renaming on a basename collision (same `-{timestamp}` suffix scheme as `copyPhotoToShelter`).
4. Inside one `db.transaction`:
   - `UPDATE photos SET shelter_id = ?, file_name = ?, updated = ? WHERE id = ?`
   - `UPDATE shelters SET default_photo_id = NULL WHERE id = ? AND default_photo_id = ?` (source shelter, FR-008)
   - `UPDATE map_markers SET photo_id = NULL WHERE photo_id = ?` (FR-009)
5. If step 4 throws, delete the file copied in step 3 (best-effort) and re-throw so the renderer shows a failure toast; no further steps run.
6. Best-effort: delete the original file from the source folder.
7. Best-effort: if the filename changed, `purgeThumbnailsForSource(oldFilePath)`.
8. Return the updated `Photo` row (same shape `updatePhoto`/`insertPhoto` already return).

## Response

- Success: `Photo` (same shape returned by `photos:update`/`photos:upload`), with `shelter_id` and `file_name` reflecting the new location.
- Failure: rejected promise; renderer catches and shows a toast (matches `handleDeletePhoto`'s try/catch pattern), no local Redux state changes on failure.

## Renderer-side effects on success

- `dispatch(removePhotoLocal({ shelterId: sourceShelterId, photoId }))` — removes it from the source shelter's in-memory list (FR-012).
- If the moved photo was the source shelter's default: `dispatch(setDefaultPhotoLocal({ shelterId: sourceShelterId, photoId: null, fileName: '' }))` (mirrors existing delete-handler behavior, FR-008).
- No dispatch into the target shelter's list — the user stays on the source shelter's Photos tab (Clarifications: no auto-switch); the target shelter's list will pick up the photo next time it's loaded.
