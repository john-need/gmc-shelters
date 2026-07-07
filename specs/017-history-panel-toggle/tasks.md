# Tasks: History Panel View Toggle

**Input**: Design documents from `/specs/017-history-panel-toggle/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md
**Tests**: TDD requested — failing tests are written first for every unit below, confirmed failing, then made to pass.
**Organization**: Tasks are grouped by user story (spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

- All changes live under `src/renderer/` (Electron renderer, TypeScript/React/Jest) — no `scripts/`, `database/`, or Python involvement.
- No `contracts/` directory — this feature has no external/cross-process interface.

---

## Phase 1: Setup

**Purpose**: Confirm the pre-change baseline before touching any file.

- [X] T001 Run `npm test -- src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` from repo root and confirm all existing tests pass, establishing the baseline before this feature's changes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The persisted-preference module and shared CSS that every user story's toggle behavior depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write failing tests in `src/renderer/historyViewSettings.test.ts`: `loadHistoryViewMode()` returns `'both'` when `localStorage` has no `gmc.historyView` key; `normalizeHistoryViewMode()` falls back to `'both'` for `null`, malformed JSON, or any string outside `'source' | 'both' | 'preview'`; `saveHistoryViewMode('source')` followed by `loadHistoryViewMode()` round-trips to `'source'`.
- [X] T003 Implement `src/renderer/historyViewSettings.ts` to make T002 pass: export `DEFAULT_HISTORY_VIEW = 'both'`, `HistoryViewMode` type (`'source' | 'both' | 'preview'`), `normalizeHistoryViewMode(value: unknown): HistoryViewMode`, `loadHistoryViewMode()`, and `saveHistoryViewMode(mode: HistoryViewMode)` using `localStorage` key `gmc.historyView`, mirroring the `try/catch` structure of `src/renderer/pathSettings.ts`.
- [X] T004 [P] Add CSS in `src/renderer/index.css` (near the existing `.md-split`/`.md-pane` rules, ~line 1402): `.md-split.mode-source, .md-split.mode-preview { grid-template-columns: 1fr; }` and a `.md-view-toggle`/`.md-view-btn`/`.md-view-btn.active` rule set reusing the existing `--selected`/`--forest-deep` tokens already used by `.md-tool.active`.

**Checkpoint**: `historyViewSettings.ts` is fully tested and implemented; CSS modifiers exist. User story implementation can now begin.

---

## Phase 3: User Story 1 - Focus on writing with Source only (Priority: P1) 🎯 MVP

**Goal**: A toggle control lets the user hide the preview pane so the source editor fills the full width of the History tab.

**Independent Test**: Open the History tab, select "Source", and confirm only the editable text area is visible and spans the full tab width, with editing/formatting/save behaving exactly as before.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx`: a view-mode toggle group renders with three options (Source/Both/Preview) defaulting to "Both" pressed; clicking "Source" hides the preview pane (only one `.md-pane` in the DOM), the source `<textarea>` remains fully functional (typing updates content, toolbar formatting buttons still work), and the dirty/"Modified"/"Saved" indicator is unchanged by the switch. Also assert that `window.api.history.write` is NOT called by a bare mode switch (mock it and confirm zero calls), directly verifying FR-006's "MUST NOT trigger a save or discard" beyond just the indicator staying put.

### Implementation for User Story 1

- [X] T006 [US1] In `src/renderer/components/MainPane/tabs/HistoryTab.tsx`: add `viewMode` state initialized from `loadHistoryViewMode()`; render a 3-button toggle group (`role="group"`, each button `aria-pressed`) in the `.md-toolbar`, wired to `setViewMode` + `saveHistoryViewMode(mode)` on click.
- [X] T007 [US1] In `src/renderer/components/MainPane/tabs/HistoryTab.tsx`: apply `` `md-split mode-${viewMode}` `` to the split container, and conditionally render the source `.md-pane` only when `viewMode !== 'preview'` and the preview `.md-pane` only when `viewMode !== 'source'`, so that T005 passes.

**Checkpoint**: User Story 1 is fully functional and independently testable — Source-only view works end to end.

---

## Phase 4: User Story 2 - Review formatted output with Preview only (Priority: P2)

**Goal**: The same toggle lets the user hide the source editor so the rendered preview fills the full width.

**Independent Test**: Open the History tab, select "Preview", and confirm only the rendered preview is visible and spans the full tab width, and that the dirty/save indicator still reflects unsaved edits even though the editor is hidden.

### Tests for User Story 2 ⚠️

- [X] T008 [P] [US2] Write failing tests in `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx`: clicking "Preview" hides the source `<textarea>` (only the preview `.md-pane` remains in the DOM, `.md-split` has class `mode-preview`), and after making an edit in "Both" view and then switching to "Preview", the toolbar's "Modified" indicator is still shown correctly.

### Implementation for User Story 2

- [X] T009 [US2] Run T008 against the shared conditional rendering already added in T007; if any gap surfaces (e.g. preview pane width, dirty indicator visibility), fix it directly in `src/renderer/components/MainPane/tabs/HistoryTab.tsx` — no new state or module is expected here since the mode logic is already generic across all three values.

**Checkpoint**: All three toggle destinations are reachable — Source, Both (still default), and Preview are each independently verified.

---

## Phase 5: User Story 3 - Return to the side-by-side Both view (Priority: P3)

**Goal**: The user can return to the existing two-pane "Both" layout from either single-pane mode, and the chosen mode is remembered across tab switches, shelter changes, and app restarts.

**Independent Test**: From "Source" or "Preview", select "Both" and confirm both panes reappear side-by-side with no content loss; reload/remount the component and confirm the last-selected mode (not always "Both") is restored.

### Tests for User Story 3 ⚠️

- [X] T010 [P] [US3] Write failing test in `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx`: starting from "Source" (or "Preview"), clicking "Both" restores both `.md-pane` elements side-by-side (`.md-split` has no `mode-source`/`mode-preview` class) with the current unsaved content intact in both panes. Also cover spec.md's "save in progress" edge case: trigger `handleSave` (mock `window.api.history.write` with an unresolved/delayed promise), switch view mode while the save is still pending, then resolve it — assert the save completes normally and the dirty/"Saved" indicator ends up correct regardless of which mode is active.
- [X] T011 [P] [US3] Write failing test in `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx`: with `localStorage.setItem('gmc.historyView', 'preview')` set before render, mounting `HistoryTab` shows the Preview-only layout immediately (not the "Both" default), proving the mode survives remounting — the same mechanism that covers switching tabs, changing shelters, and restarting the app.

### Implementation for User Story 3

- [X] T012 [US3] Confirm/adjust `src/renderer/components/MainPane/tabs/HistoryTab.tsx` so the initial `viewMode` state is always sourced from `loadHistoryViewMode()` (set up in T006) and that selecting "Both" clears back to the two-pane class state, so T010 and T011 pass.

**Checkpoint**: All user stories are independently functional — Source, Both, and Preview all work, and the selection persists per FR-007.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 Run `npm test -- src/renderer/historyViewSettings.test.ts src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` and confirm the full set of new and existing tests pass together with no regressions.
- [ ] T014 [P] Manually walk through `quickstart.md` in the running app: verify mode switches don't affect content/dirty state, and that the mode persists across a tab switch, a shelter switch, and an app restart.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; run first.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational. This is the MVP.
- **User Story 2 (Phase 4)**: Depends on Foundational and on the conditional-rendering code introduced in Phase 3 (T007) — same file, sequential in practice even though the story is independently testable.
- **User Story 3 (Phase 5)**: Depends on Foundational and Phase 3's toggle wiring (T006); independently testable once Phase 3 lands.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Parallel Opportunities

- T002 and T004 can run in parallel (different files: `historyViewSettings.test.ts` vs `index.css`).
- T005, T008, T010, and T011 all edit the same file (`HistoryTab.test.tsx`) — not truly parallel in practice despite touching one shared story-test file; treat as sequential edits to that file even though they assert independent behaviors.
- T014 can run in parallel with T013 (manual check vs automated run).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001) and Foundational (T002–T004).
2. Complete User Story 1 (T005–T007) — Source-only view working, tested, persisted.
3. Ship/validate before continuing to US2/US3 if desired.

### Incremental Delivery

1. Setup + Foundational.
2. User Story 1 → Source view fully working (MVP).
3. User Story 2 → Preview view verified (likely a thin verification pass over shared code).
4. User Story 3 → Both view + persistence-across-remount verified.
5. Polish: full test run + manual quickstart walkthrough.
