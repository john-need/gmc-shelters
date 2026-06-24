# Implementation Plan: Photo Thumbnail Caching

**Branch**: `010-photo-thumbnail-cache` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/010-photo-thumbnail-cache/spec.md`

## Summary

Generate and cache two size classes of photo thumbnails ("grid/list" and "preview") on demand using Electron's built-in `nativeImage.createThumbnailFromPath` (no new dependency). Point the Photos tab grid/list, the Shelters tab default photo, and the Photos tab selected-photo preview at cached thumbnails instead of full-resolution originals. Keep full-resolution loading only for the photo editor modal. Cache lives under `app.getPath('userData')/photo-thumbnails/`, keyed by photo id + size class + source file mtime, served through the existing `shelter://` protocol via a new query parameter. Built test-first per project constitution: failing Jest unit tests for the thumbnail-cache module and IPC handler precede implementation; component tests assert the correct image source is requested in each of the four affected views.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js (Electron 32 main process), React 18 (renderer)
**Primary Dependencies**: Electron `nativeImage` (built-in, no new npm dependency); existing `src/main/fs/photos.ts` path helpers; existing `shelter://` custom protocol handler
**Storage**: Thumbnail cache files at `app.getPath('userData')/photo-thumbnails/<size>/<photoId>-<mtimeMs>.png`; no SQLite schema change (mtime-keyed filenames make the cache self-invalidating, no new DB columns needed)
**Testing**: Jest (existing two-project config — `src/main` and `src/renderer`); thumbnail generation mocked at the `nativeImage` boundary in unit tests; no real image decoding in CI
**Target Platform**: Electron 32 desktop app, macOS/Windows; thumbnail generation in main process only; renderer only requests via `shelter://` URLs
**Project Type**: Electron desktop application (this repo's app layer, not the Python scripts automation layer)
**Performance Goals**: Per spec SC-001/SC-002 — drag input lag never exceeds 100ms; grid/list of 50+ large photos renders previews within 2 seconds
**Constraints**: No new third-party dependency; thumbnails self-invalidate via source-file mtime in the cache key (no explicit invalidation logic needed); cache is unbounded (no eviction) per spec assumption
**Scale/Scope**: Per-shelter photo counts up to low hundreds; two thumbnail size classes per photo; four consumer call sites (PhotoCard grid, ListRow list, ShelterTab default photo, PhotoDetailPane selected preview)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] **Source of truth identified**: The `photos` table (`src/main/db/photos.ts`) and on-disk photo files under `<shelter>/photos/` remain the sole source of image content. Thumbnails are a derived, disposable local cache, not new canonical data — no DB schema change.
- [X] **Test-first scope identified**: Failing Jest tests planned first for `src/main/fs/thumbnails.ts` (cache key, generation, mtime invalidation), the updated `shelter://` protocol handler (query-param thumbnail routing), and renderer components (`PhotoCard`, `ListRow`, `ShelterTab`, `PhotoDetailPane`, `PhotoEditorDialog`) asserting correct URL/size requested.
- [X] **External contract coverage identified**: N/A — this is a purely internal rendering optimization with no out-of-repo consumer (per spec's Source of Truth section). No contract artifacts required.
- [X] **Idempotency and auditability identified**: N/A for sync/import workflows — this feature has no remote side effects. Local idempotency is structural: thumbnail generation is a pure function of (photo file bytes, size class), and the mtime-keyed cache filename makes regeneration-on-change automatic and rerun-safe (regenerating an unchanged photo is a cache hit, not a duplicate side effect).
- [X] **Minimal-change fit identified**: All changes live under `src/main/fs/`, `src/main/index.ts` (protocol handler), `src/renderer/utils/`, and the four existing renderer components — no new top-level directories, no new npm dependency.
- [X] **WordPress/theme boundary respected**: N/A — no WordPress or theme code involved.

> **Complexity note (Principle V)**: The constitution's `scripts/`, `database/`, and top-level `tests/` paths describe this repo's Python automation layer. This feature lives entirely in the Electron app (`src/main/`, `src/renderer/`), which has its own established structure with co-located `*.test.ts(x)` files (see feature 009's plan for the same precedent). This is consistent with prior Electron-app features and is not a violation.

## Project Structure

### Documentation (this feature)

```text
specs/010-photo-thumbnail-cache/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

(No `contracts/` directory — no external consumer per Constitution Check.)

### Source Code (Electron app)

```text
src/
├── main/
│   ├── fs/
│   │   ├── thumbnails.ts        ← NEW: cache key, generation via nativeImage, mtime invalidation
│   │   ├── thumbnails.test.ts   ← NEW (test-first)
│   │   └── photos.ts            ← unchanged; existing path helpers reused
│   └── index.ts                 ← MODIFIED: shelter:// protocol handler gains `?size=grid|preview` routing
│       index.test.ts            ← MODIFIED: new test cases for size-param routing + fallback
│
└── renderer/
    ├── utils/
    │   └── paths.ts              ← MODIFIED: buildPhotoUrl() gains optional size param
    │       paths.test.ts         ← MODIFIED
    └── components/MainPane/tabs/
        ├── PhotoCard.tsx         ← MODIFIED: request grid/list-size thumbnail
        ├── PhotoCard.test.tsx    ← MODIFIED
        ├── ListRow.tsx           ← MODIFIED: request grid/list-size thumbnail
        ├── ListRow.test.tsx      ← MODIFIED
        ├── ShelterTab.tsx        ← MODIFIED: default photo display requests preview-size thumbnail; DefaultPhotoModal picker thumbnails request grid-size
        ├── ShelterTab.test.tsx   ← MODIFIED
        ├── PhotoDetailPane.tsx   ← MODIFIED: selected-photo preview requests preview-size thumbnail
        ├── PhotoDetailPane.test.tsx ← MODIFIED
        ├── PhotosTab.tsx         ← MODIFIED: selectedPhotoUrl computation requests preview-size thumbnail
        ├── PhotosTab.test.tsx    ← MODIFIED
        └── PhotoEditorDialog.tsx ← UNCHANGED: continues loading full-resolution original
```

**Structure Decision**: All work fits inside the existing Electron app source tree (`src/main/fs/`, `src/main/index.ts`, `src/renderer/utils/`, `src/renderer/components/MainPane/tabs/`). One new file pair (`thumbnails.ts` + test) under `src/main/fs/`, alongside the existing `photos.ts` it depends on. No new directories, no new dependency, no SQLite migration.

## Complexity Tracking

*No Constitution Check violations — table omitted.*
