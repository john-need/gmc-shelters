# Data Model: Move Photo To Another Shelter

No schema migration. All entities and columns already exist; this feature only changes which row values point where.

## Photo (`photos` table — existing)

| Field | Type | Move-relevant behavior |
|---|---|---|
| `id` | INTEGER PK | Unchanged across a move. |
| `shelter_id` | INTEGER FK → `shelters.id` | **Updated** to the target shelter's id on a successful move. |
| `file_name` | TEXT | Path/basename relative to `sheltersRoot`. **Updated** to reflect the new shelter slug's `photos/` folder, and renamed (timestamp-suffixed) if a basename collision occurs at the destination. |
| `updated` | TEXT (date) | **Updated** to today's date, consistent with `updatePhoto`'s existing behavior. |
| *(all other fields)* | — | Untouched by a move. |

## Shelter (`shelters` table — existing)

| Field | Type | Move-relevant behavior |
|---|---|---|
| `id`, `slug` | — | Source and target shelter identify the photo folders involved (`shelters/<slug>/photos/`). |
| `default_photo_id` | INTEGER, nullable FK → `photos.id` | **Cleared (set to NULL)** on the *source* shelter if it referenced the moved photo (FR-008). The *target* shelter's `default_photo_id` is never set automatically by a move. |

## Map Marker (`map_markers` table — existing)

| Field | Type | Move-relevant behavior |
|---|---|---|
| `photo_id` | INTEGER, nullable FK → `photos.id` | **Cleared (set to NULL)** on any marker referencing the moved photo (FR-009), regardless of which shelter that marker belongs to. |

## State transition (single atomic operation)

```
[Photo @ Shelter A]
  user picks Shelter B, clicks "Confirm move"
    1. fs: copy file A/photos/<name> → B/photos/<name|renamed>
    2. db (single transaction):
         UPDATE photos SET shelter_id = B.id, file_name = <new path>, updated = today WHERE id = photoId
         UPDATE shelters SET default_photo_id = NULL WHERE id = A.id AND default_photo_id = photoId
         UPDATE map_markers SET photo_id = NULL WHERE photo_id = photoId
    3. fs: delete A/photos/<name> (best-effort, only after the DB transaction commits)
    4. fs: purge stale thumbnail cache entries if the filename changed (best-effort)
[Photo @ Shelter B]
```

Failure handling (FR-011):
- Step 1 (copy) fails → abort immediately. No DB change, source file untouched, user sees an error.
- Step 2 (DB transaction) throws → it rolls back automatically (single `db.transaction`), so `photos.shelter_id` still points at A. The copy already made at B is deleted (best-effort cleanup) before reporting the error, so no orphaned duplicate is left behind.
- Step 3 (delete old file) fails → non-fatal; the DB is already authoritative and consistent (photo now belongs to B with the new file in place at B). The leftover file at A is orphaned on disk but not referenced by any DB row — the same "best-effort, DB-first" tolerance the existing `deletePhoto` IPC handler already accepts for its own file removal.
- Step 4 (thumbnail purge) fails → non-fatal, logged only, matching the existing `purgeThumbnailsForSource` call sites.
