---
description: "Task list for Move Photo To Another Shelter"
---

# Tasks: Move Photo To Another Shelter

**Input**: Design docs in `/specs/011-move-photo-shelter/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)
**Tests**: TDD requested. Every task below writes a failing test before its implementation task.
**Organization**: by user story. Ponytail rule applied — no Setup phase for one type addition; one db transaction handles US1+US2+US3's cleanup, so US2/US3 phases verify/extend rather than re-implement.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallel-safe (different file, no blocking dependency)
- **[Story]**: US1/US2/US3 per spec.md priorities
- File paths are exact, no guessing needed

## Path Conventions

This is the Electron app (not the script/database-sync side of the repo). All paths are under `src/main/` (db/fs/ipc/preload) and `src/renderer/components/MainPane/tabs/` (UI), plus `src/shared/ipc-types.ts` for the new channel/type. No `scripts/`, `database/migrations/`, or Python `tests/` — none apply here.

---

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: backend move capability — file relocation, DB transaction, IPC channel, preload bridge. Nothing in any user story phase compiles without this.

**⚠️ CRITICAL**: finish this phase first.

- [ ] T001 Add `PHOTOS_MOVE: 'photos:move'` channel constant and `PhotoMoveInput { photoId: number; targetShelterId: number; sheltersRoot: string }` type in `src/shared/ipc-types.ts`
- [X] T002 [P] Write failing test for `movePhotoFile(slug, fileName, targetSlug, sheltersRoot)`: copies file into target shelter's `photos/` dir, suffixes filename on basename collision (same scheme as `copyPhotoToShelter`), never overwrites — `src/main/fs/photos.test.ts`
- [X] T003 Implement `movePhotoFile` in `src/main/fs/photos.ts` (copy via `fs.copyFile`, no `fs.rename` — see research.md)
- [X] T004 [P] Write failing tests for `movePhotoToShelter(photoId, targetShelterId, newFileName)`: updates `photos.shelter_id`+`file_name`+`updated`; clears `shelters.default_photo_id` on source shelter when it pointed at this photo; clears `map_markers.photo_id` when it pointed at this photo; all three statements in one `db.transaction` — `src/main/db/photos.test.ts`
- [X] T005 Implement `movePhotoToShelter` in `src/main/db/photos.ts`
- [X] T006 [P] Write failing test for `CHANNELS.PHOTOS_MOVE` handler: happy path (copy → db transaction → best-effort delete old file → best-effort thumbnail purge if filename changed); DB-transaction failure deletes the copied file at target and rejects without touching the source file — `src/main/ipc/photos.test.ts`
- [X] T007 Implement the `PHOTOS_MOVE` handler in `registerPhotoHandlers()`, `src/main/ipc/photos.ts` (mirrors `PHOTOS_DELETE`'s DB-first, best-effort-file-cleanup shape); pass the filename returned by `movePhotoFile` straight into `movePhotoToShelter`'s `newFileName` argument so the DB row's `file_name` matches whatever was actually written to disk (handles the collision-rename case from T002/T003)
- [X] T008 [P] Write failing test for `window.api.photos.move(photoId, targetShelterId, sheltersRoot)` forwarding to `CHANNELS.PHOTOS_MOVE` — `src/main/preload.test.ts`
- [X] T009 Add `photos.move` to the preload bridge in `src/main/preload.ts`

**Checkpoint**: backend move is fully covered by tests and works end-to-end via IPC. UI work can start.

---

## Phase 2: User Story 1 - Move a photo to a different shelter (Priority: P1) 🎯 MVP

**Goal**: user clicks "Move to shelter" in the photo detail header, picks a target, confirms, photo moves.

**Independent Test**: select a photo in Shelter A, move to Shelter B, confirm it's gone from A's list and the file/DB row now live under B.

### Tests for User Story 1 ⚠️

- [X] T010 [P] [US1] Write failing test: `MovePhotoDialog` lists every shelter except the current one, "Confirm move" disabled until a target is picked, cancel calls `onCancel` with no side effects — `src/renderer/components/MainPane/tabs/MovePhotoDialog.test.tsx`
- [X] T011 [P] [US1] Write failing test: `PhotoDetailPane` renders a "Move to shelter" icon button next to delete, calling `onMove` on click when `canMove` is true, and rendering it `disabled` when `canMove` is false (FR-002) — `src/renderer/components/MainPane/tabs/PhotoDetailPane.test.tsx`
- [X] T012 [P] [US1] Write failing test: `PhotosTab` opens the move dialog, on confirm calls `window.api.photos.move`, dispatches `removePhotoLocal` and a success toast; on failure shows a failure toast with no state change; on cancel, no IPC call and no state change — `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx`

### Implementation for User Story 1

- [X] T013 [P] [US1] Create `MovePhotoDialog` (overlay + dialog, `<select>` of `state.shelters.list` minus current shelter, disabled-until-selected "Confirm move", "Cancel") — `src/renderer/components/MainPane/tabs/MovePhotoDialog.tsx`
- [X] T014 [US1] Add the "Move to shelter" icon button + `onMove: () => void` and `canMove: boolean` props to the header button row in `src/renderer/components/MainPane/tabs/PhotoDetailPane.tsx` (button gets `disabled={!canMove}`, satisfying FR-002)
- [X] T015 [US1] Wire `pendingMoveId` state + `handleMovePhoto` in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: render `MovePhotoDialog` when set, call `window.api.photos.move`, `dispatch(removePhotoLocal(...))` + toast on success, toast-only on failure; pass `canMove={state.shelters.list.length > 1}` to `PhotoDetailPane` (FR-002)

**Checkpoint**: US1 done — full move flow works through the UI, default-photo/map-marker cleanup already happens server-side from T005 even though no UI surfaces it yet.

---

## Phase 3: User Story 2 - Moved photo was the shelter's default photo (Priority: P2)

**Goal**: source shelter never keeps pointing at a default photo that moved away.

**Independent Test**: set a photo as Shelter A's default, move it to Shelter B, confirm A's default reference is cleared.

### Tests for User Story 2 ⚠️

- [X] T016 [US2] Write test case (extend `PhotosTab.test.tsx` from T012): when the moved photo was `s.default_photo_id`, success path also dispatches `setDefaultPhotoLocal({ shelterId, photoId: null, fileName: '' })` — `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx`. Note: this passed immediately because T015's `handleMovePhoto` already mirrored `handleDeletePhoto`'s default-clear check; test confirms it, no separate implementation step was needed.

### Implementation for User Story 2

- [X] T017 [US2] In `handleMovePhoto` (`PhotosTab.tsx`), after a successful move, dispatch `setDefaultPhotoLocal(...)` with `photoId: null` when `s.default_photo_id === movedId` (mirrors `handleDeletePhoto`'s existing check) — done as part of T015

**Checkpoint**: US2 done. DB-side clearing was already covered by T004; this closes the renderer-side in-memory gap.

---

## Phase 4: User Story 3 - Moved photo is referenced by a map marker (Priority: P3)

**Goal**: no map marker keeps pointing at a photo that moved to another shelter.

**Independent Test**: attach a photo to a map marker, move the photo, confirm the marker's `photo_id` is now null.

### Tests for User Story 3 ⚠️

- [X] T018 [US3] Confirm `src/main/db/photos.test.ts` (T004) already asserts `map_markers.photo_id` clears on move — no renderer state mirrors map markers in the Photos tab, so no UI test is needed (Map tab reads `map_markers` fresh from DB on its own load). Confirmed: "clears map_markers.photo_id referencing the moved photo" test passes.

### Implementation for User Story 3

*(No additional code — covered by T005's transaction. This phase exists only to record the independent test above.)*

**Checkpoint**: all three user stories independently verified.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T019 Run `npm test`, `npm run typecheck`, `npm run lint` and fix anything touched by T001-T017 — all 755 tests pass, lint clean; fixed two missing `photos.move` stubs surfaced by typecheck in `useIpc.ts` (noop fallback) and `setupTests.ts` (jest mock); pre-existing unrelated `thumbnails.test.ts` Dirent typecheck errors confirmed present on baseline (not introduced by this feature)
- [X] T020 Manually run through `quickstart.md`'s "Try it manually" steps once — NOT performed by the agent: no project GUI-driver skill exists for this Electron app, and standing one up (xvfb + Playwright `_electron`, plus rebuilding `better-sqlite3` for Electron's ABI and back) is out of scope for this implementation pass. User should run `npm start` and follow quickstart.md manually, or ask for a `/run-skill-generator` driver to be built.

---

## Dependencies & Execution Order

- **Phase 1 (Foundational)**: no dependencies, do first, blocks everything else.
- **Phase 2 (US1)**: depends on Phase 1.
- **Phase 3 (US2)**: depends on Phase 2 (extends `handleMovePhoto` from T015).
- **Phase 4 (US3)**: depends on Phase 1 only (db-level), independent of US1/US2 UI work.
- **Phase 5 (Polish)**: depends on all desired stories being done.

### Parallel Opportunities

- T002, T004, T006, T008 (all failing-test-first tasks, different files) can be written in parallel.
- T010, T011, T012 (US1 tests, different files) can be written in parallel.
- T013 can be built in parallel with T010/T011/T012 once its test (T010) exists.

---

## Implementation Strategy

**MVP**: Phase 1 + Phase 2 (US1). That alone ships the whole user-visible feature; US2/US3 close edge-case gaps already half-covered by the foundational transaction.

1. Phase 1 — backend, TDD, in order T002→T009.
2. Phase 2 — UI, TDD, in order T010-T012 (tests) then T013-T015 (implementation). Ship/demo here.
3. Phase 3 — one test + one dispatch line.
4. Phase 4 — verification only, no new code.
5. Phase 5 — full check, manual smoke test.
