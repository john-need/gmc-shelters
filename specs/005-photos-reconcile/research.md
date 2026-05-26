# Research: Photos Tab Reconcile

**Feature**: `005-photos-reconcile`  
**Date**: 2026-05-26

No external unknowns were found. All decisions derive from the existing codebase patterns and well-established Node.js / Electron idioms.

---

## Decision 1: Filesystem Scan via `fs.promises.readdir`

**Decision**: Use `fs.promises.readdir(dir)` (Node built-in) to list files in `shelters/{slug}/photos/`, filter by recognised image extensions (case-insensitive), and return bare filenames.

**Rationale**: `readdir` is already used in the same `src/main/fs/` module context (via `fs` imports). It is async, returns an array of filenames, requires no additional dependencies, and is the canonical approach for directory listing in Node.js. For a directory of up to 500 files, a single flat `readdir` completes in well under 100ms on any local filesystem.

**Alternatives considered**:
- `glob` / `fast-glob`: adds a dependency for a problem that flat `readdir` solves without one.
- Recursive scan: unnecessary — the existing upload flow writes all photos into the flat `shelters/{slug}/photos/` directory with no subdirectories.

---

## Decision 2: Filename Normalisation for Matching

**Decision**: Normalise DB `file_name` values by (a) stripping the legacy `shelters/` prefix and (b) stripping the `{slug}/photos/` segment to obtain a bare filename; then compare case-insensitively against filesystem filenames.

**Rationale**: The existing `photoFilePath()` function already handles the `shelters/` prefix strip. New photos are inserted with the relative path `{slug}/photos/{fileName}` (see `ipcMain.handle(CHANNELS.PHOTOS_UPLOAD, ...)`). By normalising to the bare filename on both sides, matching is consistent regardless of which path format a row was inserted with.

**Alternatives considered**:
- Comparing full paths: fragile — `sheltersRoot` may differ across machines or app versions.
- Requiring all DB rows to use a canonical format: a migration would be needed; deferred; normalisation at query time is safer.

---

## Decision 3: Two-Request IPC Split (Scan + Apply)

**Decision**: Implement two separate IPC handlers — `PHOTOS_RECONCILE_SCAN` (read-only, returns diff lists) and `PHOTOS_RECONCILE_APPLY` (write, takes selected items) — rather than a single combined handler.

**Rationale**: Matching the existing pattern in `photos.ts` where read and write operations are separate channels. The scan may complete and the operator may cancel without ever applying changes; a single handler would conflate intent. Separation also makes each handler independently testable.

**Alternatives considered**:
- Single handler with a `dryRun` flag: adds conditional branching to a write path; harder to test atomically.

---

## Decision 4: Local Component State for Modal (Not Redux)

**Decision**: Reconcile modal open/close state, scan results, per-item selection state, and apply results are held in local React component state (`useState`) within `PhotosTab.tsx`, not in Redux.

**Rationale**: This data is entirely transient — it is meaningless after the modal closes. Adding it to Redux would require extra slice actions for ephemeral UI state that no other component reads. The existing tab components (`HistoryTab`, `SourcesTab`) all manage their own transient state locally. After apply, `dispatch(loadPhotos(shelterId))` reloads the global photos store, which is the only persistent state change.

**Alternatives considered**:
- Redux for reconcile state: over-engineered for single-modal transient state; no cross-component sharing needed.

---

## Decision 5: Best-Effort Apply (Per-Item Try/Catch)

**Decision**: The apply handler iterates over selected additions and deletions independently, wrapping each operation in a try/catch. All outcomes (success/failure) are collected and returned in `ReconcileApplyResult`. The handler never throws; it always returns a result summary.

**Rationale**: Matches the clarified spec (FR-006: best-effort, not all-or-nothing). A single insert or delete failure (e.g., file already registered by a concurrent operation, or DB constraint) should not void the entire batch. Operators can see exactly which items failed and why.

**Alternatives considered**:
- SQLite transaction with rollback: all-or-nothing semantics; rejected per spec clarification.
- Stop at first error: leaves batch in partial state without clarity; rejected per spec clarification.

---

## Decision 6: Test Strategy

**Decision**: Colocated Jest tests, following the existing pattern:
- `src/main/fs/photos.test.ts` — unit tests for `listPhotosDir` (mock `fs.promises.readdir`, test extension filtering and missing-dir graceful handling)
- `src/main/db/photos.test.ts` — unit tests for `clearDefaultPhoto` (in-memory SQLite or mock DB, test conditional clear)
- `src/main/ipc/photos.test.ts` — integration tests for both reconcile handlers (mock fs + real in-memory DB where feasible)
- `src/renderer/store/photosSlice.test.ts` — unit tests for `reconcileApply` thunk (mock `window.api`)

**Rationale**: All existing tests in `src/main/` and `src/renderer/store/` use this colocated pattern with Jest. No separate `tests/` directory exists for this Electron app (that directory is used by other tooling in the repo). The two Jest project configurations (main/renderer) already handle environment differences.
