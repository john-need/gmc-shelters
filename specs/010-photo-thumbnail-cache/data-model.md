# Data Model: Photo Thumbnail Caching

No SQLite schema changes. This feature introduces one derived, file-system-only entity; the existing `Photo` entity is unchanged.

## Photo (existing — `src/main/db/photos.ts`, unchanged)

Columns (unchanged): `id, photographer, file_name, caption, date_taken, notes, created, updated, shelter_id, alt_text, title, description, include_in_post, sort_order`

No new columns added. The source file's filesystem mtime (not a DB column) drives thumbnail staleness — see below.

## ThumbnailCacheEntry (new — file system only, no DB table)

Not persisted in SQLite. Represented purely as a cache file on disk:

| Field | Type | Description |
|---|---|---|
| `photoId` | number | FK to `photos.id` (not enforced by DB — derived cache, not canonical data) |
| `sizeClass` | `'grid'` \| `'preview'` | Which of the two cached sizes this file represents |
| `sourceMtimeMs` | number | `mtimeMs` of the source photo file at generation time, embedded in the filename |
| filename pattern | string | `<photoId>-<sourceMtimeMs>.png`, stored under `app.getPath('userData')/photo-thumbnails/<sizeClass>/` |

**Lifecycle**:
1. First request for `(photoId, sizeClass)` at the photo's current mtime → cache miss → generate via `nativeImage.createThumbnailFromPath` → write file → serve.
2. Subsequent requests for the same `(photoId, sizeClass, mtime)` → cache hit → serve existing file, no regeneration.
3. Source photo file changes (new mtime) → filename no longer matches → automatic cache miss → regenerate. Stale entries for old mtimes are simply orphaned on disk (no eviction, per spec assumption — acceptable given thumbnail file sizes are a few KB each).
4. No explicit deletion path: deleting a photo via `PHOTOS_DELETE` does not need to clean up its thumbnail files (unbounded cache is an accepted tradeoff per `/speckit-clarify`); this can be revisited if disk usage ever becomes a real concern.

**Validation rules**: None beyond successful generation. If `nativeImage.createThumbnailFromPath` fails (corrupt/unreadable source file), no cache file is written and the protocol handler falls back to serving the full-resolution original (or the existing broken-image behavior if that also fails) — satisfying spec FR-008.

## Size classes

| Size class | Target dimensions | Used by |
|---|---|---|
| `grid` | small, fixed upper bound (e.g. 240×240) | `PhotoCard` (grid view), `ListRow` (list view) |
| `preview` | larger, fixed upper bound (e.g. 800×600) | `ShelterTab` default photo, `PhotoDetailPane` selected-photo preview |

Exact pixel targets are an implementation detail to finalize during task execution by checking current rendered sizes in `index.css`; values above are upper bounds intended to avoid visible upscaling at today's UI sizes per research.md.
