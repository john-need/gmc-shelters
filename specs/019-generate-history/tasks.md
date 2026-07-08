# Tasks: Generate History

**Input**: Design documents from `/specs/019-generate-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/history-generate-ipc.md, quickstart.md
**Tests**: Required — this feature was planned with a TDD approach (user-requested); every implementation task has a corresponding failing-test task that must exist and fail first.
**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every description includes the exact file path(s) touched

## Path Conventions

This feature is a pure Electron/TypeScript change — no `scripts/`/Python, no `database/` migrations.

- Shared types/contracts/pure helpers: `src/shared/`
- New Anthropic-call module: `src/main/ai/`
- IPC wiring: `src/main/ipc/`, `src/main/index.ts`, `src/main/preload.ts`
- UI: `src/renderer/components/MainPane/tabs/HistoryTab.tsx`, `GenerateHistoryModal.tsx`, `src/renderer/markdown.ts`
- Feature docs/contracts: `specs/019-generate-history/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one shared contract shape every story's tests and code depend on.

- [ ] T001 Add `CHANNELS.HISTORY_GENERATE`, the `GenerateHistoryShelterFacts`/`GenerateHistoryRequest`/`GenerateHistoryError`/`GenerateHistoryResponse` types, and `ElectronAPI.history.generate(request: GenerateHistoryRequest): Promise<GenerateHistoryResponse>` to `src/shared/ipc-types.ts` (per `contracts/history-generate-ipc.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pure helpers both US1 (stripping) and US2 (assembling) depend on — no independent user-facing value on their own.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T002 [P] Write failing tests in `src/shared/generate-history.test.ts`: `stripSourcesSection()` removes an existing `### Sources` section from a markdown string and returns prose unchanged when there is no section to remove; `assembleAcceptedHistory(shelterName, narrative, citations)` produces `# {shelterName}\n\n{trimmed narrative}\n` followed by a reattached Sources section built from `citations` via the existing `citeChicagoMarkdown()`, and omits the Sources section entirely when `citations` is empty
- [ ] T003 Implement `src/shared/generate-history.ts` (`stripSourcesSection()` as `syncHistorySourcesSection(markdown, [])`; `assembleAcceptedHistory()` as `syncHistorySourcesSection(`# ${shelterName}\n\n${narrative.trim()}\n`, citations)`, reusing `src/shared/history-sources.ts` per research.md Decision 6) to make T002 pass

**Checkpoint**: Foundation ready — strip/assemble helpers are available for every later story.

---

## Phase 3: User Story 1 - Draft a new history narrative from current facts (Priority: P1) 🎯 MVP

**Goal**: Clicking "Generate History" (enabled only with a valid-format API key) gathers the current shelter's facts, its included citations, and the Sources-stripped History content, and sends them to Claude via a new IPC channel with the `web_search` tool enabled; the button shows a busy state while in flight and surfaces `no_api_key`/`network`/`timeout` errors inline without touching the History tab's content.

**Independent Test**: On a shelter with Shelter-tab facts and at least one included citation, click "Generate History" and confirm (via a mocked `window.api.history.generate`) that the request contains those facts, the included citations, and the current (Sources-stripped) history text; confirm the button is disabled/busy for the duration of the call and inert to a second click; confirm a blank-history shelter still sends a request; confirm an error response leaves the History tab's content untouched and shows an inline message; confirm the button is disabled with a "requires AI API key" title when no valid key is configured.

### Tests for User Story 1 ⚠️

- [ ] T004 [P] [US1] Write failing tests in `src/main/ai/generate-history.test.ts`: request body includes the resolved model, the `web_search` tool (`type: 'web_search_20260209'`, `max_uses: 3`, `allowed_callers: ['direct']`), and a prompt built from the given shelter facts, Chicago-formatted citations, and the (already-stripped) history text, instructing prose-only output with no title heading and no Sources section (research.md Decision 5); a well-formed mocked response's joined/trimmed text blocks are returned as `{ ok: true, narrative }`; a non-2xx response yields `{ ok: false, error: 'network' }`; an aborted/timed-out request (inject a short timeout so the test doesn't wait ~45s) yields `{ ok: false, error: 'timeout' }`
- [ ] T005 [P] [US1] Write failing tests in `src/main/ipc/generate-history.test.ts`: no stored API key → `{ ok: false, error: 'no_api_key' }` with zero network calls; stored key present → resolves the model tier, calls `src/main/ai/generate-history.ts`, and returns its outcome unchanged
- [ ] T006 [P] [US1] Extend `src/main/preload.test.ts` with a failing test: `history.generate` is exposed as a function that invokes `CHANNELS.HISTORY_GENERATE` with the given request
- [ ] T007 [US1] Extend `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` with failing tests: the "Generate History" button renders after the Source/Both/Preview toggle; it is disabled with title "Generate History (requires AI API key)" when `aiSettings.apiKey` is empty/invalid-format, and enabled with title "Generate History" otherwise; clicking it (valid key) calls `window.api.history.generate` with a request whose `shelter` matches the current `editBuffer` facts, whose `citations` is `sources.byShelter[shelterId]` filtered to `include_in_history === true`, and whose `currentHistory` is `stripSourcesSection(historyContent)`; the button shows a busy state for the duration of an in-flight call and a second click while busy is inert; a shelter with blank History content still triggers a request; a `no_api_key`/`network`/`timeout` response renders an inline error near the button and leaves `historyContent`/`historyDirty` unchanged; no modal-related assertions here (deferred to US2)

### Implementation for User Story 1

- [ ] T008 [US1] Implement `src/main/ai/generate-history.ts` (builds the prompt/request per research.md Decision 5, POSTs via `fetch` with an `AbortController` ~45s timeout and `max_tokens: 4096`, joins/trims the response's text blocks, maps network/timeout per research.md Decision 4) to make T004 pass
- [ ] T009 [US1] Implement `src/main/ipc/generate-history.ts` (`registerGenerateHistoryHandlers()`: short-circuits on empty `readStoredApiKey()`; otherwise resolves the model via `readStoredModelTier()` + `resolvePrimaryModel()` and calls `generate-history.ts`, returning its outcome unchanged) to make T005 pass
- [ ] T010 [US1] Register `registerGenerateHistoryHandlers()` alongside the other `register*Handlers()` calls in `src/main/index.ts`
- [ ] T011 [US1] Wire `history: { ..., generate }` into `src/main/preload.ts` to make T006 pass
- [ ] T012 [US1] In `src/renderer/components/MainPane/tabs/HistoryTab.tsx`: dispatch `loadApiKey()` in a mount effect (research.md Decision 7) and select `hasValidApiKey`; add the "Generate History" button after the view-mode toggle group, disabled/titled per `hasValidApiKey`; add `generating`/`generateError`/`draftNarrative` state; on click, build the `GenerateHistoryRequest` (shelter facts from `editBuffer`, citations from `sources.byShelter[shelterId]` filtered to `include_in_history`, `currentHistory` via `stripSourcesSection(value)`) and call `window.api.history.generate`; show busy state while in flight and block re-entry; on `ok: false`, show an inline error and leave content untouched; on `ok: true`, store the narrative in `draftNarrative` (modal wiring added in US2) — to make T007 pass

**Checkpoint**: User Story 1 is fully functional and independently testable — the request pipeline, button state, and error handling all work correctly end to end (the successful case stores a draft but does not yet display it).

---

## Phase 4: User Story 2 - Review and accept the generated narrative (Priority: P1)

**Goal**: A successful response opens a review modal showing the exact document that would result (heading + narrative + reattached Sources section) in rendered markdown preview; clicking Accept replaces the History tab's content with that document, marks it dirty, and closes the modal.

**Independent Test**: Trigger a generation, confirm the result appears in a modal rendered as formatted (not raw) markdown showing the full assembled document, click Accept, and confirm the History tab's content is replaced with `assembleAcceptedHistory(...)`'s output and marked unsaved.

### Tests for User Story 2 ⚠️

- [ ] T013 [P] [US2] Write failing tests in `src/renderer/markdown.test.ts` asserting the extracted `renderMarkdown()` produces identical output to today's inline version for headings, lists, blockquotes, bold/italic, and links (behavior-parity test for the extraction in T016)
- [ ] T014 [P] [US2] Write failing tests in `src/renderer/components/MainPane/tabs/GenerateHistoryModal.test.tsx`: given `shelterName`, `narrative`, and `citations` props, the modal renders `assembleAcceptedHistory(shelterName, narrative, citations)` through the shared `renderMarkdown()` (formatted HTML, not raw markdown text); clicking Accept calls `onAccept` exactly once; clicking Reject calls `onReject` exactly once; neither callback fires before a click
- [ ] T015 [US2] Extend `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` with a failing test: once `draftNarrative` is set (successful response), `GenerateHistoryModal` renders with that narrative and the shelter's current included citations; clicking its Accept button dispatches `setHistoryContent(assembleAcceptedHistory(shelter.name, narrative, citations))`, closes the modal, and marks `historyDirty`

### Implementation for User Story 2

- [ ] T016 [US2] Extract `renderMarkdown()`/`inline()` out of `HistoryTab.tsx` into new `src/renderer/markdown.ts` (pure move, no behavior change); update `HistoryTab.tsx`'s Preview pane to import from there, to make T013 pass
- [ ] T017 [US2] Implement `src/renderer/components/MainPane/tabs/GenerateHistoryModal.tsx` (props: `shelterName`, `narrative`, `citations`, `onAccept`, `onReject`; renders `assembleAcceptedHistory(...)` via the shared `renderMarkdown()`; Accept and Reject buttons; overlay backdrop click calls `onReject`, matching this app's existing modal convention in `ReconcileModal.tsx`/`NewShelterModal.tsx`) to make T014 pass
- [ ] T018 [US2] Wire `GenerateHistoryModal` into `HistoryTab.tsx`: render it when `draftNarrative !== null`, passing the shelter's name and included citations; `onAccept` dispatches `setHistoryContent(assembleAcceptedHistory(...))` and clears `draftNarrative`; `onReject` clears `draftNarrative`/`generateError` with no dispatch — to make T015 pass

**Checkpoint**: User Stories 1 and 2 both work independently — generating and accepting a narrative is a complete, usable flow.

---

## Phase 5: User Story 3 - Reject the generated narrative (Priority: P2)

**Goal**: Rejecting (via the Reject button or dismissing the modal) is guaranteed to be a true no-op — the History tab's content and dirty/saved state are byte-for-byte unchanged — and a subsequent "Generate History" click always sends a brand-new, independent request.

**Independent Test**: Trigger a generation, click Reject (or dismiss via backdrop click), and confirm the History tab's content and dirty/saved state are unchanged; click "Generate History" again and confirm a fresh request is sent with no reference to the discarded draft.

### Tests for User Story 3 ⚠️

- [ ] T019 [US3] Extend `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` with failing tests: clicking Reject in the open modal, and separately dismissing it via backdrop click, both leave `historyContent` and `historyDirty` exactly as they were before "Generate History" was clicked; clicking "Generate History" again afterward calls `window.api.history.generate` a second, independent time with a request built fresh from current state (not the discarded draft)
- [ ] T020 [P] [US3] Extend `src/renderer/components/MainPane/tabs/GenerateHistoryModal.test.tsx` with a failing test: clicking the overlay backdrop itself (not modal content) calls `onReject`, not `onAccept`

### Implementation for User Story 3

- [ ] T021 [US3] Verify/finalize `HistoryTab.tsx`'s `onReject` handler (from T018) guarantees zero Redux dispatch and that the next "Generate History" click rebuilds its request entirely from current `editBuffer`/`sources`/`historyContent` state, to make T019 pass
- [ ] T022 [US3] Verify/finalize `GenerateHistoryModal.tsx`'s backdrop-click handler (from T017) calls `onReject` only when the click target is the overlay itself, not a click bubbling up from modal content, to make T020 pass

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [ ] T023 [P] Update `specs/019-generate-history/quickstart.md` if any implemented behavior drifted from the walkthrough during development
- [ ] T024 Run the full Jest suite (`npm test`) and confirm every new/changed test passes with no regressions in `HistoryTab.test.tsx`, `GenerateHistoryModal.test.tsx`, `markdown.test.ts`, `generate-history.test.ts` (shared/main/ai/main/ipc), and `preload.test.ts`
- [ ] T025 [P] Manually verify quickstart.md's edge cases: rapid double-click, temporarily-cleared API key mid-session, a shelter with no included citations, a forced failure (network/invalid key)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the shared types from T001); blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (T002-T003). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on User Story 1 (needs `HistoryTab.tsx`'s button/click-handler/`draftNarrative` state from T012 to attach the modal to).
- **User Story 3 (Phase 5)**: Depends on User Story 2 (needs `GenerateHistoryModal.tsx` and `HistoryTab.tsx`'s `onReject` wiring from T017/T018 to already exist).
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- US1 is the foundation US2 and US3 extend — it must land first.
- US2 must land before US3: US3 only adds hardening tests and confirms guarantees around behavior US2 already wires (the Reject/dismiss handler itself is introduced in US2's T018 so the modal is usable at all; US3 locks in its safety properties).

### Within Each User Story

- Tests are written and observed failing before implementation begins (T00X test task before its paired implementation task).
- Backend/shared modules (`src/main/ai/`, `src/shared/`) precede IPC handler wiring, which precedes renderer changes, within each story.

### Parallel Opportunities

- T002 (Foundational) has no sibling to parallelize with in that phase, but is independent of Setup's T001 completion in spirit (still sequenced after it per phase order).
- T004, T005, and T006 (US1 tests, three different files) can run in parallel; T007 touches `HistoryTab.test.tsx` and depends on the shared helpers (T003) but not on T004-T006, so it can also run in parallel with them.
- T013 and T014 (US2 tests, two different files) can run in parallel.
- T020 (US3, `GenerateHistoryModal.test.tsx`) can run in parallel with T019 (US3, `HistoryTab.test.tsx`).

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

Both are Priority P1 in spec.md — being able to generate a narrative with no way to actually apply it is not a usable MVP. Recommended minimum ship slice:

1. Complete Setup (T001) and Foundational (T002-T003).
2. Complete User Story 1 (T004-T012) — validate independently (requests are built and sent correctly, errors surface correctly).
3. Complete User Story 2 (T013-T018) — validate independently (review modal shows the right document, Accept applies it correctly).
4. Ship. User Story 3 (Reject hardening) is a fast-follow, though in practice its minimal Reject wiring already exists from T018 — US3 mainly locks in the guarantee with tests.

### Incremental Delivery

1. Setup + Foundational.
2. User Story 1 → validate (mocked backend, button states, error handling).
3. User Story 2 → validate (quickstart.md steps 3-5).
4. User Story 3 → validate (quickstart.md step 6 and the "Reject" edge cases).
5. Polish (T023-T025).

### Parallel Team Strategy

1. One contributor completes Setup + Foundational.
2. One contributor takes User Story 1 (must land before US2/US3 can start, since both extend its button/state).
3. Once US1 lands, User Story 2 must land before User Story 3 starts (US3 hardens US2's own Reject wiring) — these two are sequential, not parallel, unlike 018's US2/US3 split.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task in the same phase.
- Every user story remains independently completable and testable, per spec.md's own "Independent Test" for each story.
- No new top-level directory; `src/main/ai/generate-history.ts` sits alongside the existing `web-research.ts`. No new dependency; no `database/` or Python changes.
