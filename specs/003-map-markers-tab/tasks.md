# Tasks: Map Markers Tab

**Input**: Design documents from `/specs/003-map-markers-tab/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓
**Approach**: TDD — write failing tests first, then implement to make them pass. Never skip the red → green cycle.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US4) — required in story phases, omitted in Setup/Foundational/Polish
- Include exact file paths in every task description

## Path Conventions

- Migration: `database/migrations/003-add-map-markers-table.sql`
- Shared types: `src/shared/ipc-types.ts`
- Main process DB: `src/main/db/map-markers.ts`
- Main process IPC: `src/main/ipc/map-markers.ts`
- Main process entry: `src/main/index.ts`
- Preload bridge: `src/main/preload.ts`
- Redux slice: `src/renderer/store/mapMarkersSlice.ts`
- Redux root: `src/renderer/store/index.ts`
- UI slice: `src/renderer/store/uiSlice.ts`
- Main pane: `src/renderer/components/MainPane/MainPane.tsx`
- Tab component: `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema, shared types, and UI slice extension needed before any story work can begin.

- [x] T001 Create `database/migrations/003-add-map-markers-table.sql` — use the schema from `data-model.md`: id, shelter_id (FK CASCADE), latitude REAL NOT NULL, longitude REAL NOT NULL, name, start_year, end_year (nullable), change_type, notes, slug, is_extant (0/1), photo_id (nullable), created, updated; add index `idx_map_markers_shelter`
- [x] T002 [P] Extend `src/shared/ipc-types.ts` — add: `CHANGE_TYPES` const array, `ChangeType` union, `MapMarker` interface, `MapMarkerInput` type, four new CHANNELS constants (`MAP_MARKERS_GET_BY_SHELTER`, `MAP_MARKERS_CREATE`, `MAP_MARKERS_UPDATE`, `MAP_MARKERS_DELETE`), and `mapMarkers` namespace in `ElectronAPI`
- [x] T003 [P] Add `'markers'` to the `activeTab` string literal union in `src/renderer/store/uiSlice.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB layer and Redux slice that every user story depends on. TDD: write failing tests first, then implement.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Failing Tests First ⚠️

- [x] T004 Write failing DB unit tests in `src/main/db/map-markers.test.ts` using in-memory `better-sqlite3` (apply the migration SQL first in `beforeAll`). Cover: `getByShelterId` returns markers ordered by `start_year`; `insertMapMarker` returns full `MapMarker` with `is_extant` as boolean; `updateMapMarker` persists changes and returns updated row; `deleteMapMarker` removes the row; cascade delete removes markers when shelter deleted.
- [x] T005 [P] Write failing Redux slice tests in `src/renderer/store/mapMarkersSlice.test.ts`. Cover: initial state shape (`{ byShelter: {}, loading: false, error: null }`); `loadMapMarkers.pending/fulfilled/rejected` reducer cases; `createMarker.fulfilled` appends to `byShelter[shelterId]`; `updateMarker.fulfilled` replaces the updated marker in `byShelter`; `deleteMarker.fulfilled` removes the marker from `byShelter`; **C2**: `deleteMarker.fulfilled` with payload `{ gapWarning: true, uncoveredRange: string }` does NOT mutate `byShelter` (gap-warning branch — state is left unchanged so the UI can read the warning from the action payload).

### Implementation

- [x] T006 Create `src/main/db/map-markers.ts` — implement `getByShelterId(db, shelterId)`, `insertMapMarker(db, input, shelter)`, `updateMapMarker(db, id, input)`, `deleteMapMarker(db, id)`; convert `is_extant` integer→boolean with a `rowToMapMarker()` helper (mirrors `rowToPhoto()` pattern in `src/main/db/photos.ts`)
- [x] T007 [P] Create `src/renderer/store/mapMarkersSlice.ts` — state shape `{ byShelter: Record<number, MapMarker[]>, loading: boolean, error: string | null }`; async thunks: `loadMapMarkers(shelterId)`, `createMarker(input)`, `updateMarker({ id, input })`, `deleteMarker(id, opts?)`. **C2**: the `deleteMarker` thunk must handle two resolved shapes from the IPC layer — (a) `undefined`/void when deletion succeeded (remove marker from `byShelter`), and (b) `{ gapWarning: true, uncoveredRange: string }` when deletion was withheld (leave `byShelter` unchanged, surface the warning object as the fulfilled action payload for the component to inspect); export action creators and reducer
- [x] T008 [P] Add `mapMarkers: mapMarkersReducer` to the root combineReducers in `src/renderer/store/index.ts`
- [x] T009 [P] Extend `src/main/preload.ts` — expose `window.api.mapMarkers` via `contextBridge.exposeInMainWorld` with `getByShelter`, `create`, `update`, `delete` invoking the four new CHANNELS

**Checkpoint**: All DB and slice tests pass. Foundation ready.

---

## Phase 3: User Story 1 — View All Map Markers (Priority: P1) 🎯 MVP

**Goal**: Researcher can open the Map Markers tab and see all historical location entries for the selected shelter, ordered by `start_year` ascending, with "present" displayed for null `end_year`.

**Independent Test** (from spec.md): Select any shelter with at least one map marker; navigate to Map Markers tab; verify all markers appear with name, lat/lon, year range, and change type, ordered chronologically.

### Failing Tests First — US1 ⚠️

- [x] T010 [US1] Write failing IPC handler test in `src/main/ipc/map-markers.test.ts` for `MAP_MARKERS_GET_BY_SHELTER` — mock `getDb()` and `getByShelterId`; assert handler returns markers array sorted by `start_year`; assert empty array returned when shelter has no markers
- [x] T011 [P] [US1] Write failing component tests in `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx` — render with empty `byShelter` state → shows empty-state message with "Add First Marker" prompt; render with 3 markers → all appear with name, coordinates, year range (null end_year shown as "present"), and change type; markers are in `start_year` order. **C1** (badge reactivity): render with 2 markers → assert count prop/badge = 2; after `createMarker.fulfilled` updates store → assert count = 3; after `deleteMarker.fulfilled` removes a marker → assert count = 1.

### Implementation — US1

- [x] T012 [US1] Create `src/main/ipc/map-markers.ts` — implement `registerMapMarkerHandlers(ipcMain, getDb)` with the `MAP_MARKERS_GET_BY_SHELTER` handler; register file in `src/main/index.ts`
- [x] T013 [US1] Create `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx` — read `state.mapMarkers.byShelter[shelterId]`; render sorted list showing name, lat (4 dp), lon (4 dp), `start_year–end_year` (or "present"), change type; render empty state when no markers
- [x] T014 [US1] Extend `src/renderer/components/MainPane/MainPane.tsx` — add Map Markers tab object `{ id: 'markers', label: 'Map Markers', count: markers.length }` to the `tabs` array; call `dispatch(loadMapMarkers(s.id))` in the `useEffect` alongside existing loads; render `<MapMarkersTab />` inside `tab-body` when `activeTab === 'markers'`

**Checkpoint**: Map Markers tab is visible; markers load and display; empty state works; badge count updates.

---

## Phase 4: User Story 2 — Add a New Map Marker (Priority: P1)

**Goal**: Archivist can add a new marker with name, coordinates, year range, change type, and notes. The system validates coordinates and year coverage before saving.

**Independent Test** (from spec.md): On a shelter with a known year range, add a marker whose year range fills a gap; confirm system accepts it and coverage is now complete.

### Failing Tests First — US2 ⚠️

- [x] T015 [US2] Write failing tests for `MAP_MARKERS_CREATE` handler in `src/main/ipc/map-markers.test.ts`:
  - Rejects when `latitude` is null/missing → validation error
  - Rejects when `latitude` outside `[-90, 90]` → validation error with clear message
  - Rejects when `longitude` outside `[-180, 180]` → validation error
  - **U1**: Rejects when `start_year` < `shelter.start_year` → validation error
  - **U1**: Rejects when `start_year` > `shelter.end_year` (when shelter has non-null end_year) → validation error
  - **A2**: Rejects when `start_year` duplicates an existing marker's `start_year` for the same shelter → validation error
  - Rejects when new marker would create a year gap → blocked with gap description (e.g., "Year range 1971–1974 is not covered")
  - **A1**: Rejects when new marker overlaps an existing marker (new marker's `end_year` > next marker's `start_year`) → blocked with overlap description
  - Accepts valid marker with contiguous, non-overlapping coverage → returns full `MapMarker`
  - Accepts null `end_year` when `shelter.is_extant = true` AND it is the last marker
  - Rejects null `end_year` when `shelter.is_extant = false`
- [x] T016 [P] [US2] Write failing component tests for the Add Marker form in `MapMarkersTab.test.tsx`:
  - "Add Marker" button visible; clicking opens form
  - Save button disabled until latitude and longitude are non-empty
  - Selecting "Other" in change_type picklist reveals a custom text input
  - Submitting valid form calls `window.api.mapMarkers.create` and closes form
  - Submitting with validation error shows the error message from the handler

### Implementation — US2

- [x] T017 [US2] Implement `MAP_MARKERS_CREATE` handler in `src/main/ipc/map-markers.ts` — coordinate range check; `start_year` bounds check (≥ shelter.start_year, ≤ shelter.end_year when non-null); duplicate `start_year` check; load all shelter markers; run `validateCoverage(markers, shelter)` that returns `null | string` (describes gap or overlap); if any violation, throw/return error; otherwise call `insertMapMarker`; denormalized fields (`slug`, `is_extant`, `photo_id`) copied from shelter on insert. Note: `validateCoverage` checks both gaps AND overlaps — sorted markers must satisfy `markers[i].end_year === markers[i+1].start_year` (exact adjacency, no gap, no overlap)
- [x] T018 [US2] Add Add Marker form to `MapMarkersTab.tsx` — fields: name, latitude (required), longitude (required), start_year, end_year, change_type picklist (CHANGE_TYPES + "Other"), custom text input (shown when "Other" selected), notes; save wires to `createMarker` thunk; cancel resets form; show inline validation errors

**Checkpoint**: Archivists can add markers; invalid coordinates and coverage gaps are blocked.

---

## Phase 5: User Story 3 — Edit an Existing Map Marker (Priority: P2)

**Goal**: Archivist can select a marker, modify any user-editable field, and save changes. Coverage validation runs on edit just as on create.

**Independent Test** (from spec.md): Edit the latitude of an existing marker, save, confirm updated value is shown and persists across navigation.

### Failing Tests First — US3 ⚠️

- [x] T019 [US3] Write failing tests for `MAP_MARKERS_UPDATE` handler in `src/main/ipc/map-markers.test.ts`:
  - Same coordinate range validation as CREATE
  - **U1/A2**: Same `start_year` bounds and duplicate checks as CREATE (excluding the marker being updated from the duplicate check)
  - Coverage check excludes the marker being updated (uses remaining markers + updated version)
  - Accepts a valid edit → returns updated `MapMarker`
  - **A1**: Rejects a gap-creating edit → blocked with gap description
  - **A1**: Rejects an overlap-creating edit → blocked with overlap description
- [x] T020 [P] [US3] Write failing component tests for edit mode in `MapMarkersTab.test.tsx`:
  - Clicking edit on a marker populates form fields with current values
  - Clicking Cancel while editing returns to list without changes
  - Saving calls `window.api.mapMarkers.update` with updated fields
  - Changes are reflected in list immediately after save

### Implementation — US3

- [x] T021 [US3] Implement `MAP_MARKERS_UPDATE` handler in `src/main/ipc/map-markers.ts` — same validation as CREATE; exclude the current marker ID when loading markers for coverage check; call `updateMapMarker`
- [x] T022 [US3] Add inline edit mode to `MapMarkersTab.tsx` — clicking an "Edit" button on a row enters edit mode (same form fields as Add); Cancel resets to list view; Save wires to `updateMarker` thunk; re-read `change_type` using `splitChangeType()` helper to populate base + custom fields

**Checkpoint**: Existing markers can be edited; all validations apply equally to edits.

---

## Phase 6: User Story 4 — Delete a Map Marker (Priority: P2)

**Goal**: Archivist can delete a marker. If deletion would create a year gap, they are warned and must confirm before deletion proceeds.

**Independent Test** (from spec.md): Delete a marker and confirm it no longer appears in the list.

### Failing Tests First — US4 ⚠️

- [x] T023 [US4] Write failing tests for `MAP_MARKERS_DELETE` handler in `src/main/ipc/map-markers.test.ts`:
  - Deleting with no gap → marker removed, no warning
  - Deleting when it creates a gap → returns `{ gapWarning: true, uncoveredRange: string }` without deleting
  - Deleting with `{ confirmed: true }` flag even when gap would result → marker removed
  - Cancelling (no `confirmed`) when gap would result → marker not removed
- [x] T024 [P] [US4] Write failing component tests for delete confirmation in `MapMarkersTab.test.tsx`:
  - "Delete" button on each marker row
  - If no gap: calls `window.api.mapMarkers.delete` and marker disappears from list
  - If gap warning returned: shows confirmation dialog with gap description
  - Confirming dialog calls `window.api.mapMarkers.delete` again with `{ confirmed: true }`
  - Cancelling dialog leaves marker in list

### Implementation — US4

- [x] T025 [US4] Implement `MAP_MARKERS_DELETE` handler in `src/main/ipc/map-markers.ts` — load remaining markers after removing candidate; run `validateCoverage`; if gap and `!opts.confirmed`, return `{ gapWarning: true, uncoveredRange }` without deleting; if no gap or `opts.confirmed`, call `deleteMapMarker`
- [x] T026 [US4] Add delete button and confirmation dialog to `MapMarkersTab.tsx` — "Delete" button per row; on click, call `deleteMarker` thunk; if response contains `gapWarning`, show modal with `uncoveredRange` text and Confirm/Cancel; re-dispatch with `confirmed: true` on Confirm

**Checkpoint**: Markers can be deleted; gap warnings surface and require explicit confirmation.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Denormalized sync (FR-012) and overall integration validation.

### Denormalized Sync — FR-012

- [x] T027 Write failing test in `src/main/ipc/shelters.test.ts` for denormalized sync — after `SHELTERS_UPDATE` fires, assert that `UPDATE map_markers SET slug=?, is_extant=?, photo_id=? WHERE shelter_id=?` was called with the shelter's updated values (mock `db.prepare().run` and assert arguments)
- [x] T028 Implement denormalized sync in `src/main/ipc/shelters.ts` — immediately after the shelter `UPDATE` statement, call `db.prepare('UPDATE map_markers SET slug = ?, is_extant = ?, photo_id = ? WHERE shelter_id = ?').run(shelter.slug, shelter.is_extant ? 1 : 0, shelter.default_photo_id, shelter.id)` in the same synchronous chain

### Integration & Cleanup

- [x] T029 [P] Run full test suite (`npm test`) and confirm all new tests pass (DB, IPC handlers, Redux slice, components); fix any test failures before closing this task
- [x] T030 [P] Verify the migration runs cleanly against the live database (`database/gmc_shelters.sqlite`) — apply migration and confirm `map_markers` table exists with correct schema; rollback if any error

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately. T002 and T003 can run in parallel with T001.
- **Foundational (Phase 2)**: Requires Phase 1 complete. T004 and T005 (tests) can run in parallel. T006 depends on T004 (test file drives implementation). T007 depends on T005. T008 and T009 can parallel with each other after T007.
- **US1 (Phase 3)**: Requires Phase 2 complete. T010 and T011 can run in parallel. T012 depends on T010. T013 depends on T011. T014 depends on T012 and T013.
- **US2 (Phase 4)**: Requires US1 complete (IPC handler file exists to extend). T015 and T016 can parallel. T017 depends on T015. T018 depends on T016.
- **US3 (Phase 5)**: Requires US2 complete. T019 and T020 can parallel. T021 depends on T019. T022 depends on T020.
- **US4 (Phase 6)**: Requires US3 complete (same handler file). T023 and T024 can parallel. T025 depends on T023. T026 depends on T024.
- **Polish (Phase 7)**: T027 and T028 are independent of US phases. T029 and T030 require all phases complete.

### User Story Dependencies

- US1 → US2 → US3 → US4 (each extends the same IPC handler file and tab component)
- US2, US3, US4 all depend on the `validateCoverage` helper introduced in US2 (T017)
- FR-012 sync (T027–T028) is independent of US1–US4 and can proceed after Phase 2

### TDD Cycle (within each story phase)

1. Write failing test — run `npm test` and confirm it **fails** (red)
2. Implement minimum code to pass — run `npm test` and confirm it **passes** (green)
3. Refactor if needed — keep tests green
4. Do not advance to next task until tests pass

### Parallel Opportunities

- T002 ∥ T003 (different files in Phase 1)
- T004 ∥ T005 (different test files in Phase 2)
- T006 ∥ T007 (different implementation files in Phase 2, after their respective tests)
- T010 ∥ T011 (IPC test ∥ component test in US1)
- T015 ∥ T016, T019 ∥ T020, T023 ∥ T024 (same pattern per story)
- T029 ∥ T030 (different concerns in Polish)

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 — both P1)

1. Complete Setup (T001–T003).
2. Complete Foundational (T004–T009).
3. Complete US1 — tab visible, markers load and display.
4. Complete US2 — archivists can add markers with full validation.
5. Validate both stories independently before expanding scope.

### Incremental Delivery

1. Setup → Foundational → US1 (view) → US2 (add) → US3 (edit) → US4 (delete) → Polish
2. Each story is independently testable via its Independent Test after the story's checkpoint.
3. Polish phase (FR-012 sync) can be done in parallel with later stories if multiple contributors are working.

### Single-contributor Strategy

Follow phases sequentially. Within each story: write all test tasks first (red), then all implementation tasks (green). Never write implementation without a failing test.

---

## Notes

- `[P]` tasks = different files, no shared state dependencies.
- Every story must be independently completable and testable.
- The `validateCoverage` helper (introduced in T017) is shared by CREATE, UPDATE, and DELETE handlers — extract it to a named function inside `map-markers.ts` so all three handlers can call it. It must validate: (1) no gaps (`markers[i].end_year === markers[i+1].start_year`), (2) no overlaps (`markers[i].end_year <= markers[i+1].start_year`), and (3) first marker's `start_year` equals `shelter.start_year`. The exact adjacency rule is: `markers[i].end_year` must equal `markers[i+1].start_year` (touching, not overlapping, not gapped).
- The `splitChangeType` / `combineChangeType` UI helpers can be extracted to a small util inside the tab component file.
- Do not reuse `jest.resetModules()` in IPC tests — it causes mock instance divergence (see `src/main/ipc/shelters.test.ts` for the correct top-level-import pattern).
- Run `npm rebuild` before running Jest if you get a `better-sqlite3` native module ABI error.
