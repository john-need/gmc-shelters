# Tasks: Map Markers — Map Section Display

**Input**: Design documents from `specs/004-fix-map-display/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓
**Approach**: TDD — write failing tests first, then implement to make them pass. Never skip the red → green cycle.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story (US1–US2) — required in story phases, omitted in Setup/Polish
- Include exact file paths in every task description

## Path Conventions

- Leaflet mock: `src/renderer/__mocks__/leaflet.ts`
- Tab component: `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx`
- Component tests: `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the Leaflet mock before any test work begins — all new tests depend on the
updated stub.

- [x] T001 Extend `src/renderer/__mocks__/leaflet.ts` — add `flyToBounds: jest.fn().mockReturnThis()`, `flyTo: jest.fn().mockReturnThis()`, `fitBounds: jest.fn().mockReturnThis()`, and `getZoom: jest.fn(() => 13)` to `mapStub`; confirm `export default L` and named exports still compile

**Checkpoint**: `npm test` still passes with the updated mock (no regressions).

---

## Phase 2: User Story 1 — View all shelter markers on the map (Priority: P1) 🎯 MVP

**Goal**: Opening the Map Markers tab for any shelter auto-fits the map viewport to show all
marker pins simultaneously. Clicking a list row centres the map on that pin. No manual pan or
zoom required.

**Independent Test** (from spec.md): Select a shelter with ≥ 2 markers in different locations.
Open the Map Markers tab. All pins must be visible at once. Select a shelter with 1 marker — map
centres on it at close zoom. Select a shelter with 0 markers — map shows default regional view.
Click a list row — map flies to that pin.

### Failing Tests First — US1 ⚠️

- [x] T002 [US1] Write failing tests for `fitMapToBounds` behaviour in `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx`:
  - Render with store containing 0 markers → assert `mapStub.flyTo` called with `[44.0, -71.5]` and zoom `8`
  - Render with store containing 1 marker (lat `44.1`, lng `-71.6`) → assert `mapStub.flyTo` called with `[44.1, -71.6]` and zoom `15`
  - Render with store containing 2 markers at distinct coords → assert `mapStub.flyToBounds` called once; inspect the `options` argument and assert `maxZoom` equals `15`; assert `mapStub.fitBounds` call count equals `0` (FR-010: instant fit MUST NOT be used)
  - Render with 2 markers at identical coords (same lat/lng) → assert `mapStub.flyToBounds` still called (degenerate bounding box handled via `maxZoom` cap)
  - After initial render with 2 markers, update store to contain 3 markers (simulate add) → assert `mapStub.flyToBounds` call count increments (effect re-ran with updated markers)

- [x] T003 [P] [US1] Write failing tests for list→map pan (FR-009) in `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx`:
  - Render with store containing 2 markers; `jest.clearAllMocks()` after render; click the first list row → assert `mapStub.flyTo` call count equals exactly `1` with `[marker.latitude, marker.longitude]` and zoom ≥ `15`
  - Without clearing mocks, click the same row again (toggles deselect) → assert `mapStub.flyTo` call count is still `1` (no additional call on deselect; `m.id === selectedId` guard works)
  - Render with 1 marker; `jest.clearAllMocks()` after render; click list row → assert `mapStub.flyTo` call count equals exactly `1` (covers single-marker list pan path)

### Implementation — US1

- [x] T004 [US1] Add `fitMapToBounds(map: L.Map, markers: MapMarker[])` helper function to `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx` (place alongside existing icon helpers, above the component function):
  - 0 markers → `map.flyTo([44.0, -71.5] as L.LatLngExpression, 8)`
  - 1 marker → `map.flyTo([markers[0].latitude, markers[0].longitude] as L.LatLngExpression, 15)`
  - ≥ 2 markers → build `L.LatLngBounds` via `markers.reduce(...)` using `bounds.extend([m.latitude, m.longitude] as L.LatLngExpression)`, then call `map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30] as unknown as L.PointExpression })`

- [x] T005 [P] [US1] Call `fitMapToBounds(map, markers)` at the end of the "sync marker pins" `useEffect` in `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx` — place it after the `markers.forEach(...)` pin-creation loop, before the effect closes; the existing `[markers, selectedId]` dependency array already ensures this fires on every marker-set change

- [x] T006 [US1] Add list→map pan to `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx`:
  - In the `.mm-marker-row` `onClick` handler (the single location where `setSelectedId` is called for list selection, line ~287): after calling `setSelectedId(...)`, if `m.id !== selectedId` (i.e., this click is selecting, not deselecting), call `mapRef.current?.flyTo([m.latitude, m.longitude] as L.LatLngExpression, Math.max(mapRef.current.getZoom() ?? 15, 15))`
  - Do NOT add `flyTo` to the Edit or Delete button handlers — those do not change the map viewport

**Checkpoint**: All T002–T003 tests pass (green). Tab opens with auto-fit viewport. Clicking a list row centres the map on the pin.

---

## Phase 3: User Story 2 — Map updates when markers change (Priority: P1)

**Goal**: Adding, editing, or deleting a marker immediately updates the map pins and re-fits the
viewport — no tab reload required.

**Independent Test** (from spec.md): With 2 markers on the map, add a third in a distant location.
The map re-fits to include the new pin. Delete one marker — the map re-fits to the remaining set.

### Failing Tests First — US2 ⚠️

- [x] T007 [US2] Write failing tests for map re-fit after marker changes in `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx`:
  - Start with 2 markers; dispatch `createMarker.fulfilled` with a new third marker to the Redux store; re-render → assert `mapStub.flyToBounds` called a second time (call count increased) with 3-marker bounds
  - Start with 2 markers; dispatch `deleteMarker.fulfilled` removing one; re-render → assert `mapStub.flyTo` called (1-marker case) with the remaining marker's coords at zoom 15
  - Start with 1 marker; dispatch `deleteMarker.fulfilled` removing it; re-render → assert `mapStub.flyTo` called with the default `[44.0, -71.5]` centre at zoom 8 (0-marker default view)

### Implementation — US2

- [x] T008 [US2] Verify in `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx` that the "sync marker pins" `useEffect` dependency array is `[markers, selectedId]` (unchanged from existing code). The `fitMapToBounds` call added in T005 fires automatically whenever `markers` changes — no additional implementation code is required for US2 beyond T004 + T005. Confirm tests T007 pass green after T004 + T005 are in place.

**Checkpoint**: All T007 tests pass. Map re-fits after every add, edit, and delete.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Full suite validation and visual confirmation.

- [x] T009 [P] Run `npm test` (full Jest suite) and confirm all new tests (T002, T003, T007) pass and no pre-existing tests regressed; fix any failures before closing this task
- [ ] T010 [P] Run `npm start` (Electron app), navigate to Map Markers tab for a shelter with ≥ 2 markers, and visually confirm: (a) map renders and pins are visible without manual pan; (b) clicking a list row centres the map on the pin; (c) adding a marker re-fits the map; (d) deleting a marker re-fits the map; (e) pins are numbered and the numbers match the list order (FR-007 regression); (f) clicking the map while in Add mode sets the latitude/longitude fields (FR-008 regression)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately. T001 must complete before any test tasks.
- **US1 (Phase 2)**: Requires T001. T002 and T003 can run in parallel (same file, different `it` blocks, but can be written together). T004 and T005 can be written in parallel (T004 adds the helper, T005 wires it in). T006 depends on T004 (helper must exist). Tests (T002, T003) must be written and confirmed failing before T004–T006.
- **US2 (Phase 3)**: Requires US1 complete (T004 + T005 must be in place — T008 confirms they cover US2). T007 tests can be written in parallel with US1 implementation but must fail first (red).
- **Polish (Phase 4)**: Requires all story phases complete.

### User Story Dependencies

- US2 shares the same `fitMapToBounds` + sync-pins wiring as US1 — US1 must be complete before US2 tests can go green.
- T008 is intentionally a verification task: if T004 + T005 are correct, T007 goes green with zero additional implementation. If T007 still fails after T005, the deps array or effect body needs investigation.

### TDD Cycle (within each story phase)

1. Write failing test — run `npm test` and confirm it **fails** (red)
2. Implement minimum code to pass — run `npm test` and confirm it **passes** (green)
3. Refactor if needed — keep tests green
4. Do not advance to the next task until the current tests pass

### Parallel Opportunities

- T002 ∥ T003 (both in the same test file but cover different behaviours; can be written in the same sitting)
- T004 ∥ T005 (T004 adds the helper, T005 adds the call — different hunks of the same file; write in sequence within one edit)
- T009 ∥ T010 (independent verification methods)

---

## Implementation Strategy

### MVP First (Both stories are P1)

1. Complete Setup (T001).
2. Write US1 tests (T002, T003) — confirm red.
3. Implement US1 (T004, T005, T006) — confirm green.
4. Write US2 tests (T007) — confirm red or green (T007 should go green automatically after T005).
5. Verify US2 (T008).
6. Polish (T009, T010).

### Single-contributor Strategy

Follow task IDs sequentially. Within each story: write all test tasks first (red), then all
implementation tasks (green). Do not write implementation before a failing test exists.

---

## Notes

- T008 is a deliberate "verify, not implement" task — if the sync-pins `useEffect` fires on
  `markers` change (which the existing code already ensures), then `fitMapToBounds` added in T005
  covers US2 automatically. The test tasks (T007) confirm this empirically.
- `mapStub.flyTo` is called both by `fitMapToBounds` (for 0-marker and 1-marker cases) and by the
  list-row click handler (T006). Tests must `jest.clearAllMocks()` between assertions that check
  call counts to avoid false positives.
- `[30, 30]` padding in `flyToBounds` is passed as `as unknown as L.PointExpression` to work
  around the 1.9.x `@types/leaflet` signature — this is documented in research.md §3.
- Do not call `map.invalidateSize()` inside the sync-pins effect; it is only needed if the
  container dimensions change after the map initialises, which does not occur in this layout.
