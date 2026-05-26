# Tasks: Photo Metadata Dialog

**Input**: `specs/007-photo-metadata-dialog/spec.md` + codebase context (plan.md not yet generated)
**Prerequisites**: spec.md ✅ — plan.md ⚠️ absent (tasks derived from spec + codebase knowledge)
**Tests**: TDD — every user story starts with failing tests before any implementation.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in all descriptions

## Tech Stack Reference

- Renderer: React + TypeScript, Redux Toolkit (`updatePhotoLocal`, `showToast`)
- Tests: Jest + `@testing-library/react`, `configureStore` store-per-test pattern
- Dialog pattern: inline modal (`position:fixed` overlay + `role="dialog" aria-modal="true"`)
- Existing analogues: `PhotoEditorDialog.tsx`, `ReconcileModal` (in `PhotosTab.tsx`)

---

## Phase 1: Setup (Stub)

**Purpose**: Create the minimum file structure so test imports resolve before any tests are written.

- [ ] T001 Create stub `PhotoMetadataDialog.tsx` in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx` that exports a no-op component (`export default function PhotoMetadataDialog() { return null; }`) and the expected props interface — just enough for test files to import without errors

---

## Phase 2: User Story 1 — View Photo Metadata (Priority: P1) 🎯 MVP

**Goal**: Display all photo metadata fields in a read-only dialog opened by a new icon button in the right-column header.

**Independent Test**: Select a photo on the Photos tab. Click the new metadata icon button. A dialog opens showing all 13 metadata fields for that photo. Dismiss it and verify the photo state is unchanged.

### Tests for User Story 1 ⚠️

- [ ] T002 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` for: (a) dialog renders with `role="dialog"`, (b) all 13 fields rendered — title, photographer, date taken, caption, alt text, description, notes, include-in-post, file name, photo ID, shelter ID, created, updated, (c) empty fields show "—" placeholder, (d) system fields are never editable inputs (id, shelter_id, file_name, created, updated)
- [ ] T003 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx` for: (a) metadata icon button is present in `photo-detail-head` when a photo is selected, (b) clicking the button opens the metadata dialog, (c) button is absent when no photo is selected

### Implementation for User Story 1

- [ ] T004 [US1] Implement read-only view mode in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: fixed-overlay modal with `role="dialog" aria-modal="true"`, render all 13 metadata fields with labels, display "—" for empty values, keep system fields (id, shelter_id, file_name, created, updated) as non-editable display rows throughout
- [ ] T005 [US1] Add metadata icon button (info/list SVG) to `photo-detail-head` in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: button disabled/hidden when `selected` is null, `[metadataOpen, setMetadataOpen]` state, render `<PhotoMetadataDialog>` when open, pass `photo`, `onClose` prop that sets state to false

**Checkpoint**: US1 independently verifiable — metadata dialog opens, displays all fields, closes cleanly.

---

## Phase 3: User Story 2 — Copy Metadata Field to Clipboard (Priority: P1)

**Goal**: Every metadata field row in the dialog has a copy icon button. Clicking it writes the value to the clipboard and shows a 1.5-second checkmark confirmation.

**Independent Test**: Open the metadata dialog for a photo with a non-empty title. Click the copy icon next to the title row. The icon changes to a checkmark momentarily, and the system clipboard contains the title value.

### Tests for User Story 2 ⚠️

- [ ] T006 [P] [US2] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` for: (a) each field row renders a copy icon button, (b) clicking a copy button calls `navigator.clipboard.writeText` with the field value (mock `navigator.clipboard.writeText = jest.fn().mockResolvedValue(undefined)`), (c) after click the copy icon is replaced by a checkmark indicator, (d) after ~1.5s the checkmark reverts to the copy icon (use `jest.useFakeTimers`), (e) clicking the copy button for `include_in_post` writes `"Published"` when true and `"Not published"` when false — not the raw boolean value

### Implementation for User Story 2

- [ ] T007 [US2] Add copy icon buttons to each field row in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: per-field `copiedField` state (field key → boolean), on click call `navigator.clipboard.writeText(value)` and set the field's copied state to true, use `setTimeout(1500)` to reset; for `include_in_post` write `"Published"` or `"Not published"`; silently ignore clipboard errors

**Checkpoint**: US1 + US2 independently verifiable.

---

## Phase 4: User Story 3 — Edit Metadata Fields In-Memory (Priority: P1)

**Goal**: An edit button at the top switches editable fields to inputs. Save dispatches `updatePhotoLocal` and closes. Cancel discards.

**Independent Test**: Open the dialog, click edit, change the title, click Save. Verify `updatePhotoLocal` was dispatched with the new title, the dialog is closed, and no IPC call was made.

### Tests for User Story 3 ⚠️

- [ ] T008 [P] [US3] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` for: (a) edit button present in view mode, (b) clicking edit shows Save and Cancel buttons and replaces read-only displays with input controls for editable fields, (c) system fields remain non-editable in edit mode, (d) changing title and clicking Save dispatches `updatePhotoLocal` action with updated values (spy on `store.dispatch`), (e) clicking Save closes the dialog (`onClose` called), (f) no `window.api.photos.update` call is made during Save, (g) clicking Cancel discards changes and calls `onClose`

### Implementation for User Story 3

- [ ] T009 [US3] Add edit mode to `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: `[editMode, setEditMode]` state; `[draft, setDraft]` state initialized from `photo` prop on open; edit button hides on edit mode entry; in edit mode render `<input>` / `<textarea>` for operator-editable fields (title, photographer, date_taken, caption, alt_text, description, notes) and a checkbox for `include_in_post`; Save handler calls `dispatch(updatePhotoLocal({ shelterId, photo: { id, ...draft } }))` then `onClose()`; Cancel handler calls `onClose()` directly without dispatch

**Checkpoint**: US1 + US2 + US3 independently verifiable.

---

## Phase 5: User Story 4 — Cancel / Dismiss Without Editing (Priority: P2)

**Goal**: In view mode, Escape, click-outside, and close button all dismiss the dialog with no side effects. Focus is trapped while open and returns to the trigger button on close.

**Independent Test**: Open the dialog in view mode. Press Escape. Verify the dialog is gone and the photo state is unchanged.

### Tests for User Story 4 ⚠️

- [ ] T010 [P] [US4] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` for: (a) pressing Escape calls `onClose`, (b) clicking the overlay backdrop calls `onClose`, (c) a close/cancel button in the dialog calls `onClose`, (d) `onClose` is NOT called when user clicks inside the dialog body (not the overlay), (e) in edit mode pressing Escape calls `onClose` without dispatching `updatePhotoLocal`, (f) Tab key cycles focus forward through all interactive controls inside the dialog without leaving it, (g) Shift+Tab cycles focus backward within the dialog

### Implementation for User Story 4

- [ ] T011 [US4] Add dismissal and focus handling to `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: `useEffect` registering `keydown` listener for Escape that calls `onClose`; overlay `onClick` that fires `onClose` only when `e.target === e.currentTarget`; visible close button (✕) in the dialog header that calls `onClose`; `autoFocus` on the first focusable element inside the dialog on open; add `aria-label="Close"` to close button; Tab-trap via `keydown` handler: query all focusable elements (`button, input, textarea, [href], [tabindex]:not([tabindex="-1"])`), on Tab advance to next (wrapping), on Shift+Tab retreat to previous (wrapping), call `e.preventDefault()` in both cases

**Checkpoint**: All 4 user stories independently verifiable.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T012 [P] Run the renderer test suite scoped to the affected files and confirm all tests pass: `npx jest --testPathPattern="PhotoMetadataDialog|PhotosTab" --no-coverage`
- [ ] T013 Verify the metadata icon button tooltip/aria-label is descriptive (e.g., `aria-label="View photo metadata"`) in `src/renderer/components/MainPane/tabs/PhotosTab.tsx`
- [ ] T014 [P] Check that `PhotoMetadataDialog` is imported and used consistently in `src/renderer/components/MainPane/tabs/PhotosTab.tsx` alongside the existing `PhotoEditorDialog` import — no duplicate modal open states, no stale `selected` reference when both could theoretically be open

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **US1 (Phase 2)**: Depends on T001 stub. Tests (T002, T003) can be written as soon as stub exists.
- **US2 (Phase 3)**: Depends on US1 dialog component existing. Tests can be written in parallel with US1 implementation (different test cases in same file).
- **US3 (Phase 4)**: Depends on US1 dialog scaffold. Tests can be written as soon as US1 dialog shell exists.
- **US4 (Phase 5)**: Depends on US1 dialog scaffold. Tests can be written as soon as US1 dialog shell exists.
- **Polish (Phase 6)**: Depends on all user stories complete.

### User Story Dependencies

- US2, US3, US4 all extend the same `PhotoMetadataDialog.tsx` component; they must not be worked in parallel on that file to avoid merge conflicts.
- `PhotosTab.tsx` changes (T005) are isolated to US1 and do not require US2–US4 to be complete.

### Within Each User Story

- Tests MUST be written and confirmed failing before implementation begins.
- US3 draft state must be initialised from the `photo` prop (not live Redux state) so edits are sandboxed until Save.

### Parallel Opportunities

- T002 and T003 can be written in parallel (different files).
- T006 (US2 tests) can be written in parallel with T004 implementation (different concerns in same test file — use separate `describe` blocks).
- T008 (US3 tests) can be written in parallel with T007 implementation.
- T010 (US4 tests) can be written in parallel with T009 implementation.
- T012 and T013, T014 in Polish can all run in parallel.

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete T001 (stub).
2. Write T002 + T003 (failing tests).
3. Complete T004 + T005 (implementation).
4. Verify all US1 tests pass.

### Incremental Delivery

1. MVP (US1) — read-only metadata dialog with icon button.
2. US2 — clipboard copy per field.
3. US3 — in-memory edit + save.
4. US4 — full dismissal and accessibility hardening.
5. Polish.

### Parallel Team Strategy

One contributor can work `PhotoMetadataDialog.tsx` while another handles `PhotosTab.tsx` changes in T005, since they are in different sections of the file with no overlap.

---

## Notes

- `[P]` tasks = different files or isolated concerns, safe to parallelize.
- The `PhotoMetadataDialog` is a pure renderer component — no IPC, no database, no scripts.
- Keep the modal pattern consistent with `ReconcileModal` (in `PhotosTab.tsx`) and `PhotoEditorDialog.tsx`.
- Total tasks: **14** across 5 phases.
- US1 (4 tasks) + US2 (2 tasks) + US3 (2 tasks) + US4 (2 tasks) + Setup (1 task) + Polish (3 tasks).
