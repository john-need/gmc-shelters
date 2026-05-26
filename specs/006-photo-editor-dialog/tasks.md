# Tasks: Photo Editor Dialog

**Input**: Design documents from `specs/006-photo-editor-dialog/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅
**Tests**: TDD — write failing tests BEFORE implementation in every story phase. Confirm failure before proceeding to implementation.
**Organization**: Tasks grouped by user story. US1/US2/US3 are P1; US4 is P2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete sibling tasks)
- **[Story]**: User story this task belongs to
- All file paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Shared CSS scaffolding required before any story implementation begins.

- [x] T001 Add `.photo-editor-dialog` (full-viewport dialog box) and `.photo-preview-clickable` (pointer cursor + hover overlay) CSS classes to `src/renderer/index.css`

---

## Phase 2: Foundational (Blocking Prerequisite)

**Purpose**: Create the test scaffold that all story test phases write into. Must exist before any story test tasks.

**⚠️ CRITICAL**: No story test work can begin until this phase is complete.

- [x] T002 Create `src/renderer/components/MainPane/tabs/PhotoEditorDialog.test.tsx` with imports, a `makeStore()` helper matching the pattern in `PhotosTab.test.tsx`, and a `mockApi` setup in `beforeEach` — no test bodies yet; confirm the file compiles under `npx jest --testPathPattern=PhotoEditorDialog`

**Checkpoint**: Test scaffold compiles; story test tasks can now be added.

---

## Phase 3: User Story 1 — Open Photo Editor Dialog (Priority: P1) 🎯 MVP

**Goal**: Clicking the right-aside photo preview or double-clicking a photo card opens a full-screen dialog showing the selected photo with all editing controls.

**Independent Test**: Open the Photos tab with one photo loaded. Click the photo preview in the right-aside panel — a dialog covering the viewport must appear containing the photo and crop/rotate/flip/zoom controls.

### Tests for User Story 1 ⚠️

- [x] T003 [US1] In `PhotoEditorDialog.test.tsx`: write failing test — rendering `<PhotoEditorDialog>` with a photo prop shows the photo image (or placeholder), rotate-left button, rotate-right button, flip button, crop button, zoom controls, a "Save" button, and a "Cancel" button
- [x] T004 [P] [US1] In `PhotoEditorDialog.test.tsx`: write failing test — when the photo file cannot be loaded (simulate `img.onError`), the dialog shows the placeholder initial letter and all editing controls remain present
- [x] T005 [P] [US1] In `PhotosTab.test.tsx`: write failing test — clicking the photo preview area in the right-aside panel causes an element with `role="dialog"` to appear in the DOM
- [x] T006 [P] [US1] In `PhotosTab.test.tsx`: write failing test — double-clicking a `PhotoCard` in grid view causes `role="dialog"` to appear in the DOM
- [x] T007 [P] [US1] In `PhotosTab.test.tsx`: write failing test — double-clicking a `ListRow` in list view causes `role="dialog"` to appear in the DOM
- [x] T026 [P] [US1] In `PhotoEditorDialog.test.tsx`: write failing test — with the dialog open, pressing Tab moves focus to the next focusable element **within** the dialog (not outside it); pressing Shift+Tab moves focus in reverse within the dialog (use `@testing-library/user-event` `userEvent.tab()` or `fireEvent.keyDown` on the dialog container) — covers FR-012
- [x] T027 [P] [US1] In `PhotoEditorDialog.test.tsx`: write failing test — clicking the flip button once toggles `flipped` state (assert the photo image has a `scaleX(-1)` transform or a `data-testid` / `aria-pressed` attribute indicating flipped state); clicking again restores default — covers FR-003 flip behavior
- [x] T028 [P] [US1] In `PhotoEditorDialog.test.tsx`: write failing test — clicking the Crop button enters crop mode (crop overlay or crop-handle elements appear in the DOM); clicking Crop again exits crop mode and the crop overlay is removed — covers FR-003 crop-mode activate/deactivate

**Confirm all T003–T007, T026, T027, T028 fail** before proceeding to implementation.

### Implementation for User Story 1

- [x] T008 [US1] Create `src/renderer/components/MainPane/tabs/PhotoEditorDialog.tsx`: full-screen dialog with `.modal-bg` overlay, `.photo-editor-dialog` box, two-column layout (large photo preview left, tool column right), toolbar with rotate-left/rotate-right/flip/crop/zoom controls, Save and Cancel buttons in the footer. Accept props: `photo`, `photoUrl`, `shelterId`, `sheltersRoot`, `isDefault`, `onSave`, `onCancel`. Internal state: `rotation`, `flipped`, `cropping`, `cropRect`, `crop`, `zoom`, `saving` (all transient). The Save button is **always enabled** (no `isEditDirty` gate) except when `saving || cropping`; clicking Save with zero-delta edits closes the dialog without dispatching `savePhotoMetadata`. Move crop-drag logic (`startCropDrag`) into this component verbatim from `PhotosTab.tsx`. Add a single `useEffect` that attaches one `keydown` listener on `window`: Tab/Shift+Tab trap focus within the dialog (query `[tabindex], button, input, textarea, select, a[href]` inside the dialog ref); Escape fires `onCancel`. Cleanup removes the listener on unmount. Focus returns to the element captured in a `triggerRef` passed from `PhotosTab` on open.
- [x] T009 [US1] In `PhotosTab.tsx`: add `editorOpen: boolean` state; add `onDoubleClick` prop to `PhotoCard` and `ListRow` (calls `setSelectedId(p.id); setEditorOpen(true)`); wrap the existing right-aside photo preview `<div>` with `className="photo-preview-clickable"` and `onClick={() => setEditorOpen(true)}`; render `<PhotoEditorDialog>` when `editorOpen` is true, passing `onSave={() => { setEditorOpen(false); setVersion(v => v + 1); }}` and `onCancel={() => setEditorOpen(false)}`

**Checkpoint**: User Story 1 is independently functional. `npx jest --testPathPattern="PhotoEditorDialog|PhotosTab"` should show T003–T007 and T026–T028 passing.

---

## Phase 4: User Story 2 — Save Edits from Dialog (Priority: P1)

**Goal**: Clicking Save in the editor dialog persists only image edits (rotation, flip, crop) and closes the dialog. Metadata fields are unaffected.

**Independent Test**: Open the dialog, rotate 90°, click Save. Verify the dialog closes and the photo in the list reflects the new orientation. Verify "Save Metadata" in the right-aside is unaffected.

### Tests for User Story 2 ⚠️

- [x] T010 [US2] In `PhotoEditorDialog.test.tsx`: write failing test — with a rotation applied (simulate clicking rotate-right once), clicking "Save" dispatches `savePhotoMetadata` with `rotation: 90`, `flipped: false`, `crop: null`, then calls `onSave` and the dialog is no longer in the DOM
- [x] T011 [P] [US2] In `PhotoEditorDialog.test.tsx`: write failing test — with no edits applied (`rotation===0`, `flipped===false`, `crop===null`), clicking "Save" calls `onSave` and does **not** dispatch `savePhotoMetadata` (zero-delta save is a no-op close)
- [x] T012 [P] [US2] In `PhotoEditorDialog.test.tsx`: write failing test — while save is in flight (mock `savePhotoMetadata` to return a never-resolving promise), the Save button is disabled (`saving===true` gate, not an `isEditDirty` gate — the button is otherwise always enabled when `!saving && !cropping`)
- [x] T013 [P] [US2] In `PhotoEditorDialog.test.tsx`: write failing test — when `savePhotoMetadata` rejects, an error toast is dispatched, the dialog remains open (`role="dialog"` still in DOM), and the Save button is re-enabled

**Confirm all T010–T013 fail** before proceeding.

### Implementation for User Story 2

- [x] T014 [US2] In `PhotoEditorDialog.tsx`: implement the Save handler — set `saving: true`, dispatch `savePhotoMetadata` with `rotation`, `flipped`, `crop` (and all metadata fields with zero-delta defaults), on success reset editing state and call `onSave`, on failure dispatch `showToast` with an error message and set `saving: false`; bind Save button `disabled` to `saving || cropping`

**Checkpoint**: T010–T013 pass. Save workflow is complete and independently verifiable.

---

## Phase 5: User Story 3 — Cancel Edits from Dialog (Priority: P1)

**Goal**: Cancel, Escape, and overlay-click all discard pending edits and close the dialog without writing anything.

**Independent Test**: Open the dialog, rotate 90°, click Cancel. Verify the dialog is gone and the photo record is unchanged.

### Tests for User Story 3 ⚠️

- [x] T015 [US3] In `PhotoEditorDialog.test.tsx`: write failing test — clicking the "Cancel" button calls `onCancel` and does NOT dispatch `savePhotoMetadata`
- [x] T016 [P] [US3] In `PhotoEditorDialog.test.tsx`: write failing test — pressing Escape (via `fireEvent.keyDown(window, { key: 'Escape' })`) calls `onCancel`
- [x] T017 [P] [US3] In `PhotoEditorDialog.test.tsx`: write failing test — clicking the overlay backdrop (the `.modal-bg` element directly, not the dialog box) calls `onCancel`

**Confirm all T015–T017 fail** before proceeding.

### Implementation for User Story 3

- [x] T018 [US3] In `PhotoEditorDialog.tsx`: wire Cancel button `onClick` → `onCancel`; add `onClick` to the `.modal-bg` overlay `<div>` that calls `onCancel` only when `e.target === e.currentTarget` (matching the `ReconcileModal` pattern). **Note**: Escape is already handled by the single `keydown` useEffect added in T008 — do NOT add a second listener here.

**Checkpoint**: T015–T017 pass. All three exit paths (Cancel, Escape, overlay) are verified.

---

## Phase 6: User Story 4 — Editing Tools Removed from Right-Aside Column (Priority: P2)

**Goal**: The right-aside detail panel no longer contains crop, rotate, flip, or zoom controls. The photo preview area is the sole trigger for the editor dialog and has the hover affordance.

**Independent Test**: Open the Photos tab. The right-aside panel must contain no crop, rotate, flip, or zoom buttons. The photo preview must have the `.photo-preview-clickable` class.

### Tests for User Story 4 ⚠️

- [x] T019 [US4] In `PhotosTab.test.tsx`: write failing test — with a photo selected and the editor dialog closed, the right-aside detail panel does NOT contain any button with title containing "Rotate", "Flip", "Crop", or any zoom control (query by accessible label or `title` attribute)
- [x] T020 [P] [US4] In `PhotosTab.test.tsx`: write failing test — the right-aside photo preview container has the class `photo-preview-clickable`

**Confirm T019–T020 fail** before proceeding.

### Implementation for User Story 4

- [x] T021 [US4] In `PhotosTab.tsx`: remove the inline `.photo-tools` JSX block (crop/rotate/flip/zoom buttons and the Save edit button); remove `rotation`, `flipped`, `cropping`, `crop`, `cropRect`, `naturalSize`, `frameSize`, `zoom` state variables and the `startCropDrag` handler that have moved into `PhotoEditorDialog.tsx`; remove `handleSaveEdits` (now in dialog); confirm `isEditDirty` and `cropPreviewStyle` computations are removed from `PhotosTab`. **Do NOT remove `startResize`, `detailWidth`, or `resizing`** — these control the right-aside column resize handle and are unrelated to photo editing.

**Checkpoint**: T019–T020 pass. Right-aside panel is clean; all editing tools live exclusively in the dialog.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify all stories together, check visual edge cases, and confirm no regressions.

- [x] T022 Run `npx jest --testPathPattern="PhotoEditorDialog|PhotosTab"` and confirm all tests (T003–T020) pass with zero failures
- [ ] T023 [P] Manually verify keyboard navigation in the running app: Tab cycles through dialog controls only, Shift+Tab reverses, Escape closes the dialog, focus returns to the element that triggered the dialog open
- [ ] T024 [P] Manually verify photo display in the dialog at portrait (tall) and landscape (wide) aspect ratios — confirm the image fills at least 60% of the dialog height (SC-005) and no overflow occurs
- [ ] T025 [P] Confirm the right-aside "Save Metadata" button still functions independently of the editor dialog (no regression to metadata save workflow)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (CSS must exist before components reference classes).
- **US1 (Phase 3)**: Depends on Phase 2 (test scaffold must exist).
- **US2 (Phase 4)**: Depends on Phase 3 implementation (save handler lives inside `PhotoEditorDialog.tsx`).
- **US3 (Phase 5)**: Depends on Phase 3 implementation (cancel wiring lives inside `PhotoEditorDialog.tsx`). Can run in parallel with Phase 4 tests once Phase 3 implementation is complete.
- **US4 (Phase 6)**: Depends on Phase 3 implementation (dialog must exist before inline tools are removed). Can run in parallel with Phases 4 and 5.
- **Polish (Phase 7)**: Depends on all story phases complete.

### User Story Dependencies

```
Phase 1 (CSS)
  └── Phase 2 (Test scaffold)
        └── Phase 3 (US1 — dialog shell)
              ├── Phase 4 (US2 — save logic)   ─┐
              ├── Phase 5 (US3 — cancel logic)  ─┤ can run in parallel
              └── Phase 6 (US4 — cleanup)       ─┘
                    └── Phase 7 (Polish)
```

### Parallel Opportunities Within Stories

- **US1 tests (T003–T007, T026–T028)**: T004–T007 and T026–T028 can all be written in parallel with T003.
- **US1 implementation (T008, T009)**: T009 depends on T008 (PhotoEditorDialog must exist before PhotosTab imports it).
- **US2 tests (T010–T013)**: T011, T012, T013 can be written in parallel with T010.
- **US3 tests (T015–T017)**: T016 and T017 can be written in parallel with T015.
- **US4 tests (T019–T020)**: T019 and T020 can be written in parallel.
- **Polish (T022–T025)**: T023, T024, T025 can run in parallel with each other after T022 passes.

---

## Implementation Strategy

### MVP First (P1 Stories — Phases 1–5)

1. Complete Phase 1 (CSS).
2. Complete Phase 2 (test scaffold).
3. Complete Phase 3 (US1 — dialog opens and renders tools).
4. Complete Phase 4 (US2 — save works).
5. Complete Phase 5 (US3 — cancel/escape/overlay work).
6. Validate all P1 tests pass before touching the right-aside panel cleanup.

### Incremental Delivery

1. After Phase 3: dialog is functional (open/close), all edit tools accessible.
2. After Phase 4: save persists edits correctly.
3. After Phase 5: all exit paths (Save, Cancel, Escape, overlay) work.
4. After Phase 6: right-aside is clean, no duplicated controls.
5. After Phase 7: manual verification complete, ready for merge.

### Single-Contributor Strategy

Work sequentially through phases. Within each story phase: write all test tasks first, run Jest to confirm failures, then implement.

---

## Notes

- `[P]` tasks target different files or logically independent test cases — no blocking dependencies on incomplete siblings.
- Every story phase writes failing tests before implementation (TDD, per user request and constitution Principle II).
- `PhotoEditorDialog.tsx` is the primary new file; `PhotosTab.tsx` is the primary modified file.
- All changes stay within `src/renderer/` — no scripts, database, or IPC changes.
- The `ReconcileModal` in `PhotosTab.tsx` is unaffected by this feature.
- Total tasks: 28 (T001–T025 original + T026–T028 added by analysis remediation). Task IDs T026–T028 are Phase 3 test tasks for focus-trap, flip, and crop-mode behavior (FR-012 and FR-003 coverage gaps).
