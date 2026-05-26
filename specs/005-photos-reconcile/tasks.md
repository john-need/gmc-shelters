# Tasks: Photos Tab Reconcile

**Input**: Design documents from `specs/005-photos-reconcile/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, quickstart.md ✅
**Tests**: Required per constitution for all new automation paths — write them first, confirm they fail, then implement.
**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[Story]**: User story this task belongs to (US1–US4 from spec.md)
- Exact file paths are included in every task description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add new IPC contracts and preload bridge entries that every subsequent phase depends on.

- [X] T001 Add 2 IPC channel constants (`PHOTOS_RECONCILE_SCAN`, `PHOTOS_RECONCILE_APPLY`), 6 new types (`UntrackedFile`, `OrphanedRecord`, `ReconcileScanResult`, `ReconcileApplyInput`, `ReconcileItemOutcome`, `ReconcileApplyResult`), and `reconcileScan` + `reconcileApply` entries to `ElectronAPI.photos` in `src/shared/ipc-types.ts`
- [X] T002 Add `photos.reconcileScan` and `photos.reconcileApply` bridge entries to the `photos` namespace in `src/main/preload.ts` (forward to `ipcRenderer.invoke(CHANNELS.PHOTOS_RECONCILE_SCAN, ...)` and `ipcRenderer.invoke(CHANNELS.PHOTOS_RECONCILE_APPLY, ...)`) and update the type import line (depends on T001 — types must exist before import)

**Checkpoint**: TypeScript types and IPC channel names are available to all layers; no logic implemented yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend logic (filesystem helper, DB helper, IPC handlers, Redux thunk) fully implemented and test-verified before any UI work begins.

**⚠️ CRITICAL**: Write all tests first and confirm they FAIL before implementing. No user story UI work can begin until this phase is complete.

### Tests — write and confirm failing first

- [X] T003 Write failing unit tests for `listPhotosDir(slug, sheltersRoot)` in `src/main/fs/photos.test.ts` covering: returns bare image filenames, filters non-image extensions, is case-insensitive on extension, returns `[]` when directory does not exist
- [X] T004 [P] Write failing unit tests for `clearDefaultPhoto(shelterId, photoId)` in `src/main/db/photos.test.ts` covering: clears `default_photo_id` when it matches `photoId`, no-op when it does not match
- [X] T005 [P] Write failing integration tests for `PHOTOS_RECONCILE_SCAN` handler in `src/main/ipc/photos.test.ts` covering: returns untracked files (on disk, not in DB), returns orphaned records (in DB, not on disk), both empty when in sync, handles missing photos directory
- [X] T006 [P] Write failing integration tests for `PHOTOS_RECONCILE_APPLY` handler in `src/main/ipc/photos.test.ts` covering: inserts selected files into `photos` table with filename-as-title, deletes selected orphaned records, clears `default_photo_id` when deleting the default photo, best-effort error collection (partial success), never throws
- [X] T007 [P] Write failing unit tests for `reconcileApply` async thunk in `src/renderer/store/photosSlice.test.ts` covering: calls `window.api.photos.reconcileApply` with correct input, returns `ReconcileApplyResult`

### Implementation — confirm tests pass after each item

- [X] T008 Implement `listPhotosDir(slug: string, sheltersRoot: string): Promise<string[]>` in `src/main/fs/photos.ts`: use `fs.promises.readdir` on `photosDirForSlug(slug, sheltersRoot)`, filter by `.jpg .jpeg .png .tif .tiff .webp` (case-insensitive), return bare filenames, return `[]` if directory does not exist
- [X] T009 [P] Implement `clearDefaultPhoto(shelterId: number, photoId: number): void` in `src/main/db/photos.ts`: check `shelters.default_photo_id`; if it matches `photoId`, run `UPDATE shelters SET default_photo_id = NULL WHERE id = ?`
- [X] T010 Register `PHOTOS_RECONCILE_SCAN` and `PHOTOS_RECONCILE_APPLY` handlers in `src/main/ipc/photos.ts`: scan handler normalises DB `file_name` values (strips `shelters/` and `{slug}/photos/` prefixes), computes diff lists, returns `ReconcileScanResult`; apply handler iterates additions and deletions independently with per-item try/catch, calls `clearDefaultPhoto` before each `deletePhoto`, returns `ReconcileApplyResult`
- [X] T011 Add `reconcileApply` async thunk (calls `window.api.photos.reconcileApply`) to `src/renderer/store/photosSlice.ts`

**Checkpoint**: All Phase 2 tests pass. Backend fully functional; renderers can invoke both IPC channels.

---

## Phase 3: User Story 1 — Discover and Register Untracked Photos (Priority: P1) 🎯 MVP

**Goal**: Operator opens the Reconcile modal, sees image files that are on disk but not in the database, selects any combination, and registers them as photo records.

**Independent Test**: Given a shelter folder with 3 untracked image files, open the Reconcile modal — all 3 appear unchecked in "Files not in database". Select 2 and click Reconcile — 2 new rows are created, the 3rd file remains unregistered.

- [X] T012 [P] [US1] Write failing component tests for `ReconcileModal` in `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx` (create file if not present): renders loading spinner on mount, renders "Files not in database" section with checkboxes when scan returns untracked files, disables Reconcile button when no checkboxes are checked
- [X] T013 [P] [US1] Add a "Reconcile" button to the Photos tab toolbar in `src/renderer/components/MainPane/tabs/PhotosTab.tsx` (place it in `photos-toolbar-right` alongside the Grid/List toggle buttons); clicking it sets a `showReconcile` state flag to `true`
- [X] T014 [US1] Implement the `ReconcileModal` component in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: modal overlay, auto-calls `window.api.photos.reconcileScan(s.id, sheltersRoot)` on mount, shows a loading indicator until scan completes, renders a "Files not in database" section with per-item checkboxes (default unchecked) and "Select All" / "Deselect All" controls (confirm T012 tests pass)
- [X] T015 [US1] Wire the "Reconcile" confirm button in `ReconcileModal`: collect selected bare filenames into `filesToAdd`, dispatch `reconcileApply` thunk with `{ shelterId, sheltersRoot, filesToAdd, recordIdsToDelete: [] }`, disable the button when nothing is selected

**Checkpoint**: User Story 1 independently functional — operator can register untracked files. US2 (orphaned records) section not yet visible.

---

## Phase 4: User Story 2 — Identify and Clean Up Orphaned Records (Priority: P2)

**Goal**: Operator sees database records whose files are missing from disk, selects any combination, and deletes them. Deleting the shelter's default photo record automatically clears the default designation.

**Independent Test**: Given 2 DB rows whose files do not exist on disk, open the Reconcile modal — both appear unchecked in "Records with no file". Select 1 and click Reconcile — that row is deleted; the other remains. If the deleted row was the default photo, `default_photo_id` is now NULL.

- [X] T016 [P] [US2] Add the "Records with no file" section to `ReconcileModal` in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: display each orphaned record's title and filename, per-item checkboxes (default unchecked), "Select All" / "Deselect All" controls
- [X] T017 [US2] Extend the "Reconcile" confirm action in `ReconcileModal` to include `recordIdsToDelete`: collect selected record IDs, pass to `reconcileApply` thunk; on completion, dispatch `removePhotoLocal` for each successfully deleted ID
- [X] T018 [P] [US2] Update the shelter's Redux state when `default_photo_id` may have been cleared: first verify `setDefaultPhotoLocal` in `src/renderer/store/sheltersSlice.ts` accepts `null` as `photoId` (update the payload type if needed); then after `reconcileApply` resolves, if any deleted ID matched `s.default_photo_id`, dispatch `setDefaultPhotoLocal({ shelterId: s.id, photoId: null, fileName: '' })` in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`

**Checkpoint**: User Stories 1 and 2 both independently functional.

---

## Phase 5: User Story 3 — Confirm a Clean Shelter (P3) & User Story 4 — Rerun Safety (P2)

**Goal US3**: When both scan lists are empty, the modal shows an "All photos are in sync" message. The Reconcile button is disabled when no items are selected.

**Goal US4**: Running the scan a second time after reconciling shows zero items in both lists. No duplicate rows are created by repeated reconcile runs.

**Independent Test US3**: Given a fully in-sync shelter, open the Reconcile modal — both sections show the "all clear" message; Reconcile button is disabled.

**Independent Test US4**: Run reconcile (register 2 untracked files), close, reopen the modal — "Files not in database" is empty. Run reconcile again — `photos` table has no duplicate rows for those filenames.

- [X] T019 [US3] Add empty-state handling to `ReconcileModal` in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: when scan returns both lists empty, replace section content with a single "All photos are in sync" message; disable the Reconcile button whenever no checkboxes are checked in either section
- [X] T020 [P] [US4] Write rerun-safety test in `src/main/ipc/photos.test.ts`: after a successful apply that registers 3 files, call scan again — `untrackedFiles` must be empty for those filenames
- [X] T021 [P] [US4] Write rerun-safety test in `src/renderer/store/photosSlice.test.ts`: calling `reconcileApply` twice with the same `filesToAdd` does not produce duplicate entries (second call is a no-op for already-registered files, verified via the scan result)

**Checkpoint**: All four user stories independently functional and test-verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Post-apply results summary, on-close photos list refresh, edge-case hardening, performance verification, and final validation.

- [X] T022 Implement on-close photos list refresh in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: when `ReconcileModal` closes after a reconciliation was applied (`appliedOnce` flag), dispatch `loadPhotos(s.id)` to reload the photos list from the database
- [X] T023 [P] Implement the post-apply results summary view in `ReconcileModal`: after `reconcileApply` resolves, replace both list sections with a summary (`N files added · M records deleted · K failed`); if failures exist, list each one with its brief reason; show only a "Close" button in this state
- [X] T024 [P] Harden the apply handler edge case in `src/main/ipc/photos.ts`: when an untracked file is selected for insertion but is missing from disk at apply time (deleted between scan and confirm), catch the `insertPhoto` error and include it in `failures` with reason "File not found at apply time"
- [X] T025 [P] Verify SC-001 performance: `listPhotosDir` uses a single O(n) `readdir` with in-memory Set comparison — 500 files will be well under 3 seconds
- [X] T026 Run the full Jest test suite (`npm test`) and confirm all new and existing tests pass; fix any regressions

**Checkpoint**: Feature complete, all tests passing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist before IPC handlers and thunk).
- **User Stories (Phases 3–5)**: Depend on Phase 2 completion (backend must be working before UI).
- **Polish (Phase 6)**: Depends on all user story phases being complete.

### User Story Dependencies

| Story | Depends on | Can proceed in parallel with |
|-------|-----------|------------------------------|
| US1 (Phase 3) | Phase 2 complete | — |
| US2 (Phase 4) | Phase 3 complete (shares modal component) | — |
| US3+US4 (Phase 5) | Phase 4 complete | — |

### Within Each Phase

- Test tasks MUST be written and confirmed failing before corresponding implementation tasks.
- All [P] tasks within a phase target different files and can be worked in parallel.

### Parallel Opportunities

- T003, T004, T005, T006, T007 — all test-writing tasks for different files, parallelizable.
- T008, T009 — different files (fs vs db), parallelizable.
- T012 (component tests) and T013 (toolbar button) target different concerns within Phase 3, parallelizable.
- T020, T021 (rerun safety tests) parallelizable within Phase 5.
- T023, T024, T025 (summary view, edge-case hardening, performance check) parallelizable in Phase 6.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (types + preload bridge).
2. Complete Phase 2 (all tests written + backend implemented).
3. Complete Phase 3 (US1 UI — untracked files only).
4. Validate US1 manually: copy files into a shelter folder, open Reconcile modal, register them, confirm they appear in the Photos tab.

### Incremental Delivery

1. Phase 1 + 2 together (backend foundation).
2. Phase 3 (US1) — register untracked files end-to-end.
3. Phase 4 (US2) — clean up orphaned records end-to-end.
4. Phase 5 (US3+US4) — clean state message + rerun safety.
5. Phase 6 — polish and final test run.

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies — safe to run in parallel.
- The `ReconcileModal` component lives in `PhotosTab.tsx` for phases 3–5; extract to `ReconcileModal.tsx` only if the file exceeds ~250 lines total.
- Filename normalisation (strip `shelters/` and `{slug}/photos/` prefixes) must be identical in both the scan IPC handler and its tests — extract to a shared helper if needed.
- Do not delete any files from disk in this feature; all mutations are DB-only.
